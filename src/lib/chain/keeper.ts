import "server-only";

import {
  BaseError,
  ContractFunctionRevertedError,
  createWalletClient,
  http,
  type Address,
  type Hash,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { z } from "zod";

import { getPublicClient } from "@/lib/chain/client";
import { CHAIN_ID, DYNAVAULT_ABI, getVaultTarget } from "@/lib/chain/dynavault";
import { logger } from "@/lib/logger";

/**
 * Keeper signer + the three privileged writes against PermissionedDynaVault v2.1.
 *
 * ── Why this module exists, separate from the routes ──────────────────────────
 * The routes own HTTP (auth, rate limit, Zod, audit). This module owns the KEY
 * and the chain. Nothing else in the app may hold `KEEPER_PRIVATE_KEY` or build
 * a keeper wallet — one signing seam, auditable in one place.
 *
 * The ABI and the address are NOT declared here: they come from
 * `@/lib/chain/dynavault`, which is THE single passage point to the contract
 * (its architectural contract: "when the contract changes again, ONLY this file
 * changes"). This module adds the *signer*, not a second source of truth.
 *
 * ── ⚠️ ARGUMENT ORDER IS A MONEY-MOVING DETAIL ───────────────────────────────
 * Every `args` tuple below is POSITIONAL and is checked against `DYNAVAULT_ABI`
 * by viem's inference — which only works because the tuples are `as const` and
 * the ABI is `as const`. That check is not decoration: `swapAndReport` shipped
 * here with positions 1 and 2 transposed (`tokenOut` handed to the contract's
 * `uint256 amountIn`), and the `as const` typing is the ONLY thing that caught
 * it before an address was encoded as an amount on a route that moves real
 * funds. Rules that follow from that:
 *   • NEVER widen an args tuple (no `as const` removal, no `Address[]`, no cast).
 *   • Build each tuple ONCE and hand the SAME reference to `simulateContract`
 *     and `writeContract`, so what we simulate is what we send.
 *   • `reportMiningMetrics(uint256,uint256)` has NO type-level net — both
 *     parameters are uint256, so tsc cannot see a transposition. Its order is
 *     locked by `src/lib/chain/__tests__/keeper.test.ts` and nothing else.
 *
 * ── ⚠️ GOVERNANCE — READ BEFORE EXTENDING ────────────────────────────────────
 * ADR-018's red line reads: *"Crews may read chain state, simulate, compare
 * ABI/address/chainId, draft Safe payloads … but never hold a key, sign a
 * transaction, or move funds."* That line is scoped to **Crews/Swarms** (the
 * agentic layer), and this module is deliberately NOT reachable from one: there
 * is no chat tool, no Inngest cron, and no agent call site. Every export here is
 * driven by an **authenticated human admin** over HTTP (`requireAdmin()`), which
 * is the "human gate" of ADR-018 §5 — not autonomy.
 *
 * `docs/CONTRACT_REPLACEMENT_CARTOGRAPHY_2026-07-15.md` (Lot 6) flags the same
 * tension and defers it to **ADR-019, which does not exist yet**. Until it does:
 *   • DO NOT wire any of these functions to a cron, an agent, or a chat tool.
 *   • DO NOT remove `isKeeperEnabled()` from any call path.
 * `payElectricity` in particular MOVES FUNDS (USDC → `elecPayee`), and ADR-006
 * separately keeps **auto-execution of rebalances forbidden** ("Rebalancing
 * remains PTAI and human-approved") — `executeRebalance` is therefore
 * human-approved by construction, never scheduled.
 *
 * ── Honesty contract (the repo's most important rule) ────────────────────────
 * Every export returns a discriminated union, never a bare `null`. A disarmed
 * keeper is `{ status: "blocked", reason: "key_missing" }` — NOT a silent
 * success. (`src/lib/chain/publisher.ts` returns `null` when its key is absent
 * and its caller then reports `ok: true, armed: false`; that pattern makes a
 * no-op look like a win and is deliberately NOT reproduced here.)
 *
 * An RPC outage (`rpc_error`) stays distinguishable from a contract refusal
 * (`revert`) and from an undeployed contract (`not_deployed`) at every layer.
 *
 * ── `detail` is server-side only ─────────────────────────────────────────────
 * `detail` carries revert strings / RPC internals for the server log. Routes MUST
 * log it and MUST NOT forward it to the client. `reason` is a closed enum and is
 * the only field safe to return.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_RPC_URL = "https://sepolia.base.org";
const RPC_TIMEOUT_MS = 10_000;
const RPC_RETRY_COUNT = 2;

/** How long we wait for a keeper tx to be mined before reporting honestly. */
const RECEIPT_TIMEOUT_MS = 60_000;

/** `detail` is a short diagnostic, never a stack trace, never a key. */
const MAX_DETAIL_LENGTH = 200;

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

/** Closed vocabulary. Compare against these, never against a string literal. */
export type KeeperBlockedReason =
  /** `KEEPER_ENABLED` is not "1". The kill-switch is the default state. */
  | "keeper_disabled"
  /** `KEEPER_PRIVATE_KEY` absent/blank → the keeper is disarmed. */
  | "key_missing"
  /** `KEEPER_PRIVATE_KEY` present but not 0x + 64 hex. */
  | "key_malformed"
  /** Vault mode is not "v2": legacy or unconfigured. NOTHING was attempted. */
  | "not_deployed"
  /** The RPC itself failed (timeout, transport down). An OUTAGE. */
  | "rpc_error"
  /** The chain was reached and the contract said no. NOT an outage. */
  | "revert";

export interface KeeperBlocked {
  status: "blocked";
  reason: KeeperBlockedReason;
  /** SERVER-SIDE ONLY — never forward to a client. */
  detail?: string;
}

export interface KeeperTxSent {
  status: "sent";
  txHash: Hash;
  address: Address;
  chainId: number;
  sentAt: string;
}

export type KeeperTxResult = KeeperTxSent | KeeperBlocked;

/**
 * `swapAndReport()` then `rebalance()` are TWO transactions. There is no atomic
 * bracket around them on-chain, so the half-done state is REAL and is modelled
 * explicitly rather than being collapsed into a generic failure.
 */
export type RebalanceResult =
  | KeeperBlocked
  | {
      status: "sent";
      swapTxHash: Hash;
      rebalanceTxHash: Hash;
      address: Address;
      chainId: number;
      sentAt: string;
    }
  | {
      /** The swap tx was mined but REVERTED. `rebalance()` was NOT attempted. */
      status: "swap_reverted";
      swapTxHash: Hash;
      address: Address;
      chainId: number;
      sentAt: string;
    }
  | {
      /** The swap LANDED; the rebalance did not. The vault is mid-sequence. */
      status: "rebalance_failed";
      swapTxHash: Hash;
      reason: Extract<KeeperBlockedReason, "rpc_error" | "revert">;
      detail?: string;
      address: Address;
      chainId: number;
      sentAt: string;
    };

// ---------------------------------------------------------------------------
// Kill-switch
// ---------------------------------------------------------------------------

/**
 * `KEEPER_ENABLED` — the kill-switch. **Default OFF**: anything other than the
 * literal "1" leaves every write blocked.
 *
 * Read from `process.env` on EVERY call, deliberately:
 *   • it is not cached at module load, so flipping the switch off takes effect on
 *     the next request — that is the point of a kill-switch on a money-moving
 *     path (`src/lib/chain/publisher.ts` reads its key per-call for the same
 *     reason);
 *   • it is NOT a Zod boot-gate in `src/lib/env.ts`. A throwing boot-gate on an
 *     unprovisioned var 500s *every route* in production, invisibly in local dev
 *     — a documented outage class in this repo. The kill-switch must never be
 *     able to take the app down; the worst it may do is refuse to sign.
 */
export function isKeeperEnabled(): boolean {
  return process.env.KEEPER_ENABLED === "1";
}

// ---------------------------------------------------------------------------
// Key resolution
// ---------------------------------------------------------------------------

/**
 * `z.custom` gives us the `0x${string}` template-literal type viem wants with NO
 * cast (`as` / `as unknown as` are both banned here).
 */
const KeeperPrivateKeySchema = z.custom<`0x${string}`>(
  (value) => typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value),
  { message: "KEEPER_PRIVATE_KEY must be 0x + 64 hex characters" },
);

