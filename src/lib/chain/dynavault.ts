// src/lib/chain/dynavault.ts
//
// THE single passage point between Hearst Connect and PermissionedDynaVault v2.1.
//
// Architectural contract: when the contract changes again, ONLY this file changes.
// Nothing else in the app may declare a vault ABI, resolve a vault address, or
// decode a vault tuple. Routes/UI consume `Wired<T>` and nothing else.
//
// ── The three modes ────────────────────────────────────────────────────────────
//   "v2"             NEXT_PUBLIC_DYNAVAULT_ADDRESS is set + well-formed.
//                    Full v2.1 surface is readable.
//   "legacy"         Fallback on the deployed HearstYieldVault
//                    (0x2bd14d52…, Base Sepolia, ERC-4626 + Ownable + Pausable).
//                    ONLY the common subset is readable: totalAssets(),
//                    totalSupply() (→ totalShares), convertToAssets(), asset(),
//                    balanceOf() (→ shares), paused(). Everything else
//                    (strategies, mining, electricity, whitelist, tvlCap,
//                    curtailment, vending curve) returns `unavailable` with
//                    reason "not_supported_by_legacy" — NEVER a fabricated value.
//   "not_configured" No address at all → everything `unavailable` /
//                    "not_deployed".
//
// ── THE ASSET IS USDC ─────────────────────────────────────────────────────────
// The v2.1 spec says "USDT" in §1/§3 and "USDC" in §7. That contradiction was
// settled: it is USDC (6 decimals). The deployed vault points at USDC Base
// Sepolia (0x036CbD53842c5426634e7929541eC2318f3dCF7e). The word USDT appears
// nowhere in this codebase on purpose. `asset()` is still read from the chain
// and surfaced in `VaultCore.asset` so a mismatch is observable, not assumed.
//
// ── PermissionedDynaVault v2.1 is NOT an ERC-4626 ─────────────────────────────
// Familiar names, divergent surface. An indexer or client written against the
// standard silently sees NOTHING. The three breaks:
//   • `totalShares()`     replaces `totalSupply()`
//   • `shares(address)`   replaces `balanceOf(address)`
//   • `Deposit(address indexed user, uint256 assets, uint256 shares)`
//     replaces the standard
//     `Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)`
//     → 3 params instead of 4 ⇒ **A DIFFERENT topic0**. See
//     DYNAVAULT_DEPOSIT_EVENT_SIGNATURE below.
//   • `Redeem(address indexed user, uint256 shares, uint256 assets)`
//     replaces `Withdraw(sender, receiver, owner, assets, shares)` — renamed AND
//     reordered (shares before assets).
//   • `previewDeposit` / `maxRedeem` / `previewRedeem` are absent from the spec.
//
// ── Turbopack trap (already hit once in this repo) ────────────────────────────
// Next/Turbopack only inlines NEXT_PUBLIC_* into the CLIENT bundle when the
// expression is the LITERAL `process.env.NEXT_PUBLIC_FOO`. Reading through a
// variable (`env.NEXT_PUBLIC_FOO`) is NOT statically substituted → the browser
// gets `undefined` → address null → a silent "Configuration pending" forever.
// See src/lib/onchain/vault.ts:66-73. So the MODULE CONSTANTS below read the
// vars literally; `resolveDynavaultAddress(env)` / `resolveVaultTarget(env)`
// stay exported as pure, env-injected functions for unit tests only.
//
// This module must work on the SERVER and in the BROWSER — no `server-only`,
// no prisma, no fs, no private key.

import {
  createPublicClient,
  http,
  type Abi,
  type Address,
  type PublicClient,
} from "viem";
import { baseSepolia } from "viem/chains";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Base Sepolia. The only chain this app talks to — no mainnet anywhere. */
export const CHAIN_ID = 84532;

const DEFAULT_RPC_URL = "https://sepolia.base.org";
const RPC_TIMEOUT_MS = 10_000;
const RPC_RETRY_COUNT = 2;

/** USDC has 6 decimals on every chain. The vault's asset is USDC (settled). */
export const USDC_DECIMALS = 6;

/**
 * Share decimals — MODE-DEPENDENT, because the two vaults do NOT agree.
 *
 * Legacy HearstYieldVault: `_decimalsOffset() = 12` → shares 18 dec / asset 6
 * dec. VERIFIED on-chain (totalSupply()=12e18 for totalAssets()=12 USDC). This
 * is the mode running in production today — nothing about it may change.
 */
export const LEGACY_SHARE_DECIMALS = 18;

/**
 * PermissionedDynaVault v2.1: the spec says shares are minted "1:1" with the
 * asset (VAULT_SPEC_V2.1.md §1 `deposit` → "shares mintées (1:1 initialement)";
 * §3 lists `convertToShares`/`convertToAssets` with no decimals offset — it is
 * NOT an ERC-4626, so there is no OZ `_decimalsOffset`). The asset is USDC at 6
 * decimals, so 1:1 means shares carry 6 decimals as well. At the legacy 18 the
 * `navPerShare` would be wrong by a factor of 1e12, SILENTLY — that whole class
 * of error is why every read that depends on this also returns `shareDecimals`,
 * so a disagreement at deploy time is visible in the wire rather than hidden.
 *
 * @todo Reconfirm against the DEPLOYED bytecode before v2 goes live — the
 * contract does not exist yet, so 6 is the spec's intent, not a verified fact.
 */
export const V2_SHARE_DECIMALS = 6;

/** One whole share, in share units. Argument of `convertToAssets` for NAV. */
function oneShare(decimals: number): bigint {
  return 10n ** BigInt(decimals);
}

/** Share decimals for the mode whose read produced the value. */
function shareDecimalsForMode(mode: WiredSource): number {
  return mode === "v2" ? V2_SHARE_DECIMALS : LEGACY_SHARE_DECIMALS;
}

/**
 * Hard ceiling on strategy enumeration. The spec describes 3 adapters. A count
 * above this means the contract or the ABI is wrong — we refuse to loop over an
 * unbounded list rather than hammer the RPC ("no list without a LIMIT").
 */
const MAX_STRATEGIES = 32;

/** Sanity bound for `vendingCurveBps(month)` input (50 years of months). */
const MAX_VENDING_MONTH = 600;

/** `Wired.detail` is a short diagnostic, never a stack trace. */
const MAX_DETAIL_LENGTH = 200;

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

// ---------------------------------------------------------------------------
// Address resolution
// ---------------------------------------------------------------------------

/** Validate + normalise a raw env string into an Address, or null. */
function normaliseAddress(raw: string | undefined): Address | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  return ADDRESS_RE.test(trimmed) ? (trimmed as Address) : null;
}

