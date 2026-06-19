import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { loadAgentGraphViews } from "@/lib/data/agent-graph";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Live agent orchestration graph (all views), polled by the client canvas for
 * auto-refresh. Admin-gated. Read-only: returns the static topology of each view
 * with every node's live state + recent runtime samples, derived from LlmRun
 * (LLM surfaces) and AdminToolRun (bounded tools).
 */
export async function GET(): Promise<Response> {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  try {
    const graph = await loadAgentGraphViews();
    return NextResponse.json(graph, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    logger.warn(
      "agent graph route failed",
      {},
      err instanceof Error ? err : undefined,
    );
    return NextResponse.json({ error: "Graph unavailable" }, { status: 500 });
  }
}
