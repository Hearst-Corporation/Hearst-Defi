import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { logger } from "@/lib/logger";
import { assertRateLimit } from "@/lib/rate-limit";
import { buildAgenticRegistrySnapshot } from "@/lib/agentic/swarm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const READ_RATE_MAX = 60;
const READ_RATE_WINDOW_MS = 60_000;

/**
 * GET /api/admin/agentic/registry
 *
 * Admin-gated, READ-ONLY snapshot of the agentic foundation: agents inventory,
 * crews, swarms, action policies, and safety metadata — all derived from pure
 * typed registries. No DB query, no fetch, no mutation, no prompt/user text, no
 * secrets. Deterministic and JSON-stable; served `no-store`. Read rate-limited
 * per admin (defence against a leaked admin session / accidental hammering).
 */
export async function GET(): Promise<Response> {
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
      `agentic-registry:${userId}`,
      READ_RATE_MAX,
      READ_RATE_WINDOW_MS,
    );
  } catch {
    return NextResponse.json(
      { error: "Too many requests — try again in a moment." },
      { status: 429 },
    );
  }

  try {
    const snapshot = buildAgenticRegistrySnapshot();
    return NextResponse.json(
      { snapshot, sideEffects: false as const },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    logger.warn(
      "agentic registry route failed",
      {},
      err instanceof Error ? err : undefined,
    );
    return NextResponse.json(
      { error: "Agentic registry unavailable" },
      { status: 500 },
    );
  }
}
