import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { logger } from "@/lib/logger";
import { assertRateLimit } from "@/lib/rate-limit";
import {
  readSimulationTraces,
  SIMULATION_TRACES_CAP,
} from "@/lib/agentic/observability/simulation-store";
import {
  aggregateAgenticSimulationTraces,
  parseSimulationWindow,
} from "@/lib/agentic/observability/simulation-aggregates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = SIMULATION_TRACES_CAP;
const READ_RATE_MAX = 60;
const READ_RATE_WINDOW_MS = 60_000;

/** Empty, safe aggregate shape used when the store is unavailable. */
function emptyAggregates(requested: "1h" | "24h" | "7d" | "all") {
  return {
    window: { requested, traceCount: 0 },
    totals: {
      simulations: 0,
      blocked: 0,
      gates: 0,
      confirmations: 0,
      recordedWithReadiness: 0,
    },
    bySwarm: [],
    byMode: [],
    byReadinessOutcome: [],
    topReasonCodes: [],
    metadataOnly: true as const,
  };
}

/**
 * GET /api/admin/agentic/simulations/aggregates?limit=N&window=1h|24h|7d|all
 *
 * Admin-gated, READ-ONLY metadata-only aggregates over the recorded simulation
 * traces. Served `no-store`. Reads the existing Redis-capped + in-memory store
 * (no DB, no mutation) and rolls up in memory. `limit` is clamped to
 * [1, SIMULATION_TRACES_CAP]; `window` defaults to `all`. If the store is
 * unavailable, returns a safe empty aggregate with `available:false` — never a
 * stack trace or secret.
 */
export async function GET(request: NextRequest): Promise<Response> {
  let userId: string;
  try {
    const auth = await requireAdmin();
    userId = auth.userId;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Admin access required";
    const isAuthRequired = message
      .toLowerCase()
      .includes("authentication required");
    return NextResponse.json(
      { error: message },
      { status: isAuthRequired ? 401 : 403 },
    );
  }

  try {
    await assertRateLimit(
      `agentic-aggregates:${userId}`,
      READ_RATE_MAX,
      READ_RATE_WINDOW_MS,
    );
  } catch {
    return NextResponse.json(
      { error: "Too many requests — try again in a moment." },
      { status: 429 },
    );
  }

  const params = new URL(request.url).searchParams;

  // limit
  let limit = DEFAULT_LIMIT;
  const rawLimit = params.get("limit");
  if (rawLimit !== null) {
    const parsed = Number(rawLimit);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return NextResponse.json(
        { error: "limit must be a positive integer" },
        { status: 400 },
      );
    }
    limit = Math.min(Math.floor(parsed), SIMULATION_TRACES_CAP);
  }

  // window
  const window = parseSimulationWindow(params.get("window"));
  if (window === undefined) {
    return NextResponse.json(
      { error: "window must be one of: 1h, 24h, 7d, all" },
      { status: 400 },
    );
  }

  try {
    const traces = await readSimulationTraces(limit);
    const aggregates = aggregateAgenticSimulationTraces(traces, {
      window,
      nowMs: Date.now(),
    });
    return NextResponse.json(
      { available: true as const, aggregates },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    // Controlled, safe response — no stack trace, no secret leaked.
    logger.warn(
      "agentic simulation aggregates route failed",
      {},
      err instanceof Error ? err : undefined,
    );
    return NextResponse.json(
      { available: false as const, reason: "store_unavailable", aggregates: emptyAggregates(window) },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
