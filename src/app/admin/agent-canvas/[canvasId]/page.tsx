import { AgentCanvasPageBody } from "@/components/admin/agent-canvas/agent-canvas-page";

export const dynamic = "force-dynamic";

export interface AgentCanvasPageProps {
  params: Promise<{ canvasId: string }>;
  searchParams: Promise<{ autostart?: string; objective?: string }>;
}

export async function AgentCanvasPageImpl({
  params,
  searchParams,
}: AgentCanvasPageProps) {
  const { canvasId } = await params;
  const sp = await searchParams;
  return <AgentCanvasPageBody canvasId={canvasId} searchParams={sp} />;
}

/**
 * Admin entry for the Agent Canvas. Lives under /admin so the admin layout gate
 * (role !== "admin" → notFound) applies for free; the shared body adds the
 * per-canvas audience check (defense in depth).
 */
export default async function AdminAgentCanvasPage(props: AgentCanvasPageProps) {
  return <AgentCanvasPageImpl {...props} />;
}
