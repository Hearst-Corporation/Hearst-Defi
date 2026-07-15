import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  auditKeeperAttempt,
  clientReason,
  guardKeeperRequest,
  keeperError,
  readJsonBody,
} from "@/lib/chain/keeper-guard";
import { executeRebalance } from "@/lib/chain/keeper";
import { logger } from "@/lib/logger";

/**
 * POST /api/rebalancing/execute
 *
 * `swapAndReport(address tokenIn, uint256 amountIn, address tokenOut,
 *                uint256 minAmountOut, address target, bytes32[] swapData)`
 * then `rebalance()`.
 *
 * That signature is the socle's (`src/lib/chain/dynavault.ts`), and `amountIn`
 * sits at position 1 — BETWEEN the two tokens. This header once documented the
 * order as `(tokenIn, tokenOut, amountIn, …)`, which matched the transposed call
 * the keeper was making rather than the contract. **This route's JSON body names
 * its fields, so the wire format is order-independent**; the positional mapping
 * happens exactly once, in `executeRebalance` (`src/lib/chain/keeper.ts`), where
 * a test locks it. Do not re-derive that order here.
 *
 * ⚠️ THIS ROUTE MOVES FUNDS.
 *
 * ADR-006, "Explicitly still forbidden": *"Auto-execution of rebalances stays
 * forbidden for now. Rebalancing remains PTAI (Projection → Trigger → Action →
 * Impact) and human-approved."* The word that matters is AUTO. This route is
 * human-approved by construction: `requireAdmin()` resolves a database-backed
 * session cookie, which a cron or an agent process does not have and cannot
 * mint. **Do not add a service-token or signed-webhook bypass to this route** —
 * that bypass IS the auto-execution ADR-006 forbids.
 *
 * ⚠️ NOT ATOMIC. Two transactions, no on-chain bracket. The swap can land while
 * the rebalance fails, and no rollback exists. That half-done state is reported
 * as `rebalance_failed` WITH the swap hash (HTTP 502) rather than being
 * flattened into "it failed" — see `executeRebalance` in
 * `src/lib/chain/keeper.ts`.
 *
 * ⚠️ `swapData: bytes32[]` is UNCONFIRMED. The v2.1 spec types it that way, and
 * `docs/CONTRACT_REPLACEMENT_CARTOGRAPHY_2026-07-15.md` §10.4 point 2 says
 * calldata as `bytes32[]` "is very probably a `bytes` in disguise — confirm
 * before writing the client". If it turns out to be `bytes`, the fix is a
 * one-line ABI change in `src/lib/chain/dynavault.ts` plus this schema; the
 * mismatch surfaces as a loud decode/simulate failure, never as a silent
 * mis-encode.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Human-approved, occasional. Not a hot path. */
const RATE_MAX = 5;

/** Largest uint256, as a decimal string: exactly 78 digits. */
const UINT256_MAX = 2n ** 256n - 1n;
const UINT256_MAX_DIGITS = 78;

/** Defensive ceiling on the swap calldata array — never an unbounded list. */
const MAX_SWAP_DATA_WORDS = 64;

/**
 * `z.custom` yields viem's `0x${string}` template-literal type directly, so the
 * validated value flows into `writeContract` with no `as` cast anywhere.
 */
const EvmAddressSchema = z.custom<`0x${string}`>(
  (value) => typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value),
  { message: "must be a 0x-prefixed 40-hex EVM address" },
);

const Bytes32Schema = z.custom<`0x${string}`>(
  (value) => typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value),
  { message: "must be a 0x-prefixed 32-byte hex word" },
);

/**
 * `BigInt()` THROWS on a non-numeric string, and Zod 4 does NOT short-circuit:
 * a `.refine()` still runs after a preceding `.regex()` has already failed. So a
 * naive `.refine((v) => BigInt(v) <= MAX)` turns `amountIn: "1.5"` into a raw
 * SyntaxError that escapes `safeParse` entirely — a 500 where a 400 belongs.
 * Every refine below therefore parses defensively and is total.
 */
