import { AgentCanvasPageImpl, type AgentCanvasPageProps } from "@/app/admin/agent-canvas/[canvasId]/page";

export const dynamic = "force-dynamic";

/**
 * LP / general entry for the Agent Canvas (outside /admin so an investor can
 * reach the read-only canvas). The shared body enforces the audience gate: an
 * admin-only canvas requested here by a non-admin 404s.
 */
export default async function AgentCanvasPage(props: AgentCanvasPageProps) {
  return <AgentCanvasPageImpl {...props} />;
}
