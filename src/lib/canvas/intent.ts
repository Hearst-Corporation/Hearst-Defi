import "server-only";

import type { CanvasId } from "@/lib/canvas/contract";
import { CANVAS_DEFINITIONS } from "@/lib/canvas/registry";

/**
 * Canvas-intent detection for the cockpit chat route.
 *
 * Unlike the product-workspace classifier (an LLM call), canvas presets send a
 * STABLE machine marker so detection is deterministic, zero-cost and cannot be
 * spoofed into the wrong canvas by phrasing. The preset chips emit:
 *
 *   [[canvas:create-vault]] <human text the admin may have edited>
 *
 * The marker is stripped before the message reaches the model, so the agent
 * answers the human text normally while the route opens the right canvas.
 *
 * A free-typed message WITHOUT the marker never opens a canvas here — that path
 * stays a normal chat answer (or the existing product-workspace classifier).
 * This keeps the "agent can only open the canvases we built for it" invariant.
 */

const MARKER_RE = /\[\[canvas:([a-z-]+)\]\]/i;

export interface CanvasIntent {
  canvasId: CanvasId;
  /** The human message with the marker stripped, for the model + objective. */
  cleanedMessage: string;
}

function isKnownCanvasId(value: string): value is CanvasId {
  return Object.prototype.hasOwnProperty.call(CANVAS_DEFINITIONS, value);
}

export function detectCanvasIntent(message: string): CanvasIntent | null {
  const match = MARKER_RE.exec(message);
  if (!match) return null;
  const id = (match[1] ?? "").toLowerCase();
  if (!isKnownCanvasId(id)) return null;
  const cleanedMessage = message.replace(MARKER_RE, "").trim();
  return { canvasId: id, cleanedMessage };
}

/**
 * Hidden marker persisted on the assistant turn when a canvas opens, so the NEXT
 * turn knows a canvas is still active (cross-turn memory without a DB migration).
 * Stripped before display by the same compliance/render path that ignores
 * control sequences; kept short + bracketed so it never reads as prose.
 */
const OPEN_MARKER_RE = /\[\[canvas-open:([a-z-]+)\]\]/i;

export function canvasOpenMarker(canvasId: CanvasId): string {
  return `[[canvas-open:${canvasId}]]`;
}

/**
 * Scan recent chat history (most-recent-first) for the last opened canvas. Used
 * on a follow-up turn ("on commence comment") so the agent stays in the same
 * workshop instead of falling back to a generic answer. Only the most recent
 * marker wins; a later non-canvas turn does NOT clear it (the canvas page is
 * still open in Section 2 until the operator navigates away).
 */
export function detectActiveCanvasFromHistory(
  history: ReadonlyArray<{ role: string; content: string }>,
): CanvasId | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const entry = history[i];
    if (!entry || entry.role !== "assistant") continue;
    const m = OPEN_MARKER_RE.exec(entry.content);
    if (m) {
      const id = (m[1] ?? "").toLowerCase();
      return isKnownCanvasId(id) ? id : null;
    }
  }
  return null;
}

/** Strip the open-marker from a string before it is shown to the user. */
export function stripCanvasOpenMarker(text: string): string {
  return text.replace(OPEN_MARKER_RE, "").trim();
}
