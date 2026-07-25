// src/lib/onchain/vault.ts
//
// Real viem helpers for ERC-20 approve + ERC-4626 deposit against the
// Hearst Yield Vault deployed on Base Sepolia.
//
// Design contracts:
//  - All addresses are resolved from NEXT_PUBLIC_* env vars (public, not secret).
//  - Every function requires a connected WalletClient (from Privy's
//    `getEthereumProvider` / `createWalletClient`). No WalletClient = explicit
//    error thrown — never a fake txHash.
//  - `publicClient` is caller-supplied for `waitForTransactionReceipt`; callers
//    that can't supply one get a typed `ConfigError` rather than a silent fail.
//  - ABI is declared inline — no imports from `contracts/out/`.
//
// ── WRITE-PATH SAFETY (v2 trap, É-1) ──────────────────────────────────────────
// This module's `VAULT_ADDRESS` resolves ONLY the LEGACY vault
// (NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS / …_HEARST_VAULT_ADDRESS). The
// canonical passage point `@/lib/chain/dynavault` also understands the v2
// address (NEXT_PUBLIC_DYNAVAULT_ADDRESS) and picks v2 when it is set. If v2 is
// ever configured, every READ moves to v2 while these WRITES would keep
// targeting the OLD legacy vault — silently. To close that trap, `approveUsdc`
// and `depositToVault` assert `getVaultMode() === "legacy"` and THROW a
// `ConfigError` under mode "v2" instead of routing funds to the wrong contract.
// Wiring the v2 write path (approve + deposit against DynaVault) is OUT OF SCOPE
// here — this guard only fails loud until that work lands.

import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseUnits,
  type Abi,
  type Hex,
  type WalletClient,
  type PublicClient,
  type Address,
} from "viem";
import { getDeployment } from "@/lib/chain/deployments";
// Client-safe mode read (this module is pulled into "use client" invest-form):
// import from ./vault-mode, NOT ./dynavault (server-only), so the browser bundle
// never drags the server-only chain adapter in — that was the prod build break.
import { getVaultMode } from "@/lib/chain/vault-mode";
// Privy's EIP1193Provider uses `on(eventName: string, ...)` which is structurally
// narrower than viem's generic-overloaded signature. Bridging via `unknown` is the
// only safe cast — we never use the `on`/`removeListener` methods ourselves, and
// the `request` method matches exactly. See vault.ts: walletClientFromProvider.
type ViemCompatibleProvider = Parameters<typeof custom>[0];
import { baseSepolia } from "viem/chains";

// ---------------------------------------------------------------------------
// Addresses — from NEXT_PUBLIC_* env (public, safe in browser bundles)
// ---------------------------------------------------------------------------

const BASE_SEPOLIA_CHAIN_ID = 84532;

/**
 * Resolves the vault address from env, trying the canonical name first then
 * the legacy alias.  Exported for unit-testing without module re-import.
 *
 * Canonical: NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS
 * Legacy alias: NEXT_PUBLIC_HEARST_VAULT_ADDRESS
 */
/** Validate + normalise a raw env string into an Address, or null. */
function normaliseAddress(raw: string | undefined): Address | null {
  if (!raw) return null;
  const t = raw.trim();
  return /^0x[0-9a-fA-F]{40}$/.test(t) ? (t as Address) : null;
}

export function resolveVaultAddress(
  env: Record<string, string | undefined> = process.env,
): Address | null {
  return normaliseAddress(
    env.NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS ??
      env.NEXT_PUBLIC_HEARST_VAULT_ADDRESS,
  );
}

/**
 * The deployed ERC-4626 vault address.
 *
 * IMPORTANT: read the NEXT_PUBLIC_* vars TEXTUALLY on `process.env` here.
 * Next/Turbopack only inlines NEXT_PUBLIC_* vars into the client bundle when
 * accessed as a literal dotted expression. Going through the indirect
 * `resolveVaultAddress(env)` param (where `env` is a variable) is NOT statically
 * substituted, so the browser saw `undefined` → VAULT_ADDRESS=null → the invest
 * flow showed "Configuration pending" forever. The literal reads below fix that.
 * `resolveVaultAddress` stays exported for unit tests (they inject a fake env).
 */
export const VAULT_ADDRESS: Address | null =
  normaliseAddress(process.env.NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS) ??
  normaliseAddress(process.env.NEXT_PUBLIC_HEARST_VAULT_ADDRESS);
const VAULT_DEPLOYMENT = getDeployment("vault");

/** The USDC token address on Base Sepolia. */
export const USDC_ADDRESS: Address =
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

export function isVaultStale(): boolean {
  return VAULT_DEPLOYMENT.meta.stale;
}

