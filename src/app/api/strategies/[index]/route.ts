import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAuth } from "@/lib/auth/require-auth";
import {
  getVaultMode,
  readStrategies,
  type StrategyInfo,
  type VaultMode,
} from "@/lib/chain/dynavault";
import {
  derivedFrom,
  jsonSafe,
  REASON_NOT_EXPOSED_BY_CONTRACT,
  unavailableJson,
  type JsonSafe,
  type WiredJson,
} from "@/lib/chain/wired-json";
import { logger } from "@/lib/logger";
import { assertRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/strategies/[index] -- one strategy's detail.
 *
 * Auth: `requireAuth()` (investor-or-admin, fail-closed). Same reasoning as
 * GET /api/vault -- see that file's header for why `requireInvestor()` cannot be
 * used in a Route Handler.
 *
 * ## ONE read -- there is no `readStrategyCount()`
 *
 * The adapter exposes no standalone count: `readStrategies()` returns
 * `Wired<StrategyInfo[]>`, so the authoritative bound is `.data.length` and the
 * requested row is ALREADY in that array. Calling `readStrategy(index)` after it
 * would re-read a row we are holding, over a second RPC round trip, at a
 * different instant -- a torn read whose envelope would then contradict the
 * bound it was checked against. `readStrategies()` enumerates at most
 * MAX_STRATEGIES (32, hard-capped in the adapter: no unbounded loop), so serving
 * one row from the full read is bounded and strictly cheaper than count + row.
 *
 * The selected row is therefore wrapped with `derivedFrom(...)`: it reuses the
 * provenance of the read it came out of, which is precisely where it was read.
 *
 * ## Bounds
 *
 * Two distinct failures, two distinct codes:
 *  - malformed segment ("abc", "-1", "1.5", "") -> 400, before any RPC;
 *  - well-formed but past the on-chain count ("7" of 3) -> 404: the request is
 *    fine, the resource does not exist.
 *
 * Legacy mode: not special-cased. `readStrategies()` already answers
 * `unavailable` / "not_supported_by_legacy", which this route propagates. One
 * source of truth for the mode.
 *
 * `assets` and `isIdle`: the brief asked for both; the v2.1 ABI provides
 * neither. There is no per-strategy assets read at all (see
 * /api/vault/strategies for the full argument). `isIdle` is tempting to derive
 * as `!enabled`, but dynavault.ts flags the two booleans in the `strategies`
 * tuple as UNCONFIRMED guesses at the component names -- deriving a product
 * signal from a guessed field name would be a guess on top of a guess, and it
 * would look authoritative. Both ship as explicitly `unavailable`.
 */

const READS_PER_MINUTE = 60;
const RATE_WINDOW_MS = 60_000;

/**
 * Cheap syntactic ceiling, applied BEFORE any RPC so an absurd index (e.g.
 * 10^20) costs no network call. Deliberately generous rather than mirroring
 * MAX_STRATEGIES (32, not exported by dynavault.ts): a tight copy here would
 * silently 400 a legitimate strategy the day that cap is raised. The
 * AUTHORITATIVE bound is the length of `readStrategies()` below.
 */
const MAX_STRATEGY_INDEX = 1_000;

/**
 * Route params are strings. `z.coerce.number()` is WRONG here: `Number("")` is
 * 0, so an empty segment would validate as strategy 0. Match the digits first,
 * then convert -- this rejects "", "-1", "1.5", " 1", "0x0" and "1e3".
 */
const IndexParamSchema = z
  .string()
  .regex(/^\d+$/, "Strategy index must be a non-negative integer.")
  .transform((raw) => Number(raw))
  .pipe(z.number().int().max(MAX_STRATEGY_INDEX));

export interface StrategyApiResponse {
  mode: VaultMode;
  index: number;
  /** Adapter address, target allocationBps and flags. */
  strategy: WiredJson<JsonSafe<StrategyInfo>>;
  /** Assets held by this strategy, asset units as a string. See header. */
  assets: WiredJson<string>;
  /** See header. */
  isIdle: WiredJson<boolean>;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ index: string }> },
): Promise<NextResponse<StrategyApiResponse | { error: string }>> {
  let userId: string;
  try {
    ({ userId } = await requireAuth());
  } catch {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  try {
    await assertRateLimit(
      `strategies:get:${userId}`,
      READS_PER_MINUTE,
      RATE_WINDOW_MS,
    );
  } catch {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const { index: rawIndex } = await params;
  const parsed = IndexParamSchema.safeParse(rawIndex);
  if (!parsed.success) {
    // Generic message: the schema's own text is safe, but keeping the shape
    // uniform means no validator internals ever leak by accident.
    return NextResponse.json(
      { error: "Invalid strategy index" },
      { status: 400 },
    );
  }
  const index = parsed.data;

  try {
    const strategies = await readStrategies();

    // Bound unknown -> do NOT answer 404: that would assert the strategy does
    // not exist, which we cannot know. Propagate the real motive (rpc_error vs
    // not_supported_by_legacy) instead -- the caller's input may well be fine;
    // it is the chain read that failed.
    if (strategies.status === "unavailable") {
      return NextResponse.json({
        mode: getVaultMode(),
        index,
        strategy: unavailableJson<JsonSafe<StrategyInfo>>(
          strategies.reason,
          strategies.detail,
        ),
        assets: unavailableJson<string>(strategies.reason, strategies.detail),
        isIdle: unavailableJson<boolean>(strategies.reason, strategies.detail),
      });
    }

    // THE authoritative bound: absent from the array the contract just returned
    // means the strategy does not exist. (This is also the check that satisfies
    // `noUncheckedIndexedAccess` -- the two are the same fact.)
    const row = strategies.data[index];
    if (row === undefined) {
      return NextResponse.json(
        { error: "Strategy not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      mode: getVaultMode(),
      index,
      // Same read, same instant, same address: the envelope is exact.
      strategy: derivedFrom(strategies, jsonSafe(row)),
      assets: unavailableJson<string>(
        REASON_NOT_EXPOSED_BY_CONTRACT,
        "The vault exposes no per-strategy assets read.",
      ),
      isIdle: unavailableJson<boolean>(
        REASON_NOT_EXPOSED_BY_CONTRACT,
        "The vault exposes no idle flag; the strategy tuple's booleans are unconfirmed.",
      ),
    });
  } catch (err) {
    logger.error(
      "strategy read failed",
      { userId, index },
      err instanceof Error ? err : undefined,
    );
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
