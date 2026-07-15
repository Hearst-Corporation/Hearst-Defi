import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/require-admin";
import { runBacktest } from "@/lib/engine/backtest";
import { METHODOLOGY_VERSION } from "@/lib/engine/methodology";
import type { BacktestKey, BacktestOutput } from "@/lib/engine/types";
import { logger } from "@/lib/logger";
import { assertRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/backtest/historical?key=<backtest key>
 *
 * ── READ THIS BEFORE TRUSTING THE NUMBERS ────────────────────────────────────
 * The route name says "historical". The data is NOT a replay of recorded market
 * history, and this response says so in `basis`.
 *
 * `runBacktest` (src/lib/engine/backtest.ts) walks a monthly series by linearly
 * interpolating between TWO hand-set endpoints per period (`SPECS`), feeding
 * each step through the rule-based scenario engine. The endpoints are calibrated
 * on real episodes (BTC −65 % over Jun-2022→Jun-2023, hashprice −40 % in 2024,
 * the 2024 halving compression), but the path between them is constructed, not
 * observed. Presenting that as market history would be a lie; presenting it as
 * what it is — a labelled, deterministic, methodology-versioned simulation — is
 * not. Hence `basis.kind = "synthetic_interpolation"` and
 * `basis.provenance = "estimated"`, on every response, unconditionally.
 *
 * ── Why not serve the real backfill instead ──────────────────────────────────
 * The repo does hold ~36 months of daily `MiningMetric` rows (ADR-005 hybrid
 * backfill). They are unusable as ground truth here: ADR-005 reports provenance
 * (`api` | `synthetic`) PER SERIES AT BACKFILL TIME, but the `MiningMetric`
 * table has no source column — once written, a CoinGecko-real BTC price and a
 * deterministic synthetic one are indistinguishable in the DB. Replaying those
 * rows under the word "historical" would fabricate a credibility the data does
 * not have. Persisting per-row provenance is the prerequisite for a genuinely
 * historical backtest; until then, this route serves the engine and names it.
 *
 * Auth: admin only — same gate as `runBacktestAction` (/admin/scenario-lab),
 * which is the only surface exposing this engine today.
 */

/**
 * The keys, with a human label. Typed `Record<BacktestKey, string>` on purpose:
 * adding a member to the `BacktestKey` union breaks the build here instead of
 * silently shipping a key the route rejects at runtime.
 */
const BACKTEST_LABELS: Record<BacktestKey, string> = {
  bear_2022: "Bear market — Jun 2022 to Jun 2023",
  etf_halving_2024: "ETF inflows and 2024 halving — Oct 2023 to Apr 2025",
  mining_crunch_2024: "Mining margin crunch — Apr to Dec 2024",
};

const BACKTEST_KEYS = Object.keys(BACKTEST_LABELS) as [BacktestKey, ...BacktestKey[]];

const QuerySchema = z.object({
  key: z.enum(BACKTEST_KEYS),
});

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

/** Same canonical wording as `engine/vaults.ts` — already compliance-cleared. */
const DISCLAIMER =
  "Outputs are projections, not guaranteed. Past performance does not predict future results.";

const BASIS_NOTE =
  "The monthly series is produced by linear interpolation between two hand-set " +
  "assumption endpoints for the period, each step evaluated by the rule-based " +
  "scenario engine. The endpoints are calibrated on real episodes; the path " +
  "between them is constructed. This is a deterministic simulation, NOT a replay " +
  "of recorded market data.";

interface HistoricalBacktestResponse {
  status: "ok";
  key: BacktestKey;
  label: string;
  basis: {
    kind: "synthetic_interpolation";
    /** Never "live": no market series is replayed here. */
    provenance: "estimated";
    source: string;
    note: string;
  };
  methodologyVersion: string;
  result: BacktestOutput;
  disclaimer: string;
  generatedAt: string;
}

interface BacktestErrorResponse {
  error: string;
  availableKeys?: readonly BacktestKey[];
}

type Response_ = HistoricalBacktestResponse | BacktestErrorResponse;

export async function GET(
  request: NextRequest,
): Promise<NextResponse<Response_>> {
  // Fail-closed: admin gate before any engine work.
  let userId: string;
  try {
    ({ userId } = await requireAdmin());
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    const unauthenticated = message.toLowerCase().includes("authentication required");
    return NextResponse.json(
      { error: unauthenticated ? "Authentication required" : "Admin access required" },
      { status: unauthenticated ? 401 : 403 },
    );
  }

  try {
    await assertRateLimit(
      `backtest-historical:${userId}`,
      RATE_LIMIT_MAX,
      RATE_LIMIT_WINDOW_MS,
    );
  } catch {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const parsed = QuerySchema.safeParse({
    key: request.nextUrl.searchParams.get("key") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid or missing `key`.", availableKeys: BACKTEST_KEYS },
      { status: 400 },
    );
  }

  const key = parsed.data.key;

  try {
    const result = runBacktest(key, { now: new Date() });

    return NextResponse.json({
      status: "ok",
      key,
      label: BACKTEST_LABELS[key],
      basis: {
        kind: "synthetic_interpolation",
        provenance: "estimated",
        source: "src/lib/engine/backtest.ts — SPECS (hand-set endpoints)",
        note: BASIS_NOTE,
      },
      methodologyVersion: METHODOLOGY_VERSION,
      result,
      disclaimer: DISCLAIMER,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    // The engine throws on a forbidden word in its own assumptions, among other
    // invariants. Log it; answer generically.
    logger.error("backtest/historical: engine run failed", { userId, key }, err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
