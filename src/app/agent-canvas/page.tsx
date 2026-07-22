import { redirect } from "next/navigation";

/**
 * Bare /agent-canvas has no workspace to show: a canvas only exists as
 * /agent-canvas/[canvasId], opened by the chat's canvas flow with an id.
 * Keyword navigation can land here without an id — send it somewhere real
 * instead of a 404.
 */
export default function AgentCanvasIndexPage() {
  redirect("/dashboard");
}
