import { AgentCanvasPageBody } from "@/components/admin/agent-canvas/agent-canvas-page";

export const dynamic = "force-dynamic";

/**
 * LP / general entry for the Agent Canvas (outside /admin so an investor can
 * reach the read-only canvas). The shared body enforces the audience gate: an
 * admin-only canvas requested here by a non-admin 404s.
 */
export default async function AgentCanvasPage({
  params,
  searchParams,
}: {
  params: Promise<{ canvasId: string }>;
  searchParams: Promise<{ autostart?: string; objective?: string }>;
}) {
  const { canvasId } = await params;
  const sp = await searchParams;
  return <AgentCanvasPageBody canvasId={canvasId} searchParams={sp} />;
}
