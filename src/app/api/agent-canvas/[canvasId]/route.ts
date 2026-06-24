import { NextResponse } from "next/server";

import { isCanvasId } from "@/lib/canvas/contract";
import {
  composeCanvasState,
  deriveOutreachValuesFromObjective,
} from "@/lib/canvas/compose";
import { isAdminCanvas } from "@/lib/canvas/registry";
import { getSession } from "@/lib/auth/session";
import { FEATURE_FLAGS } from "@/lib/feature-flags";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_OBJECTIVE_LEN = 220;

function sanitizeObjective(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const cleaned = raw.replace(/[\x00-\x1F\x7F]/g, "").trim();
  return cleaned ? cleaned.slice(0, MAX_OBJECTIVE_LEN) : undefined;
}

/**
 * Degraded initial-fill for the agent canvas. The canonical live path is the
 * in-band `canvas_state` stream re-broadcast during a chat answer; this POST is
 * the fallback `<CanvasLive>` uses on autostart when no frame has arrived.
 *
 * Same role gate as the page: unknown id → 404; admin canvas requested by a
 * non-admin → 404. Returns a server-composed `CanvasState`. No mutation here —
 * writes only ever go through the two-step token on /api/admin/chat-tools.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ canvasId: string }> },
): Promise<Response> {
  const { canvasId } = await ctx.params;
  if (!isCanvasId(canvasId)) {
    return NextResponse.json({ error: "Unknown canvas" }, { status: 404 });
  }

  let role: string | null = null;
  try {
    const session = await getSession();
    role = session?.role ?? null;
  } catch {
    role = null;
  }
  if (!role) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (isAdminCanvas(canvasId) && role !== "admin") {
    // 404 (not 403) — same posture as the admin layout: hide existence.
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let objective: string | undefined;
  try {
    const body = (await req.json().catch(() => null)) as { objective?: unknown } | null;
    objective = sanitizeObjective(body?.objective);
  } catch {
    objective = undefined;
  }

  // WIRE-1: on the degraded autostart fallback we only have the URL `objective`,
  // not the agent-extracted values the live stream path passes. Derive the
  // outreach campaign name/kind from the objective (regex, no LLM) so the
  // recomposed `create_campaign_draft` proposal keeps the operator's name/kind
  // across a remount — otherwise the action button rebuilt here would carry an
  // empty name and the canvas would look blank. Outreach-only; other canvases
  // get no values (their proposals don't depend on free-text fields).
  const values =
    canvasId === "outreach"
      ? deriveOutreachValuesFromObjective(objective)
      : undefined;

  try {
    const state = composeCanvasState({
      canvasId,
      ...(objective ? { objective } : {}),
      revision: 1,
      agentLive: FEATURE_FLAGS.CHAT_MASTER_AGENT,
      ...(values ? { values } : {}),
    });
    return NextResponse.json(state);
  } catch (err) {
    logger.warn(
      "agent-canvas compose failed",
      { canvasId },
      err instanceof Error ? err : undefined,
    );
    return NextResponse.json({ error: "Compose failed" }, { status: 500 });
  }
}