function toBigIntOrNull(value: string): bigint | null {
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

/**
 * Base-unit amounts arrive as decimal STRINGS and become `bigint` — never
 * `number`. A uint256 does not survive a double: `2^53` is the last exact
 * integer, and USDC base units blow past that at ~9.007e9 USDC.
 *
 * Order of the checks matters: `.max(78)` caps the LENGTH before `BigInt()` ever
 * sees the string, so a megabyte of digits cannot be turned into a bignum.
 * The regex pins canonical form (no `+`, no `-`, no leading zeros, no `0x`, no
 * exponent, no whitespace).
 */
const Uint256StringSchema = z
  .string()
  .regex(/^(0|[1-9][0-9]*)$/, "must be a base-10 integer string in base units")
  .max(UINT256_MAX_DIGITS, "far exceeds the uint256 range")
  .refine((value) => {
    const parsed = toBigIntOrNull(value);
    return parsed !== null && parsed <= UINT256_MAX;
  }, "exceeds the uint256 range");

const ExecuteRebalanceSchema = z
  .object({
    tokenIn: EvmAddressSchema,
    tokenOut: EvmAddressSchema,
    amountIn: Uint256StringSchema.refine((value) => {
      const parsed = toBigIntOrNull(value);
      return parsed !== null && parsed > 0n;
    }, "amountIn must be greater than zero"),
    minAmountOut: Uint256StringSchema,
    router: EvmAddressSchema,
    swapData: z
      .array(Bytes32Schema)
      .max(MAX_SWAP_DATA_WORDS, "swapData is too long"),
  })
  .strict()
  .refine((value) => value.tokenIn.toLowerCase() !== value.tokenOut.toLowerCase(), {
    message: "tokenIn and tokenOut must differ",
    path: ["tokenOut"],
  });

export async function POST(request: NextRequest): Promise<Response> {
  const guard = await guardKeeperRequest(request, "keeper:rebalance", RATE_MAX);
  if (!guard.ok) return guard.response;

  const body = await readJsonBody(request);
  if (!body.ok) return keeperError("invalid_body");

  const parsed = ExecuteRebalanceSchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request body.",
        reason: "invalid_body",
        issues: z.flattenError(parsed.error),
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Named fields, mapped by name — the ABI's positional order is applied once,
  // inside `executeRebalance`, and nowhere else.
  const input = parsed.data;
  const result = await executeRebalance({
    tokenIn: input.tokenIn,
    tokenOut: input.tokenOut,
    amountIn: BigInt(input.amountIn),
    minAmountOut: BigInt(input.minAmountOut),
    router: input.router,
    swapData: input.swapData,
  });

  // Nothing reached the chain — no audit row, only a log (see auditKeeperAttempt).
  if (result.status === "blocked") {
    logger.warn("[keeper] executeRebalance blocked", {
      userId: guard.admin.userId,
      reason: result.reason,
      detail: result.detail,
    });
    return keeperError(clientReason(result.reason));
  }

  // Everything below LANDED a transaction, so every branch is audited — including
  // the failures. A swap that moved funds must never be an unaudited event.
  const auditBase = {
    admin: guard.admin,
    action: "keeper.executeRebalance",
    entityId: result.address,
    request,
  };

  const requested = {
    tokenIn: input.tokenIn,
    tokenOut: input.tokenOut,
    amountIn: input.amountIn,
    minAmountOut: input.minAmountOut,
    router: input.router,
  };

  if (result.status === "swap_reverted") {
    await auditKeeperAttempt({
      ...auditBase,
      after: {
        outcome: "swap_reverted",
        swapTxHash: result.swapTxHash,
        chainId: result.chainId,
        ...requested,
      },
    });
    logger.error("[keeper] executeRebalance: swap mined but reverted", {
      userId: guard.admin.userId,
      swapTxHash: result.swapTxHash,
    });
    return keeperError("swap_reverted", { swapTxHash: result.swapTxHash });
  }

  if (result.status === "rebalance_failed") {
    await auditKeeperAttempt({
      ...auditBase,
      after: {
        outcome: "rebalance_failed",
        swapTxHash: result.swapTxHash,
        reason: result.reason,
        chainId: result.chainId,
        ...requested,
      },
    });
    logger.error(
      "[keeper] executeRebalance: swap landed, rebalance did not — vault mid-sequence",
      {
        userId: guard.admin.userId,
        swapTxHash: result.swapTxHash,
        reason: result.reason,
        detail: result.detail,
      },
    );
    return keeperError("rebalance_failed", { swapTxHash: result.swapTxHash });
  }

  await auditKeeperAttempt({
    ...auditBase,
    after: {
      outcome: "sent",
      swapTxHash: result.swapTxHash,
      rebalanceTxHash: result.rebalanceTxHash,
      chainId: result.chainId,
      ...requested,
    },
  });

  logger.info("[keeper] executeRebalance sent — funds moved", {
    userId: guard.admin.userId,
    swapTxHash: result.swapTxHash,
    rebalanceTxHash: result.rebalanceTxHash,
  });

  return NextResponse.json(result, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