type KeyResolution =
  | { ok: true; key: `0x${string}` }
  | { ok: false; reason: "key_missing" | "key_malformed" };

/**
 * Resolve the keeper key from env. The key is NEVER logged, never returned to a
 * caller outside this module, and never embedded in `detail`.
 */
function resolveKeeperKey(): KeyResolution {
  const raw = process.env.KEEPER_PRIVATE_KEY;
  if (raw === undefined || raw.trim().length === 0) {
    return { ok: false, reason: "key_missing" };
  }
  const parsed = KeeperPrivateKeySchema.safeParse(raw.trim());
  if (!parsed.success) {
    // Log the FACT, never the value.
    logger.error("[chain/keeper] KEEPER_PRIVATE_KEY is malformed — keeper disarmed");
    return { ok: false, reason: "key_malformed" };
  }
  return { ok: true, key: parsed.data };
}

// ---------------------------------------------------------------------------
// Wallet
// ---------------------------------------------------------------------------

function getRpcUrl(): string {
  const url = process.env.NEXT_PUBLIC_CHAIN_RPC_URL;
  if (!url || url.trim().length === 0) return DEFAULT_RPC_URL;
  return url;
}

function buildWalletClient(key: `0x${string}`) {
  return createWalletClient({
    account: privateKeyToAccount(key),
    chain: baseSepolia,
    transport: http(getRpcUrl(), {
      timeout: RPC_TIMEOUT_MS,
      retryCount: RPC_RETRY_COUNT,
    }),
  });
}

