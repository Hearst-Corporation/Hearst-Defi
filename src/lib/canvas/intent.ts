import "server-only";

import type { CanvasId } from "@/lib/canvas/contract";
import { CANVAS_DEFINITIONS } from "@/lib/canvas/registry";

/**
 * Canvas-intent detection for the cockpit chat route.
 *
 * Canvas presets may send a STABLE machine marker (`[[canvas:<id>]]`) so detection
 * is deterministic. The marker is stripped before the message reaches the model.
 *
 * Vault framing/creation is handled by the Product Workspace — the retired
 * `create-vault` agent-canvas marker is detected (for marker stripping) but
 * never opens a canvas (`resolveCanvasNavIntent` returns null).
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

/** Canvas ids that no longer open agent-canvas — Product Workspace owns framing. */
const RETIRED_CANVAS_NAV_IDS = new Set<CanvasId>(["create-vault"]);

/**
 * Apply navigation policy after `detectCanvasIntent`. Retired canvases (notably
 * `create-vault`) return null so the product-workspace classifier can run on the
 * cleaned human text. Outreach + LP canvases pass through unchanged.
 */
export function resolveCanvasNavIntent(intent: CanvasIntent | null): CanvasIntent | null {
  if (!intent) return null;
  if (RETIRED_CANVAS_NAV_IDS.has(intent.canvasId)) return null;
  return intent;
}

/** Cross-turn memory: retired canvases must not re-open agent-canvas. */
export function resolveCanvasHistoryId(canvasId: CanvasId | null): CanvasId | null {
  if (!canvasId) return null;
  if (RETIRED_CANVAS_NAV_IDS.has(canvasId)) return null;
  return canvasId;
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
