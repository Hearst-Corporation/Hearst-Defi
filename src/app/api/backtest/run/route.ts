import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireAuth } from "@/lib/auth/require-auth";
import { assertRateLimit, assertBodySize } from "@/lib/rate-limit";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { runBacktest } from "@/lib/engine/backtest";
import type { BacktestKey, BacktestOutput } from "@/lib/engine/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/backtest/run
 *
 * Exposes the deterministic, pure-function backtest engine to the Scenario
 * Lab UI ("rules vs no-rules" story) and to the Proof Center (historical
 * audit trail).
 *
 * Auth   : DB-backed session via `requireAuth()` (hc_session cookie). 401 otherwise.
 * Limit  : 5 backtests / 60s / userId (heavier compute than scenarios, which
 *          run at 30/min/user — see admin/scenario-lab/actions.ts).
 * Body   : { key: BacktestKey } — Zod-validated.
 * Engine : pure `runBacktest()` — no I/O inside src/lib/engine/*.
 * Persist: a `BacktestRun` row is created (userId + updatedAt are NOT NULL
 *          in the schema; never bypass them for new rows — see V1.d note).
 *
 * Response: 200 { id, output }.
 */

const BACKTEST_RATE_MAX = 5;
const BACKTEST_RATE_WINDOW_MS = 60_000;

const BacktestKeySchema = z.enum([
  "bear_2022",
  "etf_halving_2024",
  "mining_crunch_2024",
] as const);

const BacktestRunRequestSchema = z.object({
  key: BacktestKeySchema,
  // Reserved for the upcoming "rules vs no-rules" comparator. The engine
  // currently ignores this flag (hearstRulesMode is fixed per spec inside
  // backtest.ts SPECS); accepted at the API boundary so the UI can already
  // wire the toggle without a future contract bump.
  compareRules: z.boolean().optional(),
});

export type BacktestRunRequest = z.infer<typeof BacktestRunRequestSchema>;

export interface BacktestRunResponse {
  id: string | null;
  output: BacktestOutput;
}

interface ErrorBody {
  error: string;
  issues?: Array<{ path: string; message: string }>;
}

function jsonError(body: ErrorBody, status: number, extraHeaders?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...(extraHeaders ?? {}) },
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  // 0. Body size guard — prevent DoS via oversized payloads.
  try {
    await assertBodySize(req);
  } catch (sizeErr) {
    return jsonError(
      { error: sizeErr instanceof Error ? sizeErr.message : "Request too large" },
      413,
    );
  }

  // 1. Auth — 401 distinct from any other error path.
  let userId: string;
  try {
    const auth = await requireAuth();
    userId = auth.userId;
  } catch (err) {
    logger.warn(
      "backtest.run auth rejected",
      {},
      err instanceof Error ? err : undefined,
    );
    return jsonError({ error: "Authentication required" }, 401);
  }

  // 2. Per-user rate-limit — heavier compute than the scenario route, so
  //    keep the bucket small (5/min/user). Shared backend = Upstash if set.
  try {
    await assertRateLimit(
      `backtest-run:${userId}`,
      BACKTEST_RATE_MAX,
      BACKTEST_RATE_WINDOW_MS,
    );
  } catch (err) {
    logger.warn("backtest.run rate-limited", { userId }, err instanceof Error ? err : undefined);
    return jsonError(
      { error: "Too many requests — try again in a few moments." },
      429,
      { "Retry-After": String(Math.ceil(BACKTEST_RATE_WINDOW_MS / 1000)) },
    );
  }

  // 3. Parse + validate body BEFORE doing any work.
  let parsed: BacktestRunRequest;
  try {
    const raw: unknown = await req.json();
    const result = BacktestRunRequestSchema.safeParse(raw);
    if (!result.success) {
      return jsonError(
        {
          error: "Invalid request body",
          issues: result.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
        400,
      );
    }
    parsed = result.data;
  } catch {
    return jsonError({ error: "Invalid JSON body" }, 400);
  }

  const key: BacktestKey = parsed.key;

  logger.info("backtest.run.start", { userId, key });

  // 4. Run the pure engine — fixed `now` is unnecessary here; spec dates
  //    drive the simulation. Engine errors surface as 500 with logging.
  let output: BacktestOutput;
  try {
    output = runBacktest(key, { now: new Date() });
  } catch (err) {
    logger.error(
      "backtest.run.engine_failed",
      { userId, key },
      err instanceof Error ? err : undefined,
    );
    return jsonError({ error: "Backtest engine error" }, 500);
  }

  // 5. Persist the run. userId + updatedAt are required for new rows
  //    (see V1.d note about legacy NULL rows — do not relax this).
  //    A persistence failure must not lose the engine result; we log
  //    and still return the computed output with id=null.
  let runId: string | null = null;
  try {
    const created = await prisma.backtestRun.create({
      data: {
        userId,
        backtestKey: key,
        initialCapital: output.initialCapital,
        rulesMode: output.hearstRulesMode ? "hearst_rules" : "without_rules",
        endingValue: output.endingValue,
        totalReturnPct: output.totalReturnPct,
        maxDrawdownPct: output.maxDrawdownPct,
        worstMonthPct: output.worstMonthPct,
        numRebalances: output.numRebalances,
        monthlySeries: JSON.stringify(output.monthlySeries),
      },
      select: { id: true },
    });
    runId = created.id;
  } catch (persistErr) {
    logger.warn(
      "backtest.run.persist_failed",
      { userId, key },
      persistErr instanceof Error ? persistErr : undefined,
    );
  }

  logger.info("backtest.run.success", { userId, runId, key });

  const body: BacktestRunResponse = { id: runId, output };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
