import { redirect } from "next/navigation";

/**
 * Bare /admin/agent-canvas has no workspace to show: a canvas only exists as
 * /admin/agent-canvas/[canvasId], opened by an agent action with an id.
 * Keyword navigation can land here without an id — send it somewhere real
 * instead of a 404.
 */
export default function AdminAgentCanvasIndexPage() {
  redirect("/admin/dashboard");
}