/**
 * Inferred rather than annotated `WalletClient` — mirrors `src/lib/chain/client.ts`
 * and keeps the bound `account` in the type (the widened `WalletClient` used by
 * `publisher.ts` loses it, forcing casts at every call site).
 */
export type KeeperWalletClient = ReturnType<typeof buildWalletClient>;

// ---------------------------------------------------------------------------
// Gate
// ---------------------------------------------------------------------------

interface KeeperReady {
  ok: true;
  wallet: KeeperWalletClient;
  address: Address;
}

/**
 * The single gate every write goes through. Order is deliberate:
 *   1. kill-switch  — cheapest, and the operator's explicit intent;
 *   2. deployment   — never touch a key for a contract that cannot serve the call
 *                     (legacy HearstYieldVault has no keeper surface at all);
 *   3. key          — only now do we read the secret.
 */
function prepareKeeper(): KeeperReady | KeeperBlocked {
  if (!isKeeperEnabled()) {
    return { status: "blocked", reason: "keeper_disabled" };
  }

  const target = getVaultTarget();
  if (target.mode !== "v2") {
    // Legacy and unconfigured are both "not_deployed" for keeper purposes: the
    // deployed HearstYieldVault is a plain ERC-4626 with no reportMiningMetrics /
    // payElectricity / swapAndReport. `detail` says which, for the server log.
    return {
      status: "blocked",
      reason: "not_deployed",
      detail:
        target.mode === "legacy"
          ? "vault mode is 'legacy' (HearstYieldVault) — no keeper surface"
          : "no NEXT_PUBLIC_DYNAVAULT_ADDRESS configured",
    };
  }

  const key = resolveKeeperKey();
  if (!key.ok) {
    return { status: "blocked", reason: key.reason };
  }

  return { ok: true, wallet: buildWalletClient(key.key), address: target.address };
}

function isBlocked(value: KeeperReady | KeeperBlocked): value is KeeperBlocked {
  return "status" in value;
}

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

function truncate(text: string): string {
  return text.length > MAX_DETAIL_LENGTH
    ? `${text.slice(0, MAX_DETAIL_LENGTH)}…`
    : text;
}

/**
 * An RPC outage MUST stay distinguishable from a contract refusal. viem wraps a
 * revert in a `ContractFunctionRevertedError` somewhere in the error chain; a
 * transport failure never produces one.
 */
function classifyChainError(err: unknown): {
  reason: Extract<KeeperBlockedReason, "rpc_error" | "revert">;
  detail: string;
} {
  if (err instanceof BaseError) {
    const reverted = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError) {
      return { reason: "revert", detail: truncate(reverted.shortMessage) };
    }
    return { reason: "rpc_error", detail: truncate(err.shortMessage) };
  }
  return {
    reason: "rpc_error",
    detail: truncate(err instanceof Error ? err.message : String(err)),
  };
}