/**
 * PermissionedDynaVault v2.1 address from an injected env. Exported for unit
 * tests ONLY — runtime code must use `getVaultAddress()` / `getVaultTarget()`,
 * which read the literal `process.env.*` (Turbopack trap, see file header).
 *
 * A malformed value returns null (→ fallback to legacy) rather than throwing:
 * this module runs in the browser where a throw would white-screen a page. The
 * loud failure lives server-side in `src/lib/env.ts`, where
 * NEXT_PUBLIC_DYNAVAULT_ADDRESS is Zod-validated at boot — that is where a typo
 * surfaces, and it surfaces hard.
 */
export function resolveDynavaultAddress(
  env: Record<string, string | undefined> = process.env,
): Address | null {
  return normaliseAddress(env.NEXT_PUBLIC_DYNAVAULT_ADDRESS);
}

/**
 * Legacy HearstYieldVault address from an injected env. Honors the canonical
 * name first, then the historical alias — same precedence as
 * `resolveVaultAddress` (src/lib/onchain/vault.ts) and the production gate in
 * `src/lib/env.ts`, so a deployment configured with either name behaves
 * consistently across the whole app.
 */
export function resolveLegacyVaultAddress(
  env: Record<string, string | undefined> = process.env,
): Address | null {
  return (
    normaliseAddress(env.NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS) ??
    normaliseAddress(env.NEXT_PUBLIC_HEARST_VAULT_ADDRESS)
  );
}

export type WiredSource = "v2" | "legacy";
export type VaultMode = WiredSource | "not_configured";

export type V2Target = { readonly mode: "v2"; readonly address: Address };
export type LegacyTarget = { readonly mode: "legacy"; readonly address: Address };
export type UnconfiguredTarget = {
  readonly mode: "not_configured";
  readonly address: null;
};

/** What this app is pointed at, right now. */
export type VaultTarget = V2Target | LegacyTarget | UnconfiguredTarget;

/** Single source of the mode precedence — used by BOTH the literal module
 *  constants and the env-injected `resolveVaultTarget`, so the two can't drift. */
function targetFrom(v2: Address | null, legacy: Address | null): VaultTarget {
  if (v2 !== null) return { mode: "v2", address: v2 };
  if (legacy !== null) return { mode: "legacy", address: legacy };
  return { mode: "not_configured", address: null };
}

/** Pure, env-injected target resolution. Exported for unit tests. */
export function resolveVaultTarget(
  env: Record<string, string | undefined> = process.env,
): VaultTarget {
  return targetFrom(resolveDynavaultAddress(env), resolveLegacyVaultAddress(env));
}

/**
 * v2 address — LITERAL env read so Turbopack inlines it into the client bundle.
 * Do NOT refactor into `resolveDynavaultAddress(process.env)`: that breaks the
 * inlining and the browser silently loses the address (see file header).
 */
export const DYNAVAULT_ADDRESS: Address | null = normaliseAddress(
  process.env.NEXT_PUBLIC_DYNAVAULT_ADDRESS,
);

/** Legacy address — same literal-read rule as above. */
export const LEGACY_VAULT_ADDRESS: Address | null =
  normaliseAddress(process.env.NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS) ??
  normaliseAddress(process.env.NEXT_PUBLIC_HEARST_VAULT_ADDRESS);

/**
 * The target resolved once at module init. On the server this reflects the
 * runtime env; in the browser it reflects the env inlined at BUILD time — a
 * newly-deployed contract needs a rebuild, not just a restart.
 */
const MODULE_TARGET: VaultTarget = targetFrom(DYNAVAULT_ADDRESS, LEGACY_VAULT_ADDRESS);

export function getVaultTarget(): VaultTarget {
  return MODULE_TARGET;
}

export function getVaultMode(): VaultMode {
  return MODULE_TARGET.mode;
}

export function getVaultAddress(): Address | null {
  return MODULE_TARGET.address;
}

// ---------------------------------------------------------------------------
// Wired<T> — the honesty contract
// ---------------------------------------------------------------------------

/**
 * Every read returns this. There is no third state and no fallback value: a
 * datum is either read from a named contract at a named address at a named
 * instant, or it is explicitly unavailable with a reason. An RPC outage MUST
 * stay distinguishable from an absence of data — that is the whole point.
 */
export type Wired<T> =
  | {
      status: "wired";
      data: T;
      source: "v2" | "legacy";
      address: Address;
      chainId: number;
      readAt: string;
    }
  | { status: "unavailable"; reason: string; detail?: string };

/**
 * The reason vocabulary produced by this module. `Wired.reason` is typed
 * `string` (the shared cross-module contract), so compare against THESE
 * constants rather than typing a literal — a typo in a string comparison
 * silently never matches.
 */
export const UNAVAILABLE_REASONS = {
  /** No v2 address configured at all (mode "not_configured"). */
  NOT_DEPLOYED: "not_deployed",
  /** In legacy mode: the old HearstYieldVault simply cannot do this. */
  NOT_SUPPORTED_BY_LEGACY: "not_supported_by_legacy",
  /** The RPC itself failed (timeout, HTTP error, transport down). An OUTAGE. */
  RPC_ERROR: "rpc_error",
  /** The call reached the chain and reverted — or returned no data, which is
   *  what you get when the function does not exist at that address. NOT an
   *  outage: the RPC worked, the contract said no. */
  REVERT: "revert",
  /** The call returned data that does not match our ABI's declared shape. The
   *  v2.1 ABI is transcribed from a spec, not from verified bytecode — a
   *  mismatch surfaces HERE instead of being silently mis-decoded. */
  DECODE_ERROR: "decode_error",
  /** Caller passed an out-of-bounds / malformed argument. Nothing was sent. */
  INVALID_INPUT: "invalid_input",
} as const;

export type UnavailableReason =
  (typeof UNAVAILABLE_REASONS)[keyof typeof UNAVAILABLE_REASONS];

function unavailable<T>(reason: UnavailableReason, detail?: string): Wired<T> {
  return detail === undefined
    ? { status: "unavailable", reason }
    : { status: "unavailable", reason, detail };
}

