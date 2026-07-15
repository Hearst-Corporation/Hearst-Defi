import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/require-auth";
import {
  getVaultMode,
  readStrategies,
  type VaultMode,
} from "@/lib/chain/dynavault";
import {
  REASON_NOT_EXPOSED_BY_CONTRACT,
  serializeWired,
  unavailableJson,
  type JsonSafe,
  type WiredJson,
} from "@/lib/chain/wired-json";
import { logger } from "@/lib/logger";
import { assertRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/vault/strategies -- the strategy set with its TARGET allocations.
 *
 * Auth: `requireAuth()` (investor-or-admin, fail-closed). Same reasoning as
 * GET /api/vault -- see that file's header for why `requireInvestor()` cannot
 * be used in a Route Handler.
 *
 * Legacy mode: NOT special-cased here. The adapter already answers
 * `unavailable` / "not_supported_by_legacy" for strategies (the old
 * HearstYieldVault has no strategy concept), and passing that through keeps ONE
 * source of truth for the mode. Re-deriving it from `getVaultMode()` in this
 * route would be a second, silently-divergeable copy of the same rule.
 *
 * ## Why `allocations` is always unavailable today -- READ THIS
 *
 * The brief asked for target allocation + CURRENT allocation + drift. Target is
 * readable (`strategies(index).allocationBps`). Current is not: current =
 * strategyAssets / totalAssets, and the v2.1 ABI transcribed in dynavault.ts
 * exposes NO per-strategy assets read. `getStrategyCount()` and
 * `strategies(index) -> (adapter, allocationBps, enabled, isIdle)` are the whole
 * surface. So current allocation, and therefore drift, are UNCOMPUTABLE from the
 * contract as specified.
 *
 * We ship the field as explicitly `unavailable` rather than omit it: dropping it
 * silently would hide a real gap behind a tidy response, and inventing it (e.g.
 * pro-rating totalAssets by target bps) would report the INTENDED allocation as
 * if it were the OBSERVED one -- fabricated data wearing a provenance badge,
 * which is the one thing this codebase must never do.
 *
 * Unblocking needs one of: (a) the contract exposes per-strategy assets and the
 * adapter reads it, or (b) an accepted off-chain source with its own provenance.
 * Until then this stays honest and visible.
 */

const READS_PER_MINUTE = 60;
const RATE_WINDOW_MS = 60_000;

type StrategiesRead = Awaited<ReturnType<typeof readStrategies>>;
type StrategiesData = Extract<StrategiesRead, { status: "wired" }>["data"];

/** Live allocation vs target, once the data exists. Values are bps as strings. */
export interface StrategyAllocationJson {
  index: number;
  targetBps: string;
  currentBps: string;
  /** current - target. Signed. */
  driftBps: string;
}

export interface StrategiesApiResponse {
  mode: VaultMode;
  /** Adapter, target allocation and flags, straight from the contract. */
  strategies: WiredJson<JsonSafe<StrategiesData>>;
  /** Current allocation + drift. See the header: not computable today. */
  allocations: WiredJson<readonly StrategyAllocationJson[]>;
}

export async function GET(): Promise<
  NextResponse<StrategiesApiResponse | { error: string }>
> {
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
      `vault:strategies:get:${userId}`,
      READS_PER_MINUTE,
      RATE_WINDOW_MS,
    );
  } catch {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const strategies = await readStrategies();

    return NextResponse.json({
      mode: getVaultMode(),
      strategies: serializeWired(strategies),
      allocations: unavailableJson<readonly StrategyAllocationJson[]>(
        REASON_NOT_EXPOSED_BY_CONTRACT,
        "The vault exposes no per-strategy assets read, so current allocation and drift cannot be computed.",
      ),
    });
  } catch (err) {
    logger.error(
      "vault strategies read failed",
      { userId },
      err instanceof Error ? err : undefined,
    );
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
