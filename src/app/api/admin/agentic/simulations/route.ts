import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { logger } from "@/lib/logger";
import { assertRateLimit } from "@/lib/rate-limit";
import {
  readSimulationTraces,
  SIMULATION_TRACES_CAP,
} from "@/lib/agentic/observability/simulation-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;
const READ_RATE_MAX = 60;
const READ_RATE_WINDOW_MS = 60_000;

/**
 * GET /api/admin/agentic/simulations?limit=N
 *
 * Admin-gated, READ-ONLY list of recent agentic simulation traces (metadata
 * only — no prompt / user text / payload / secrets). Served `no-store`. The
 * store is Redis-capped + in-memory (no DB); if it is empty the list is empty.
 * `limit` is clamped to [1, SIMULATION_TRACES_CAP]. Read rate-limited per admin.
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
      `agentic-simulations:${userId}`,
      READ_RATE_MAX,
      READ_RATE_WINDOW_MS,
    );
  } catch {
    return NextResponse.json(
      { error: "Too many requests — try again in a moment." },
      { status: 429 },
    );
  }

  let limit = DEFAULT_LIMIT;
  const rawLimit = new URL(request.url).searchParams.get("limit");
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

  try {
    const traces = await readSimulationTraces(limit);
    return NextResponse.json(
      { traces, count: traces.length, metadataOnly: true as const },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    logger.warn(
      "agentic simulations read route failed",
      {},
      err instanceof Error ? err : undefined,
    );
    return NextResponse.json(
      { error: "Simulation traces unavailable" },
      { status: 500 },
    );
  }
}