function wired<T>(data: T, target: V2Target | LegacyTarget): Wired<T> {
  return {
    status: "wired",
    data,
    source: target.mode,
    address: target.address,
    chainId: CHAIN_ID,
    readAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// ABI — PermissionedDynaVault v2.1, inline (no imports from contracts/out)
// ---------------------------------------------------------------------------

/**
 * v2.1 Deposit signature — 3 params, `user` indexed.
 * The ERC-4626 standard is `Deposit(address,address,uint256,uint256)`.
 * DIFFERENT ARITY ⇒ DIFFERENT topic0. Any indexer, subgraph or `getLogs` filter
 * written against the standard signature matches ZERO v2 deposits.
 */
export const DYNAVAULT_DEPOSIT_EVENT_SIGNATURE = "Deposit(address,uint256,uint256)";

/** What the LEGACY (real ERC-4626) vault emits — kept for contrast, and for
 *  whoever backfills the 1 real deposit (the $11 position) after the cutover. */
export const LEGACY_DEPOSIT_EVENT_SIGNATURE =
  "Deposit(address,address,uint256,uint256)";

/** v2.1 exit event — replaces `Withdraw`, and reorders (shares BEFORE assets). */
export const DYNAVAULT_REDEEM_EVENT_SIGNATURE = "Redeem(address,uint256,uint256)";

/**
 * PermissionedDynaVault v2.1 ABI, transcribed from the spec.
 *
 * ⚠️ NOT VERIFIED AGAINST DEPLOYED BYTECODE — the contract does not exist yet.
 * Every `UNCONFIRMED` marker below is an inference that must be checked against
 * the contract source before v2 goes live. Tuple component NAMES are
 * documentation only (viem returns positional arrays for multi-output
 * functions); the ORDER is what matters, and the decoders below validate the
 * runtime shape rather than trusting it.
 */
export const DYNAVAULT_ABI = [
  // ── Events ────────────────────────────────────────────────────────────────
  {
    // NON-STANDARD. See DYNAVAULT_DEPOSIT_EVENT_SIGNATURE above: the standard
    // ERC-4626 event has a 4th param (`owner`, indexed) → different topic0.
    type: "event",
    name: "Deposit",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "assets", type: "uint256", indexed: false },
      { name: "shares", type: "uint256", indexed: false },
    ],
  },
  {
    // Replaces ERC-4626 `Withdraw(sender, receiver, owner, assets, shares)`:
    // renamed AND reordered — shares first, assets second.
    type: "event",
    name: "Redeem",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "shares", type: "uint256", indexed: false },
      { name: "assets", type: "uint256", indexed: false },
    ],
  },
  // The operational events (VAULT_SPEC_V2.1.md §4). Declared so ONE ABI covers
  // every log an indexer of trades / history / proof needs to decode. Like the
  // views, these are transcribed from the spec, not from deployed bytecode.
  {
    type: "event",
    name: "StrategyAdded",
    inputs: [
      { name: "strategy", type: "address", indexed: true },
      { name: "allocation", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "StrategyRemoved",
    inputs: [{ name: "strategy", type: "address", indexed: true }],
  },
  {
    type: "event",
    name: "Rebalance",
    inputs: [{ name: "allocations", type: "uint256[]", indexed: false }],
  },
  {
    type: "event",
    name: "VaultSwapped",
    inputs: [
      { name: "caller", type: "address", indexed: true },
      { name: "tokenIn", type: "address", indexed: false },
      { name: "tokenOut", type: "address", indexed: false },
      { name: "amountIn", type: "uint256", indexed: false },
      { name: "amountOut", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ElectricityPaid",
    inputs: [
      { name: "amount", type: "uint256", indexed: false },
      { name: "payee", type: "address", indexed: true },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ElecPayeeUpdated",
    inputs: [
      { name: "oldPayee", type: "address", indexed: true },
      { name: "newPayee", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "MonthlyElecCostUpdated",
    inputs: [
      { name: "oldCost", type: "uint256", indexed: false },
      { name: "newCost", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "MiningMetricsReported",
    inputs: [
      { name: "hashrateTh", type: "uint256", indexed: false },
      { name: "btcEarnedSats", type: "uint256", indexed: false },
      { name: "totalBtcEarnedSats", type: "uint256", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "CurtailmentTriggered",
    inputs: [
      { name: "month", type: "uint256", indexed: false },
      { name: "btcPrice", type: "uint256", indexed: false },
      { name: "threshold", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "CurtailmentLifted",
    inputs: [
      { name: "month", type: "uint256", indexed: false },
      { name: "btcPrice", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "TakeProfitExecuted",
    inputs: [
      { name: "tier", type: "uint256", indexed: true },
      { name: "btcPrice", type: "uint256", indexed: false },
      { name: "btcSold", type: "uint256", indexed: false },
      { name: "usdcReceived", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "MonthlyEngineRun",
    inputs: [
      { name: "month", type: "uint256", indexed: false },
      { name: "fleetActive", type: "bool", indexed: false },
      { name: "btcPrice", type: "uint256", indexed: false },
      { name: "elecPaid", type: "uint256", indexed: false },
    ],
  },

  // ── User writes ───────────────────────────────────────────────────────────
  {
    type: "function",
    name: "deposit",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
    ],
    outputs: [{ name: "shares", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "redeem",
    inputs: [
      { name: "shares", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ name: "assets", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "redeemProportional",
    inputs: [{ name: "receiver", type: "address" }],
    outputs: [{ name: "assets", type: "uint256" }],
    stateMutability: "nonpayable",
  },

  // ── Views ─────────────────────────────────────────────────────────────────
  {
    type: "function",
    name: "totalAssets",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    // NOT `totalSupply()`. See file header.
    type: "function",
    name: "totalShares",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "convertToShares",
    inputs: [{ name: "assets", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "convertToAssets",
    inputs: [{ name: "shares", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getStrategyCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    // (address, uint256, bool, bool) → adapter, allocation, active, isIdle
    // (VAULT_SPEC_V2.1.md §3). `enabled` mirrors the spec's `active`;
    // `allocationBps` is implied by setStrategyAllocation(index, bps). Order is
    // what the spec fixes; viem returns a positional array and decodeStrategy
    // validates the runtime shape rather than trusting these names.
    type: "function",
    name: "strategies",
    inputs: [{ name: "index", type: "uint256" }],
    outputs: [
      { name: "adapter", type: "address" },
      { name: "allocationBps", type: "uint256" },
      { name: "enabled", type: "bool" },
      { name: "isIdle", type: "bool" },
    ],
    stateMutability: "view",
  },
  {
    // (uint256, address, uint256, uint256, bool) → cost, payee, totalPaid,
    // lastPaymentTime, canPay (VAULT_SPEC_V2.1.md §3). The first four map 1:1
    // onto the standalone getters monthlyElecCost / elecPayee / totalElecPaid /
    // lastElecPaymentTime. The trailing bool is `canPay` — the 30-day cooldown
    // has elapsed AND idle ≥ monthlyElecCost, i.e. payElectricity() would go
    // through right now. This is roughly the INVERSE of "already paid this
    // month", not a rename of it.
    type: "function",
    name: "elecStatus",
    inputs: [],
    outputs: [
      { name: "monthlyElecCost", type: "uint256" },
      { name: "elecPayee", type: "address" },
      { name: "totalElecPaid", type: "uint256" },
      { name: "lastElecPaymentTime", type: "uint256" },
      { name: "canPay", type: "bool" },
    ],
    stateMutability: "view",
  },
  {
    // (uint256, uint256, uint256) per spec. The first two mirror the standalone
    // getters and reportMiningMetrics(uint256,uint256). The THIRD is genuinely
    // ambiguous — `lastReportedAt` is a guess (could be `currentMonth`).
    // UNCONFIRMED.
    type: "function",
    name: "miningMetrics",
    inputs: [],
    outputs: [
      { name: "reportedHashrateTh", type: "uint256" },
      { name: "totalBtcEarnedSats", type: "uint256" },
      { name: "lastReportedAt", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    // NOT `balanceOf(address)`. See file header.
    type: "function",
    name: "shares",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "whitelist",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "asset",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "keeper",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "tvlCap",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "permissionDisabled",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    // UNCONFIRMED type: the spec gives no signature and no setter. Declared
    // `bool` by analogy with permissionDisabled / isCurtailed. If it is really
    // a uint8 enum, decoding fails loudly (decode_error) instead of lying.
    type: "function",
    name: "miningNoteMode",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isCurtailed",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "currentMonth",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "reportedHashrateTh",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalBtcEarnedSats",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "monthlyElecCost",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "elecPayee",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalElecPaid",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "lastElecPaymentTime",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "vendingCurveBps",
    inputs: [{ name: "month", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "productDurationMonths",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },

  // ── Owner / keeper writes ─────────────────────────────────────────────────
  // Declared so the keeper agent has ONE ABI to import. This module ships NO
  // write helper: every one of these is a privileged, value-moving action and
  // must be driven from an explicitly-audited call site, not from a generic
  // adapter (and never from the chat — ADR-012/ADR-017).
  {
    type: "function",
    name: "addToWhitelist",
    inputs: [{ name: "user", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "removeFromWhitelist",
    inputs: [{ name: "user", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setKeeper",
    inputs: [{ name: "keeper", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setTvlCap",
    inputs: [{ name: "cap", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setPermissionDisabled",
    inputs: [{ name: "disabled", type: "bool" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "rebalance",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "payElectricity",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "reportMiningMetrics",
    inputs: [
      { name: "hashrateTh", type: "uint256" },
      { name: "btcEarnedSats", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setStrategyAllocation",
    inputs: [
      { name: "index", type: "uint256" },
      { name: "allocationBps", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "runMonthlyEngine",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "curtail",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "liftCurtailment",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "executeTakeProfit",
    inputs: [{ name: "tier", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    // ⚠️ `bytes32[] swapData` is SUSPECT. Swap calldata is normally `bytes`, not
    // `bytes32[]`. Declared here EXACTLY as the spec states — deliberately NOT
    // "fixed" on our side: if the real contract takes `bytes`, the function
    // selector differs and every call fails loudly (which is the point).
    // @todo Confirm with the contract engineer before writing any keeper call.
    // Param names are inferred; only the ORDER/TYPES come from the spec.
    type: "function",
    name: "swapAndReport",
    inputs: [
      { name: "tokenIn", type: "address" },
      { name: "amountIn", type: "uint256" },
      { name: "tokenOut", type: "address" },
      { name: "minAmountOut", type: "uint256" },
      { name: "target", type: "address" },
      { name: "swapData", type: "bytes32[]" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },

  // ── Owner config / strategy management (VAULT_SPEC_V2.1.md §2) ─────────────
  // Same rule as the writes above: DECLARATIONS ONLY, no write helper shipped.
  // Each is a privileged, value- or policy-moving call that belongs at an
  // explicitly-audited keeper/owner call site, never a generic adapter (and
  // never the chat — ADR-012/ADR-017).
  {
    type: "function",
    name: "addStrategy",
    inputs: [
      { name: "adapter", type: "address" },
      { name: "allocation", type: "uint256" },
      { name: "isIdle", type: "bool" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "removeStrategy",
    inputs: [{ name: "adapter", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setElecPayee",
    inputs: [{ name: "_payee", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setMonthlyElecCost",
    inputs: [{ name: "_cost", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setCurtailmentThresholds",
    inputs: [
      { name: "pre", type: "uint256" },
      { name: "post", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setHalvingMonth",
    inputs: [{ name: "month", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setTakeProfitTier",
    inputs: [
      { name: "index", type: "uint256" },
      { name: "btcPrice", type: "uint256" },
      { name: "sellBps", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "resetTakeProfitTier",
    inputs: [{ name: "index", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setProductDurationMonths",
    inputs: [{ name: "months", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setMiningNoteMode",
    inputs: [{ name: "enabled", type: "bool" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

/**
 * The ONLY functions readable on the deployed legacy HearstYieldVault
 * (0x2bd14d52…): `is ERC4626, Ownable, Pausable`, everything inherited from
 * OpenZeppelin. Verified against contracts/src/HearstYieldVault.sol and against
 * live chain state (totalAssets()=12 USDC, totalSupply()=12e18,
 * convertToAssets(1e18)=1.0000, paused()=false).
 *
 * Note the two rename pairs vs v2: `totalSupply` ↔ `totalShares`,
 * `balanceOf` ↔ `shares`. That is the whole compatibility bridge.
 */
export const LEGACY_VAULT_READ_ABI = [
  {
    type: "function",
    name: "totalAssets",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalSupply",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "convertToAssets",
    inputs: [{ name: "shares", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "convertToShares",
    inputs: [{ name: "assets", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "asset",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "paused",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
] as const;

// ---------------------------------------------------------------------------
// Client
//
// Structural `ReadContractClient` rather than viem's `PublicClient` generic —
// this dodges the dual-viem-version collision that surfaces when
// `@walletconnect/utils` pins an older viem alongside ours. Same trick as
// src/lib/onchain/vault.ts:411-425 (documented + necessary). Params/result stay
// deliberately loose; the decoders below validate the runtime shape.
// ---------------------------------------------------------------------------

type ReadContractArgs = {
  address: Address;
  abi: Abi;
  functionName: string;
  args: readonly unknown[];
};

export type ReadContractClient = {
  readContract: (params: ReadContractArgs) => Promise<unknown>;
};

function buildReadClient(): PublicClient {
  // Literal env read — same Turbopack inlining rule as the addresses above.
  const rpc =
    process.env.NEXT_PUBLIC_CHAIN_RPC_URL?.trim() || DEFAULT_RPC_URL;
  return createPublicClient({
    chain: baseSepolia,
    transport: http(rpc, { timeout: RPC_TIMEOUT_MS, retryCount: RPC_RETRY_COUNT }),
  }) as PublicClient;
}

let _cachedClient: PublicClient | null = null;

function getReadClient(): ReadContractClient {
  if (_cachedClient === null) {
    _cachedClient = buildReadClient();
  }
  return _cachedClient;
}

/** Options accepted by every read. */
export interface ReadOpts {
  /**
   * Inject a viem client. Defaults to this module's lazily-built Base Sepolia
   * client (works on the server AND in the browser). A Server Component that
   * already holds `getPublicClient()` (src/lib/chain/client.ts) can pass it
   * here; unit tests pass a fake.
   */
  client?: ReadContractClient;
}

// ---------------------------------------------------------------------------
// Decoding + error classification
// ---------------------------------------------------------------------------

function asBigint(value: unknown): bigint | null {
  return typeof value === "bigint" ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function asAddress(value: unknown): Address | null {
  return typeof value === "string" && ADDRESS_RE.test(value)
    ? (value as Address)
    : null;
}

function asTuple(value: unknown, length: number): readonly unknown[] | null {
  return Array.isArray(value) && value.length === length ? value : null;
}

/**
 * Markers that mean "the chain answered, and the answer was no". Matched on
 * `name + message` because `instanceof` is unreliable across a dual-viem
 * install (two copies of the error classes → instanceof always false).
 *
 * "returned no data" is viem's ContractFunctionZeroDataError: the function does
 * not exist at that address, or the address has no code. That is emphatically
 * NOT an outage — classifying it as `revert` keeps `rpc_error` meaning exactly
 * one thing: the RPC is down.
 */
const REVERT_MARKERS = [
  "contractfunctionrevertederror",
  "contractfunctionzerodataerror",
  "execution reverted",
  "reverted with",
  "returned no data",
];

/**
 * Short, safe diagnostic. First line only, URLs stripped (an RPC URL can embed
 * a provider key), hard-truncated.
 *
 * NOTE for route authors: `detail` is a DEBUG string for server logs and admin
 * surfaces. Do not forward it verbatim to an untrusted client — the repo rule is
 * "log server-side, respond generically".
 */
function sanitizeDetail(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const firstLine = raw.split("\n")[0] ?? "";
  return firstLine
    .replace(/https?:\/\/\S+/g, "[url]")
    .trim()
    .slice(0, MAX_DETAIL_LENGTH);
}

function classifyError(err: unknown): {
  reason: UnavailableReason;
  detail: string;
} {
  const name = err instanceof Error ? err.name : "";
  const message = err instanceof Error ? err.message : String(err);
  const haystack = `${name} ${message}`.toLowerCase();
  const isRevert = REVERT_MARKERS.some((marker) => haystack.includes(marker));
  return {
    // Anything we cannot positively identify as a contract-level "no" is
    // reported as an RPC failure: an unknown failure is an outage until proven
    // otherwise, and `detail` carries the raw first line for triage.
    reason: isRevert ? UNAVAILABLE_REASONS.REVERT : UNAVAILABLE_REASONS.RPC_ERROR,
    detail: sanitizeDetail(err),
  };
}

/** Guard for v2-only surface. Returns the target, or the Wired to hand back. */
type V2Guard<T> =
  | { ok: true; target: V2Target }
  | { ok: false; wired: Wired<T> };

function requireV2<T>(feature: string): V2Guard<T> {
  const target = MODULE_TARGET;
  if (target.mode === "v2") return { ok: true, target };
  if (target.mode === "legacy") {
    return {
      ok: false,
      wired: unavailable<T>(
        UNAVAILABLE_REASONS.NOT_SUPPORTED_BY_LEGACY,
        `${feature} does not exist on the legacy HearstYieldVault at ${target.address}. Deploy PermissionedDynaVault and set NEXT_PUBLIC_DYNAVAULT_ADDRESS.`,
      ),
    };
  }
  return { ok: false, wired: notDeployed<T>() };
}

function notDeployed<T>(): Wired<T> {
  return unavailable<T>(
    UNAVAILABLE_REASONS.NOT_DEPLOYED,
    "No vault address configured. Set NEXT_PUBLIC_DYNAVAULT_ADDRESS (v2) or NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS (legacy).",
  );
}

// ---------------------------------------------------------------------------
// Data shapes
// ---------------------------------------------------------------------------

export interface VaultCore {
  /** Total asset units under management (USDC, 6 dec). */
  totalAssets: bigint;
  /** v2: `totalShares()`. legacy: `totalSupply()` — the same quantity. */
  totalShares: bigint;
  /** `convertToAssets(oneShare(shareDecimals))` — asset units per whole share. */
  navPerShare: bigint;
  /** The underlying token, READ FROM THE CHAIN (expected: USDC Base Sepolia). */
  asset: Address;
  /**
   * Decimals assumed for `asset` — NOT read from the chain (`decimals()` is not
   * in the v2.1 spec's view list). 6 = USDC. Compare `asset` against the
   * expected USDC address before trusting any formatted amount.
   */
  assetDecimals: number;
  /** Decimals assumed for shares — mode-dependent: v2 = V2_SHARE_DECIMALS (6,
   *  spec's "1:1" with USDC, unconfirmed vs bytecode); legacy =
   *  LEGACY_SHARE_DECIMALS (18, verified on-chain). */
  shareDecimals: number;
  /** v2: `tvlCap()`. legacy: null — the old contract has no cap (it has
   *  `minDeposit`, which v2 drops). null means "not exposed", never "zero". */
  tvlCap: bigint | null;
  /** legacy: `paused()` (it is Pausable). v2: null — the v2.1 spec lists no
   *  `paused()` view; its closest analogue is `isCurtailed()`. null means
   *  "not exposed by this contract", never "not paused". */
  paused: boolean | null;
}

export interface StrategyInfo {
  index: number;
  adapter: Address;
  allocationBps: bigint;
  enabled: boolean;
  /**
   * 4th component of `strategies(uint256)` — `isIdle` (VAULT_SPEC_V2.1.md §3).
   * true → the allocation is satisfied by the vault's own idle balance
   * (`adapter = address(0)`); the B3 Reserve pocket is the idle strategy.
   */
  isIdle: boolean;
}

export interface MiningMetrics {
  reportedHashrateTh: bigint;
  totalBtcEarnedSats: bigint;
  /** UNCONFIRMED semantics — 3rd component of `miningMetrics()` (could be
   *  `currentMonth` rather than a timestamp). */
  lastReportedAt: bigint;
}

export interface ElecStatus {
  monthlyElecCost: bigint;
  elecPayee: Address;
  totalElecPaid: bigint;
  lastElecPaymentTime: bigint;
  /**
   * Trailing bool of `elecStatus()` — `canPay` (VAULT_SPEC_V2.1.md §3): the
   * 30-day cooldown has elapsed AND idle ≥ `monthlyElecCost`, i.e. a
   * `payElectricity()` call would succeed right now. NOT "already paid this
   * month" — it is roughly the inverse.
   */
  canPay: boolean;
}

export interface WhitelistStatus {
  user: Address;
  /** `whitelist(user)`. */
  whitelisted: boolean;
  /** `permissionDisabled()` — when true the gate is open to everyone. */
  permissionDisabled: boolean;
  /** Derived from the two reads above. Callers should use THIS rather than
   *  re-deriving it: forgetting `permissionDisabled` shows "not allowed" to a
   *  user the contract would happily accept. */
  effectivelyAllowed: boolean;
}

export interface UserShares {
  user: Address;
  /** v2: `shares(user)`. legacy: `balanceOf(user)`. */
  shares: bigint;
  /** `convertToAssets(shares)` — the position's current asset value. */
  assets: bigint;
  assetDecimals: number;
  shareDecimals: number;
}

export interface VendingCurvePoint {
  month: number;
  bps: bigint;
}

export interface NavPerShare {
  /** Raw `convertToAssets(oneShare(shareDecimals))` in asset units. */
  raw: bigint;
  assetDecimals: number;
  shareDecimals: number;
}

// ---------------------------------------------------------------------------
// Reads — every one returns Wired<T>. NONE of them throws.
// ---------------------------------------------------------------------------

/**
 * totalAssets / totalShares / navPerShare / asset / tvlCap / paused.
 *
 * Works in BOTH modes: in legacy the two renamed functions are bridged
 * (`totalSupply` → totalShares), `tvlCap` is null (absent from that contract)
 * and `paused` is read for real. In v2 the reverse: `tvlCap` is read, `paused`
 * is null (absent from the spec). A null is always "this contract does not
 * expose it" — never a stand-in for a value we failed to read.
 */
export async function readVaultCore(opts?: ReadOpts): Promise<Wired<VaultCore>> {
  const target = MODULE_TARGET;
  if (target.mode === "not_configured") return notDeployed<VaultCore>();

  const client = opts?.client ?? getReadClient();
  const address = target.address;

  try {
    if (target.mode === "v2") {
      const [rawAssets, rawShares, rawNav, rawAsset, rawCap] = await Promise.all([
        client.readContract({
          address,
          abi: DYNAVAULT_ABI,
          functionName: "totalAssets",
          args: [],
        }),
        client.readContract({
          address,
          abi: DYNAVAULT_ABI,
          functionName: "totalShares",
          args: [],
        }),
        client.readContract({
          address,
          abi: DYNAVAULT_ABI,
          functionName: "convertToAssets",
          args: [oneShare(V2_SHARE_DECIMALS)],
        }),
        client.readContract({
          address,
          abi: DYNAVAULT_ABI,
          functionName: "asset",
          args: [],
        }),
        client.readContract({
          address,
          abi: DYNAVAULT_ABI,
          functionName: "tvlCap",
          args: [],
        }),
      ]);

      const totalAssets = asBigint(rawAssets);
      const totalShares = asBigint(rawShares);
      const navPerShare = asBigint(rawNav);
      const asset = asAddress(rawAsset);
      const tvlCap = asBigint(rawCap);

      if (
        totalAssets === null ||
        totalShares === null ||
        navPerShare === null ||
        asset === null ||
        tvlCap === null
      ) {
        return unavailable<VaultCore>(
          UNAVAILABLE_REASONS.DECODE_ERROR,
          "PermissionedDynaVault core views returned a shape that does not match the v2.1 ABI.",
        );
      }

      return wired<VaultCore>(
        {
          totalAssets,
          totalShares,
          navPerShare,
          asset,
          assetDecimals: USDC_DECIMALS,
          shareDecimals: V2_SHARE_DECIMALS,
          tvlCap,
          paused: null,
        },
        target,
      );
    }

    const [rawAssets, rawSupply, rawNav, rawAsset, rawPaused] = await Promise.all([
      client.readContract({
        address,
        abi: LEGACY_VAULT_READ_ABI,
        functionName: "totalAssets",
        args: [],
      }),
      client.readContract({
        address,
        abi: LEGACY_VAULT_READ_ABI,
        functionName: "totalSupply",
        args: [],
      }),
      client.readContract({
        address,
        abi: LEGACY_VAULT_READ_ABI,
        functionName: "convertToAssets",
        args: [oneShare(LEGACY_SHARE_DECIMALS)],
      }),
      client.readContract({
        address,
        abi: LEGACY_VAULT_READ_ABI,
        functionName: "asset",
        args: [],
      }),
      client.readContract({
        address,
        abi: LEGACY_VAULT_READ_ABI,
        functionName: "paused",
        args: [],
      }),
    ]);

    const totalAssets = asBigint(rawAssets);
    const totalShares = asBigint(rawSupply);
    const navPerShare = asBigint(rawNav);
    const asset = asAddress(rawAsset);
    const paused = asBoolean(rawPaused);

    if (
      totalAssets === null ||
      totalShares === null ||
      navPerShare === null ||
      asset === null ||
      paused === null
    ) {
      return unavailable<VaultCore>(
        UNAVAILABLE_REASONS.DECODE_ERROR,
        "Legacy HearstYieldVault core views returned an unexpected shape.",
      );
    }

    return wired<VaultCore>(
      {
        totalAssets,
        totalShares,
        navPerShare,
        asset,
        assetDecimals: USDC_DECIMALS,
        shareDecimals: LEGACY_SHARE_DECIMALS,
        tvlCap: null,
        paused,
      },
      target,
    );
  } catch (err) {
    const { reason, detail } = classifyError(err);
    return unavailable<VaultCore>(reason, detail);
  }
}

/** `convertToAssets(oneShare(shareDecimals))` — available in BOTH modes, with
 *  the share unit chosen by mode (v2 = 6, legacy = 18). */
export async function readNavPerShare(
  opts?: ReadOpts,
): Promise<Wired<NavPerShare>> {
  const target = MODULE_TARGET;
  if (target.mode === "not_configured") return notDeployed<NavPerShare>();

  const client = opts?.client ?? getReadClient();
  const abi = target.mode === "v2" ? DYNAVAULT_ABI : LEGACY_VAULT_READ_ABI;
  const shareDecimals = shareDecimalsForMode(target.mode);

  try {
    const raw = await client.readContract({
      address: target.address,
      abi,
      functionName: "convertToAssets",
      args: [oneShare(shareDecimals)],
    });
    const value = asBigint(raw);
    if (value === null) {
      return unavailable<NavPerShare>(
        UNAVAILABLE_REASONS.DECODE_ERROR,
        "convertToAssets() did not return a uint256.",
      );
    }
    return wired<NavPerShare>(
      {
        raw: value,
        assetDecimals: USDC_DECIMALS,
        shareDecimals,
      },
      target,
    );
  } catch (err) {
    const { reason, detail } = classifyError(err);
    return unavailable<NavPerShare>(reason, detail);
  }
}

/** All strategies. v2 only — the legacy vault holds no strategy at all. */
export async function readStrategies(
  opts?: ReadOpts,
): Promise<Wired<StrategyInfo[]>> {
  const guard = requireV2<StrategyInfo[]>("strategies()");
  if (!guard.ok) return guard.wired;

  const target = guard.target;
  const client = opts?.client ?? getReadClient();

  try {
    const rawCount = await client.readContract({
      address: target.address,
      abi: DYNAVAULT_ABI,
      functionName: "getStrategyCount",
      args: [],
    });
    const count = asBigint(rawCount);
    if (count === null) {
      return unavailable<StrategyInfo[]>(
        UNAVAILABLE_REASONS.DECODE_ERROR,
        "getStrategyCount() did not return a uint256.",
      );
    }
    if (count < 0n || count > BigInt(MAX_STRATEGIES)) {
      return unavailable<StrategyInfo[]>(
        UNAVAILABLE_REASONS.DECODE_ERROR,
        `getStrategyCount() returned ${count.toString()}, outside the [0, ${MAX_STRATEGIES}] sanity bound — refusing to enumerate.`,
      );
    }

    const length = Number(count);
    const rows = await Promise.all(
      Array.from({ length }, (_unused, index) =>
        client.readContract({
          address: target.address,
          abi: DYNAVAULT_ABI,
          functionName: "strategies",
          args: [BigInt(index)],
        }),
      ),
    );

    const strategies: StrategyInfo[] = [];
    for (let index = 0; index < rows.length; index += 1) {
      const decoded = decodeStrategy(index, rows[index]);
      if (decoded === null) {
        return unavailable<StrategyInfo[]>(
          UNAVAILABLE_REASONS.DECODE_ERROR,
          `strategies(${index}) did not match (address,uint256,bool,bool).`,
        );
      }
      strategies.push(decoded);
    }

    return wired<StrategyInfo[]>(strategies, target);
  } catch (err) {
    const { reason, detail } = classifyError(err);
    return unavailable<StrategyInfo[]>(reason, detail);
  }
}

function decodeStrategy(index: number, raw: unknown): StrategyInfo | null {
  const tuple = asTuple(raw, 4);
  if (tuple === null) return null;
  const adapter = asAddress(tuple[0]);
  const allocationBps = asBigint(tuple[1]);
  const enabled = asBoolean(tuple[2]);
  const isIdle = asBoolean(tuple[3]);
  if (
    adapter === null ||
    allocationBps === null ||
    enabled === null ||
    isIdle === null
  ) {
    return null;
  }
  return { index, adapter, allocationBps, enabled, isIdle };
}

/** A single strategy by index. v2 only. */
export async function readStrategy(
  index: number,
  opts?: ReadOpts,
): Promise<Wired<StrategyInfo>> {
  if (!Number.isInteger(index) || index < 0 || index >= MAX_STRATEGIES) {
    return unavailable<StrategyInfo>(
      UNAVAILABLE_REASONS.INVALID_INPUT,
      `index must be an integer in [0, ${MAX_STRATEGIES - 1}].`,
    );
  }

  const guard = requireV2<StrategyInfo>("strategies(uint256)");
  if (!guard.ok) return guard.wired;

  const target = guard.target;
  const client = opts?.client ?? getReadClient();

  try {
    const raw = await client.readContract({
      address: target.address,
      abi: DYNAVAULT_ABI,
      functionName: "strategies",
      args: [BigInt(index)],
    });
    const decoded = decodeStrategy(index, raw);
    if (decoded === null) {
      return unavailable<StrategyInfo>(
        UNAVAILABLE_REASONS.DECODE_ERROR,
        `strategies(${index}) did not match (address,uint256,bool,bool).`,
      );
    }
    return wired<StrategyInfo>(decoded, target);
  } catch (err) {
    const { reason, detail } = classifyError(err);
    return unavailable<StrategyInfo>(reason, detail);
  }
}

/** `miningMetrics()`. v2 only. */
export async function readMiningMetrics(
  opts?: ReadOpts,
): Promise<Wired<MiningMetrics>> {
  const guard = requireV2<MiningMetrics>("miningMetrics()");
  if (!guard.ok) return guard.wired;

  const target = guard.target;
  const client = opts?.client ?? getReadClient();

  try {
    const raw = await client.readContract({
      address: target.address,
      abi: DYNAVAULT_ABI,
      functionName: "miningMetrics",
      args: [],
    });
    const tuple = asTuple(raw, 3);
    if (tuple === null) {
      return unavailable<MiningMetrics>(
        UNAVAILABLE_REASONS.DECODE_ERROR,
        "miningMetrics() did not return a 3-tuple.",
      );
    }
    const reportedHashrateTh = asBigint(tuple[0]);
    const totalBtcEarnedSats = asBigint(tuple[1]);
    const lastReportedAt = asBigint(tuple[2]);
    if (
      reportedHashrateTh === null ||
      totalBtcEarnedSats === null ||
      lastReportedAt === null
    ) {
      return unavailable<MiningMetrics>(
        UNAVAILABLE_REASONS.DECODE_ERROR,
        "miningMetrics() did not match (uint256,uint256,uint256).",
      );
    }
    return wired<MiningMetrics>(
      { reportedHashrateTh, totalBtcEarnedSats, lastReportedAt },
      target,
    );
  } catch (err) {
    const { reason, detail } = classifyError(err);
    return unavailable<MiningMetrics>(reason, detail);
  }
}

/** `elecStatus()`. v2 only. */
export async function readElecStatus(opts?: ReadOpts): Promise<Wired<ElecStatus>> {
  const guard = requireV2<ElecStatus>("elecStatus()");
  if (!guard.ok) return guard.wired;

  const target = guard.target;
  const client = opts?.client ?? getReadClient();

  try {
    const raw = await client.readContract({
      address: target.address,
      abi: DYNAVAULT_ABI,
      functionName: "elecStatus",
      args: [],
    });
    const tuple = asTuple(raw, 5);
    if (tuple === null) {
      return unavailable<ElecStatus>(
        UNAVAILABLE_REASONS.DECODE_ERROR,
        "elecStatus() did not return a 5-tuple.",
      );
    }
    const monthlyElecCost = asBigint(tuple[0]);
    const elecPayee = asAddress(tuple[1]);
    const totalElecPaid = asBigint(tuple[2]);
    const lastElecPaymentTime = asBigint(tuple[3]);
    const canPay = asBoolean(tuple[4]);
    if (
      monthlyElecCost === null ||
      elecPayee === null ||
      totalElecPaid === null ||
      lastElecPaymentTime === null ||
      canPay === null
    ) {
      return unavailable<ElecStatus>(
        UNAVAILABLE_REASONS.DECODE_ERROR,
        "elecStatus() did not match (uint256,address,uint256,uint256,bool).",
      );
    }
    return wired<ElecStatus>(
      {
        monthlyElecCost,
        elecPayee,
        totalElecPaid,
        lastElecPaymentTime,
        canPay,
      },
      target,
    );
  } catch (err) {
    const { reason, detail } = classifyError(err);
    return unavailable<ElecStatus>(reason, detail);
  }
}

/**
 * `whitelist(user)` + `permissionDisabled()`. v2 only — the legacy vault has no
 * on-chain KYC gate (its only guard is `minDeposit`).
 */
export async function readWhitelist(
  user: Address,
  opts?: ReadOpts,
): Promise<Wired<WhitelistStatus>> {
  const normalised = normaliseAddress(user);
  if (normalised === null) {
    return unavailable<WhitelistStatus>(
      UNAVAILABLE_REASONS.INVALID_INPUT,
      "user must be a 0x-prefixed 40-hex EVM address.",
    );
  }

  const guard = requireV2<WhitelistStatus>("whitelist(address)");
  if (!guard.ok) return guard.wired;

  const target = guard.target;
  const client = opts?.client ?? getReadClient();

  try {
    const [rawWhitelisted, rawDisabled] = await Promise.all([
      client.readContract({
        address: target.address,
        abi: DYNAVAULT_ABI,
        functionName: "whitelist",
        args: [normalised],
      }),
      client.readContract({
        address: target.address,
        abi: DYNAVAULT_ABI,
        functionName: "permissionDisabled",
        args: [],
      }),
    ]);

    const whitelisted = asBoolean(rawWhitelisted);
    const permissionDisabled = asBoolean(rawDisabled);
    if (whitelisted === null || permissionDisabled === null) {
      return unavailable<WhitelistStatus>(
        UNAVAILABLE_REASONS.DECODE_ERROR,
        "whitelist(address) / permissionDisabled() did not return bool.",
      );
    }

    return wired<WhitelistStatus>(
      {
        user: normalised,
        whitelisted,
        permissionDisabled,
        effectivelyAllowed: permissionDisabled || whitelisted,
      },
      target,
    );
  } catch (err) {
    const { reason, detail } = classifyError(err);
    return unavailable<WhitelistStatus>(reason, detail);
  }
}

/**
 * A user's share balance and its asset value. Works in BOTH modes: v2 exposes
 * `shares(address)`, legacy exposes the ERC-4626 `balanceOf(address)` — the
 * same quantity under the rename documented in the file header.
 */
export async function readUserShares(
  user: Address,
  opts?: ReadOpts,
): Promise<Wired<UserShares>> {
  const normalised = normaliseAddress(user);
  if (normalised === null) {
    return unavailable<UserShares>(
      UNAVAILABLE_REASONS.INVALID_INPUT,
      "user must be a 0x-prefixed 40-hex EVM address.",
    );
  }

  const target = MODULE_TARGET;
  if (target.mode === "not_configured") return notDeployed<UserShares>();

  const client = opts?.client ?? getReadClient();
  const abi = target.mode === "v2" ? DYNAVAULT_ABI : LEGACY_VAULT_READ_ABI;
  const sharesFn = target.mode === "v2" ? "shares" : "balanceOf";
  const shareDecimals = shareDecimalsForMode(target.mode);

  try {
    const rawShares = await client.readContract({
      address: target.address,
      abi,
      functionName: sharesFn,
      args: [normalised],
    });
    const shares = asBigint(rawShares);
    if (shares === null) {
      return unavailable<UserShares>(
        UNAVAILABLE_REASONS.DECODE_ERROR,
        `${sharesFn}(address) did not return a uint256.`,
      );
    }

    const rawAssets = await client.readContract({
      address: target.address,
      abi,
      functionName: "convertToAssets",
      args: [shares],
    });
    const assets = asBigint(rawAssets);
    if (assets === null) {
      return unavailable<UserShares>(
        UNAVAILABLE_REASONS.DECODE_ERROR,
        "convertToAssets() did not return a uint256.",
      );
    }

    return wired<UserShares>(
      {
        user: normalised,
        shares,
        assets,
        assetDecimals: USDC_DECIMALS,
        shareDecimals,
      },
      target,
    );
  } catch (err) {
    const { reason, detail } = classifyError(err);
    return unavailable<UserShares>(reason, detail);
  }
}

/** `vendingCurveBps(month)`. v2 only. */
export async function readVendingCurve(
  month: number,
  opts?: ReadOpts,
): Promise<Wired<VendingCurvePoint>> {
  if (!Number.isInteger(month) || month < 0 || month > MAX_VENDING_MONTH) {
    return unavailable<VendingCurvePoint>(
      UNAVAILABLE_REASONS.INVALID_INPUT,
      `month must be an integer in [0, ${MAX_VENDING_MONTH}].`,
    );
  }

  const guard = requireV2<VendingCurvePoint>("vendingCurveBps(uint256)");
  if (!guard.ok) return guard.wired;

  const target = guard.target;
  const client = opts?.client ?? getReadClient();

  try {
    const raw = await client.readContract({
      address: target.address,
      abi: DYNAVAULT_ABI,
      functionName: "vendingCurveBps",
      args: [BigInt(month)],
    });
    const bps = asBigint(raw);
    if (bps === null) {
      return unavailable<VendingCurvePoint>(
        UNAVAILABLE_REASONS.DECODE_ERROR,
        "vendingCurveBps(uint256) did not return a uint256.",
      );
    }
    return wired<VendingCurvePoint>({ month, bps }, target);
  } catch (err) {
    const { reason, detail } = classifyError(err);
    return unavailable<VendingCurvePoint>(reason, detail);
  }
}
