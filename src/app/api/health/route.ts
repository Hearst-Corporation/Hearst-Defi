import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health
 *
 * Lightweight liveness probe. No DB query, no auth, no external calls — it just
 * confirms the Next.js server is up and serving routes. Always fresh
 * (force-dynamic) so caches never report a stale "ok".
 */
export async function GET(): Promise<NextResponse<{ status: "ok" }>> {
  return NextResponse.json({ status: "ok" });
}