function sentAt(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export interface ReportMiningMetricsInput {
  /** Whole TH/s. Bounds are enforced by the route's Zod schema. */
  hashrateTh: number;
  /** Whole satoshis. Bounds are enforced by the route's Zod schema. */
  btcEarnedSats: number;
}

/**
 * `reportMiningMetrics(uint256 hashrateTh, uint256 btcEarnedSats)`.
 *
 * ⚠️ BOTH PARAMETERS ARE uint256, so the `as const` tuple below type-checks
 * whichever way round they are written: tsc CANNOT catch a transposition here.
 * A swap would silently report the hashrate as satoshis mined and vice versa —
 * corrupt public metrics, no error anywhere. The order is locked by
 * `src/lib/chain/__tests__/keeper.test.ts` and by nothing else. Do not reorder.
 *
 * Simulated before it is sent: `simulateContract` surfaces an `onlyKeeper`
 * rejection (i.e. our signer is not the vault's `keeper()`) as a revert BEFORE we
 * spend gas, without needing a separate `keeper()` read.
 */
export async function reportMiningMetrics(
  input: ReportMiningMetricsInput,
): Promise<KeeperTxResult> {
  const prep = prepareKeeper();
  if (isBlocked(prep)) return prep;

  // Built once, handed to BOTH calls below: we simulate exactly what we send.
  const args = [BigInt(input.hashrateTh), BigInt(input.btcEarnedSats)] as const;

  try {
    const publicClient = getPublicClient();
    await publicClient.simulateContract({
      address: prep.address,
      abi: DYNAVAULT_ABI,
      functionName: "reportMiningMetrics",
      args,
      account: prep.wallet.account,
    });

    const txHash = await prep.wallet.writeContract({
      address: prep.address,
      abi: DYNAVAULT_ABI,
      functionName: "reportMiningMetrics",
      args,
      chain: baseSepolia,
      account: prep.wallet.account,
    });

    return { status: "sent", txHash, address: prep.address, chainId: CHAIN_ID, sentAt: sentAt() };
  } catch (err) {
    const { reason, detail } = classifyChainError(err);
    logger.error("[chain/keeper] reportMiningMetrics failed", { reason, detail });
    return { status: "blocked", reason, detail };
  }
}

/**
 * `payElectricity()` — no arguments, per DYNAVAULT_ABI (`inputs: []`).
 *
 * ⚠️ THIS MOVES FUNDS: it transfers USDC out of the vault to `elecPayee`. It is
 * the single most consequential export in this module. Human-triggered only.
 */
export async function payElectricity(): Promise<KeeperTxResult> {
  const prep = prepareKeeper();
  if (isBlocked(prep)) return prep;

  try {
    const publicClient = getPublicClient();
    await publicClient.simulateContract({
      address: prep.address,
      abi: DYNAVAULT_ABI,
      functionName: "payElectricity",
      account: prep.wallet.account,
    });

    const txHash = await prep.wallet.writeContract({
      address: prep.address,
      abi: DYNAVAULT_ABI,
      functionName: "payElectricity",
      chain: baseSepolia,
      account: prep.wallet.account,
    });

    return { status: "sent", txHash, address: prep.address, chainId: CHAIN_ID, sentAt: sentAt() };
  } catch (err) {
    const { reason, detail } = classifyChainError(err);
    logger.error("[chain/keeper] payElectricity failed", { reason, detail });
    return { status: "blocked", reason, detail };
  }
}

/**
 * The swap leg's inputs, NAMED — the wire/caller side is order-independent.
 *
 * The fields are listed in the ABI's positional order on purpose, so the mapping
 * in `executeRebalance` reads straight down. `swapAndReport` takes
 * `amountIn` at position 1, BETWEEN the two tokens — not after them, which is the
 * order a human naturally writes and is exactly how this shipped broken once.
 */
export interface ExecuteRebalanceInput {
  /** ABI position 0 — `address tokenIn`. */
  tokenIn: Address;
  /** ABI position 1 — `uint256 amountIn`, base units. `bigint` end-to-end: a
   *  base-unit amount never becomes a Number. */
  amountIn: bigint;
  /** ABI position 2 — `address tokenOut`. */
  tokenOut: Address;
  /** ABI position 3 — `uint256 minAmountOut`, base units. */
  minAmountOut: bigint;
  /** ABI position 4 — `address target`. Called `router` here because that is what
   *  it is in practice; the contract's parameter name is `target`. */
  router: Address;
  /** ABI position 5 — `bytes32[] swapData`. The `bytes32[]` typing comes from the
   *  v2.1 spec and is UNCONFIRMED (calldata is normally `bytes`); it is carried
   *  verbatim from the socle so a mismatch fails loudly instead of mis-encoding. */
  swapData: readonly `0x${string}`[];
}

/**
 * `swapAndReport(address tokenIn, uint256 amountIn, address tokenOut,
 *                uint256 minAmountOut, address target, bytes32[] swapData)`
 * then `rebalance()`.
 *
 * ADR-006 keeps **auto-execution of rebalances forbidden** — "Rebalancing remains
 * PTAI and human-approved". This function is only ever reached from an
 * admin-authenticated HTTP request; it must never be scheduled.
 *
 * Non-atomic by nature. We wait for the swap receipt and inspect `status` before
 * sending `rebalance()`:
 *   • `waitForTransactionReceipt` RESOLVES for a reverted tx (`status:
 *     "reverted"`) — it does not throw. Treating "resolved" as "succeeded" would
 *     fire `rebalance()` on top of a swap that never happened.
 *   • If the swap lands and the rebalance then fails, we report
 *     `rebalance_failed` WITH the swap hash. We cannot roll back a mined tx, so
 *     we surface the true half-done state instead of pretending the whole
 *     sequence failed.
 */
export async function executeRebalance(
  input: ExecuteRebalanceInput,
): Promise<RebalanceResult> {
  const prep = prepareKeeper();
  if (isBlocked(prep)) return prep;

  const publicClient = getPublicClient();

  // ── The ABI's order, NOT the caller's ────────────────────────────────────
  //   swapAndReport(address tokenIn, uint256 amountIn, address tokenOut,
  //                 uint256 minAmountOut, address target, bytes32[] swapData)
  // `amountIn` is position 1, between the two tokens. This shipped once as
  // [tokenIn, tokenOut, amountIn, …] — an `address` landing in the `uint256
  // amountIn` slot, i.e. a swap of an absurd amount of the wrong token, with
  // real funds, on a route whose whole job is to move them.
  //
  // `as const` is LOAD-BEARING: it is the only reason viem could type-check this
  // tuple against DYNAVAULT_ABI position-by-position and reject the transposed
  // version. Do not widen it, do not cast it, do not reorder it to match
  // `ExecuteRebalanceInput`. Built ONCE and passed to BOTH calls below, so the
  // simulated call and the signed call cannot drift apart.
  const swapArgs = [
    input.tokenIn,
    input.amountIn,
    input.tokenOut,
    input.minAmountOut,
    input.router,
    input.swapData,
  ] as const;

  // ── Step 1: swapAndReport ────────────────────────────────────────────────
  let swapTxHash: Hash;
  try {
    await publicClient.simulateContract({
      address: prep.address,
      abi: DYNAVAULT_ABI,
      functionName: "swapAndReport",
      args: swapArgs,
      account: prep.wallet.account,
    });

    swapTxHash = await prep.wallet.writeContract({
      address: prep.address,
      abi: DYNAVAULT_ABI,
      functionName: "swapAndReport",
      args: swapArgs,
      chain: baseSepolia,
      account: prep.wallet.account,
    });
  } catch (err) {
    const { reason, detail } = classifyChainError(err);
    logger.error("[chain/keeper] swapAndReport failed — rebalance not attempted", {
      reason,
      detail,
    });
    return { status: "blocked", reason, detail };
  }

  const base = { address: prep.address, chainId: CHAIN_ID, sentAt: sentAt() };

  // ── Step 2: confirm the swap actually succeeded ───────────────────────────
  try {
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: swapTxHash,
      timeout: RECEIPT_TIMEOUT_MS,
    });
    if (receipt.status !== "success") {
      logger.error("[chain/keeper] swapAndReport mined but REVERTED — rebalance skipped", {
        swapTxHash,
      });
      return { status: "swap_reverted", swapTxHash, ...base };
    }
  } catch (err) {
    // We could not observe the receipt. The swap MAY have landed — saying
    // otherwise would be a lie, and firing rebalance() blind would be worse.
    const { reason, detail } = classifyChainError(err);
    logger.error("[chain/keeper] swap receipt unavailable — rebalance not attempted", {
      swapTxHash,
      reason,
      detail,
    });
    return { status: "rebalance_failed", swapTxHash, reason, detail, ...base };
  }

  // ── Step 3: rebalance ────────────────────────────────────────────────────
  try {
    await publicClient.simulateContract({
      address: prep.address,
      abi: DYNAVAULT_ABI,
      functionName: "rebalance",
      account: prep.wallet.account,
    });

    const rebalanceTxHash = await prep.wallet.writeContract({
      address: prep.address,
      abi: DYNAVAULT_ABI,
      functionName: "rebalance",
      chain: baseSepolia,
      account: prep.wallet.account,
    });

    return { status: "sent", swapTxHash, rebalanceTxHash, ...base };
  } catch (err) {
    const { reason, detail } = classifyChainError(err);
    logger.error("[chain/keeper] rebalance failed AFTER swap landed — vault is mid-sequence", {
      swapTxHash,
      reason,
      detail,
    });
    return { status: "rebalance_failed", swapTxHash, reason, detail, ...base };
  }
}
