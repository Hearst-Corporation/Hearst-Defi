import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { getRedis } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CheckStatus = "ok" | "error";

interface DeepHealthResponse {
  status: "ok" | "degraded";
  checks: {
    db: CheckStatus;
    redis: CheckStatus | "unconfigured";
  };
}

/**
 * GET /api/health/deep
 *
 * Readiness probe — verifies that critical dependencies are reachable before
 * the instance accepts traffic. Returns 200 when all critical checks pass, 503
 * when any critical check fails (DB is critical; Redis is critical when
 * configured, unconfigured is a non-critical degraded state).
 *
 * Distinct from /api/health (liveness) which never hits the DB.
 */
export async function GET(): Promise<NextResponse<DeepHealthResponse>> {
  // ── DB check ────────────────────────────────────────────────────────────────
  let dbStatus: CheckStatus = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = "error";
  }

  // ── Redis check ─────────────────────────────────────────────────────────────
  let redisStatus: CheckStatus | "unconfigured" = "unconfigured";
  const redis = getRedis();
  if (redis !== null) {
    try {
      await redis.ping();
      redisStatus = "ok";
    } catch {
      redisStatus = "error";
    }
  }

  // ── Aggregate ───────────────────────────────────────────────────────────────
  const criticalFailure =
    dbStatus === "error" ||
    redisStatus === "error";

  const status = criticalFailure ? "degraded" : "ok";
  const httpStatus = criticalFailure ? 503 : 200;

  return NextResponse.json(
    { status, checks: { db: dbStatus, redis: redisStatus } },
    { status: httpStatus },
  );
}
