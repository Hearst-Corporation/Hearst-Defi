import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { logger } from "@/lib/logger";
import { buildAgenticRegistrySnapshot } from "@/lib/agentic/swarm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/agentic/registry
 *
 * Admin-gated, READ-ONLY snapshot of the agentic foundation: agents inventory,
 * crews, swarms, action policies, and safety metadata — all derived from pure
 * typed registries. No DB query, no fetch, no mutation, no prompt/user text, no
 * secrets. Deterministic and JSON-stable; served `no-store`.
 */
export async function GET(): Promise<Response> {
  try {
    await requireAdmin();
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
