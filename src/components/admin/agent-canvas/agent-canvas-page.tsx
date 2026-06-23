import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { CanvasLive } from "@/components/admin/agent-canvas/canvas-live";
import { isCanvasId } from "@/lib/canvas/contract";
import { composeCanvasState } from "@/lib/canvas/compose";
import { getCanvasDefinition, isAdminCanvas } from "@/lib/canvas/registry";
import { getSession } from "@/lib/auth/session";
import { FEATURE_FLAGS } from "@/lib/feature-flags";

const MAX_OBJECTIVE_LEN = 220;

function sanitizeObjective(raw: string | undefined): string | undefined {
  const cleaned = raw?.replace(/[\x00-\x1F\x7F]/g, "").trim();
  return cleaned ? cleaned.slice(0, MAX_OBJECTIVE_LEN) : undefined;
}

/**
 * Shared Agent Canvas page body, mounted by both route entries:
 *  - /admin/agent-canvas/[canvasId]  (admin canvases; admin layout gate)
 *  - /agent-canvas/[canvasId]        (LP read-only canvas; auth gate via proxy)
 *
 * Role gate (server, authoritative): unknown id → 404; an admin-audience canvas
 * requested by a non-admin → 404. Mounts <CanvasLive> with a server-composed
 * initial state so a plain refresh shows content; live agent frames arrive over
 * the `cockpit:canvas-state` channel during a chat answer.
 */
export async function AgentCanvasPageBody({
  canvasId,
  searchParams,
}: {
  canvasId: string;
  searchParams: { autostart?: string; objective?: string };
}) {
  if (!isCanvasId(canvasId)) notFound();

  const session = await getSession();
  if (!session) notFound();
  if (isAdminCanvas(canvasId) && session.role !== "admin") notFound();

  const objective = sanitizeObjective(searchParams.objective) ?? null;
  const autostart = searchParams.autostart === "1";
  const agentLive = FEATURE_FLAGS.CHAT_MASTER_AGENT;
  const def = getCanvasDefinition(canvasId);

  const initialState = autostart
    ? null
    : composeCanvasState({
        canvasId,
        ...(objective ? { objective } : {}),
        revision: 1,
        agentLive,
      });

  return (
    <div className="ct-page-area">
      <AdminPageHeader title={def.title} eyebrow="Agent workspace" />
      <CanvasLive
        canvasId={canvasId}
        initialState={initialState}
        objective={objective}
        autostart={autostart}
      />
    </div>
  );
}
