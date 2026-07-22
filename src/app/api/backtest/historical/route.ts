import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { assertRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/backtest/historical
 *
 * VAULT_SPEC_V2.1.md §5 lists this endpoint as "Résultats de backtest
 * historique". The v2.1 contract has no backtest function — this is an
 * applicative computation (`BacktestRunner`, src/lib/strategy-data-lab/), not a
 * chain read, so it never touches `src/lib/chain/dynavault.ts`.
 *
 * ── Why this returns `unavailable`, not a fixture ────────────────────────────
 * `BacktestRun` (prisma/schema.prisma) persists PER-USER runs the scenario
 * engine used to write. That engine was retired 2026-07-16 (docs memory: scenario
 * lab removed) and the table has been empty ever since — verified below, not
 * assumed. Rather than fabricate a "historical" dataset that never existed, this
 * route queries the real table for the caller's own rows and reports honestly:
 * rows found → returned; none found → `unavailable` / `not_available` with the
 * reason spelled out, never a 404 and never a synthetic series.
 *
 * Auth: any authenticated session (matches the other read-only vault/product
 * routes — requireAuth, not requireAdmin). Scoped to the caller's own runs only.
 */

const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;

type BacktestRunDto = {
  id: string;
  backtestKey: string;
  ranAt: string;
  rulesMode: string;
  initialCapital: string;
  endingValue: string;
  totalReturnPct: string;
  maxDrawdownPct: string;
  worstMonthPct: string;
  numRebalances: number;
};

type HistoricalBacktestResponse =
  | { status: "available"; runs: BacktestRunDto[] }
  | { status: "unavailable"; reason: string }
  | { error: string };

export async function GET(): Promise<Response> {
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
      `backtest-historical:${userId}`,
      RATE_LIMIT_MAX,
      RATE_LIMIT_WINDOW_MS,
    );
  } catch {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const rows = await prisma.backtestRun.findMany({
      where: { userId },
      orderBy: { ranAt: "desc" },
      take: 50,
    });

    if (rows.length === 0) {
      const body: HistoricalBacktestResponse = {
        status: "unavailable",
        reason: "not_available",
      };
      return NextResponse.json(body, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    const runs: BacktestRunDto[] = rows.map((row) => ({
      id: row.id,
      backtestKey: row.backtestKey,
      ranAt: row.ranAt.toISOString(),
      rulesMode: row.rulesMode,
      initialCapital: row.initialCapital.toString(),
      endingValue: row.endingValue.toString(),
      totalReturnPct: row.totalReturnPct.toString(),
      maxDrawdownPct: row.maxDrawdownPct.toString(),
      worstMonthPct: row.worstMonthPct.toString(),
      numRebalances: row.numRebalances,
    }));

    const body: HistoricalBacktestResponse = { status: "available", runs };
    return NextResponse.json(body, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    logger.error(
      "backtest/historical: query failed",
      {},
      err instanceof Error ? err : undefined,
    );
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