/** USDC has 6 decimals on all chains. */
const USDC_DECIMALS = 6;

// ---------------------------------------------------------------------------
// Minimal ABIs (inline — no contracts/out imports)
// ---------------------------------------------------------------------------

const ERC20_ABI = [
  {
    name: "approve",
    type: "function" as const,
    stateMutability: "nonpayable" as const,
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "allowance",
    type: "function" as const,
    stateMutability: "view" as const,
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function" as const,
    stateMutability: "view" as const,
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const ERC4626_ABI = [
  {
    name: "deposit",
    type: "function" as const,
    stateMutability: "nonpayable" as const,
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
    ],
    outputs: [{ name: "shares", type: "uint256" }],
  },
  {
    name: "previewDeposit",
    type: "function" as const,
    stateMutability: "view" as const,
    inputs: [{ name: "assets", type: "uint256" }],
    outputs: [{ name: "shares", type: "uint256" }],
  },
  {
    name: "asset",
    type: "function" as const,
    stateMutability: "view" as const,
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "balanceOf",
    type: "function" as const,
    stateMutability: "view" as const,
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    // redeem(shares, receiver, owner) — burns `shares`, sends underlying USDC to
    // `receiver`. The exit path mirror of deposit. Gated by whenNotPaused on-chain.
    name: "redeem",
    type: "function" as const,
    stateMutability: "nonpayable" as const,
    inputs: [
      { name: "shares", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ name: "assets", type: "uint256" }],
  },
  {
    name: "maxRedeem",
    type: "function" as const,
    stateMutability: "view" as const,
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "previewRedeem",
    type: "function" as const,
    stateMutability: "view" as const,
    inputs: [{ name: "shares", type: "uint256" }],
    outputs: [{ name: "assets", type: "uint256" }],
  },
  {
    // totalAssets() → total USDC (6-decimal) managed by the vault.
    name: "totalAssets",
    type: "function" as const,
    stateMutability: "view" as const,
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    // convertToAssets(shares) → USDC assets for 1e18 shares — used to derive NAV per share.
    name: "convertToAssets",
    type: "function" as const,
    stateMutability: "view" as const,
    inputs: [{ name: "shares", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// ---------------------------------------------------------------------------
// Typed error classes — callers distinguish config vs chain vs contract errors
// ---------------------------------------------------------------------------

export class ConfigError extends Error {
  readonly code = "CONFIG_ERROR" as const;
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export class ChainError extends Error {
  readonly code = "CHAIN_ERROR" as const;
  constructor(message: string) {
    super(message);
    this.name = "ChainError";
  }
}

/**
 * Guards every write in this module against the v2 trap (see file header).
 * Throws a `ConfigError` when the app is pointed at the v2 DynaVault, because
 * the writes here still target the LEGACY `VAULT_ADDRESS`. Mode "legacy" (and
 * "not_configured", which then fails on the null `VAULT_ADDRESS` check) proceed.
 */
function assertLegacyWritePath(): void {
  if (getVaultMode() === "v2") {
    throw new ConfigError(
      "v2 deposit path not wired — route writes to DynaVault before enabling v2. " +
        "NEXT_PUBLIC_DYNAVAULT_ADDRESS is set, so reads use v2 while these writes " +
        "still target the legacy vault. Refusing to deposit to the wrong contract.",
    );
  }
}

/** Shared helper for write-and-wait-receipt flow. */
async function writeContractAndAwaitReceipt(
  walletClient: WalletClient,
  params: {
    address: Address;
    abi: Abi;
    functionName: string;
    args: readonly unknown[];
  },
): Promise<Hex> {
  const account = walletClient.account;
  if (!account) {
    throw new ConfigError("WalletClient has no account. Reconnect your wallet.");
  }

  const txHash = await walletClient.writeContract({
    ...params,
    account,
    chain: baseSepolia,
  });

  const publicClient = getBrowserPublicClient();
  await publicClient.waitForTransactionReceipt({ hash: txHash });

  return txHash;
}

// ---------------------------------------------------------------------------
// Public client factory (client-side) — not server-only; used in "use client"
// components. Separate from src/lib/chain/client.ts which is server-only.
// ---------------------------------------------------------------------------

function buildPublicClientBrowser(): PublicClient {
  const rpc =
    process.env.NEXT_PUBLIC_CHAIN_RPC_URL?.trim() || "https://sepolia.base.org";
  return createPublicClient({
    chain: baseSepolia,
    transport: http(rpc, { timeout: 10_000, retryCount: 2 }),
  }) as PublicClient;
}

// Lazily instantiated once per browser session.
let _cachedPublicClient: PublicClient | null = null;
export function getBrowserPublicClient(): PublicClient {
  if (!_cachedPublicClient) {
    _cachedPublicClient = buildPublicClientBrowser();
  }
  return _cachedPublicClient;
}

// ---------------------------------------------------------------------------
// Wallet client factory from a Privy / EIP-1193 provider
// ---------------------------------------------------------------------------

export function walletClientFromProvider(
  // `unknown` accepts both viem's EIP1193Provider and Privy's narrower variant
  // (whose `.on` signature differs in ways that are irrelevant at runtime).
  // We do NOT expose `any` — callers that pass an unexpected shape will discover
  // it at `writeContract` time from viem's own runtime checks.
  provider: unknown,
  address: Address,
): WalletClient {
  const viemProvider = provider as ViemCompatibleProvider;
  return createWalletClient({
    account: address,
    chain: baseSepolia,
    transport: custom(viemProvider),
  });
}

// ---------------------------------------------------------------------------
// Chain guard — verifies the wallet is on Base Sepolia before transacting
// ---------------------------------------------------------------------------

export async function assertBaseSepolia(walletClient: WalletClient): Promise<void> {
  const chainId = await walletClient.getChainId();
  if (chainId !== BASE_SEPOLIA_CHAIN_ID) {
    throw new ChainError(
      `Wallet is on chain ${chainId}. Switch to Base Sepolia (84532) before transacting.`,
    );
  }
}

// ---------------------------------------------------------------------------
// ERC-20 approve
// ---------------------------------------------------------------------------

export interface ApproveUsdcOpts {
  walletClient: WalletClient;
  /** USDC amount in whole dollars (integer). Internally converted to 6-decimal units. */
  amountUsdc: number;
}

export interface ApproveUsdcResult {
  txHash: Hex;
}

/**
 * Sends an ERC-20 `approve(vault, amount)` on behalf of the connected wallet.
 *
 * Throws `ConfigError` if NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS (or legacy
 * alias NEXT_PUBLIC_HEARST_VAULT_ADDRESS) is unset.
 * Throws `ChainError`  if the wallet is not on Base Sepolia.
 * Throws the underlying viem/RPC error for any contract-level rejection.
 */
export async function approveUsdc(opts: ApproveUsdcOpts): Promise<ApproveUsdcResult> {
  // v2 trap guard (see file header): never approve the legacy vault as spender
  // when the app has moved its reads to v2.
  assertLegacyWritePath();

  if (!VAULT_ADDRESS) {
    throw new ConfigError(
      "NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS is not configured. " +
        "Set NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS (or legacy NEXT_PUBLIC_HEARST_VAULT_ADDRESS) " +
        "to enable on-chain transactions.",
    );
  }

  await assertBaseSepolia(opts.walletClient);

  const amount = parseUnits(String(opts.amountUsdc), USDC_DECIMALS);

  const txHash = await writeContractAndAwaitReceipt(opts.walletClient, {
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [VAULT_ADDRESS, amount],
  });

  return { txHash };
}

// ---------------------------------------------------------------------------
// ERC-4626 deposit
// ---------------------------------------------------------------------------

export interface DepositToVaultOpts {
  walletClient: WalletClient;
  /** USDC amount in whole dollars (integer). */
  amountUsdc: number;
  /** Receiver of the vault shares — usually the same as the connected wallet. */
  receiver: Address;
}

export interface DepositToVaultResult {
  txHash: Hex;
  amountUsdc: number;
}

/**
 * Calls `vault.deposit(assets, receiver)`.
 * Assumes the caller has already approved a sufficient USDC allowance.
 *
 * Throws `ConfigError` if NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS (or legacy
 * alias NEXT_PUBLIC_HEARST_VAULT_ADDRESS) is unset.
 * Throws `ChainError`  if the wallet is not on Base Sepolia.
 */
export async function depositToVault(
  opts: DepositToVaultOpts,
): Promise<DepositToVaultResult> {
  // v2 trap guard (see file header): refuse to deposit into the legacy vault
  // when the app has moved its reads to v2 — throw rather than route funds to
  // the wrong contract.
  assertLegacyWritePath();

  if (!VAULT_ADDRESS) {
    throw new ConfigError(
      "NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS is not configured. " +
        "Set NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS (or legacy NEXT_PUBLIC_HEARST_VAULT_ADDRESS) " +
        "to enable on-chain transactions.",
    );
  }

  await assertBaseSepolia(opts.walletClient);

  const assets = parseUnits(String(opts.amountUsdc), USDC_DECIMALS);

  const txHash = await writeContractAndAwaitReceipt(opts.walletClient, {
    address: VAULT_ADDRESS,
    abi: ERC4626_ABI,
    functionName: "deposit",
    args: [assets, opts.receiver],
  });

  return { txHash, amountUsdc: opts.amountUsdc };
}
