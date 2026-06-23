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
