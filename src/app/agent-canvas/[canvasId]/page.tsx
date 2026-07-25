import { AgentCanvasPageBody } from "@/components/admin/agent-canvas/agent-canvas-page";

export const dynamic = "force-dynamic";

interface AgentCanvasPageProps {
  params: Promise<{ canvasId: string }>;
  searchParams: Promise<{ autostart?: string; objective?: string }>;
}

/**
 * LP / general entry for the Agent Canvas (outside /admin so an investor can
 * reach the read-only canvas). The shared body enforces the audience gate.
 */
export default async function AgentCanvasPage({
  params,
  searchParams,
}: AgentCanvasPageProps) {
  const { canvasId } = await params;
  const sp = await searchParams;
  return <AgentCanvasPageBody canvasId={canvasId} searchParams={sp} />;
}
