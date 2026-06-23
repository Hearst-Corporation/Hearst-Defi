import "server-only";

import type { CanvasId, CanvasAudience } from "@/lib/canvas/contract";
import type { AdminWriteToolId } from "@/lib/llm/tools/types";

/**
 * Agent Canvas Workspace — server-side registry.
 *
 * The FOURTH structural gate (after admin layout `notFound`, the chat-tools
 * route `requireAdmin`, and each write tool's `allowedProfiles`). It declares,
 * per canvas, the subset of write tools that canvas may even PROPOSE, plus the
 * audience and the nav destination key.
 *
 * Two invariants are pinned by Vitest (`__tests__/canvas-registry.test.ts`):
 *  - every `writeToolAllowlist` id is a real `AdminWriteToolId`;
 *  - no LP (read-only) canvas declares ANY write tool.
 *
 * The chat-tools route re-checks the global write-tool allow-list anyway
 * (`registry.ts` → `getAllowedAdminWriteTools`), so this is belt-and-suspenders:
 * even a bug here cannot grant a canvas a tool the route itself would refuse.
 */

export interface CanvasDefinition {
  id: CanvasId;
  audience: CanvasAudience;
  title: string;
  /** Nav destination key (admin-* destinations are profile-gated upstream). */
  destinationKey: string;
  /**
   * The CLOSED set of write tools this canvas may surface as action proposals.
   * Empty for LP / read-only canvases. The agent cannot propose a tool outside
   * this list — the action button would be refused by the route.
   */
  writeToolAllowlist: readonly AdminWriteToolId[];
  /**
   * Seed objective shown when the canvas opens before the first agent frame.
   * Honest placeholder copy, never a fabricated metric.
   */
  seedObjective: string;
}

export const CANVAS_DEFINITIONS: Readonly<Record<CanvasId, CanvasDefinition>> = {
  "create-vault": {
    id: "create-vault",
    audience: "admin",
    title: "New vault — draft workspace",
    destinationKey: "admin-agent-canvas",
    writeToolAllowlist: ["create_vault_draft"],
    seedObjective:
      "Frame a new vault as a draft: strategy, capital stack, fees, lock-up, target APY range, SPV and signer quorum. Draft only — never live.",
  },
  outreach: {
    id: "outreach",
    audience: "admin",
    title: "Outreach — campaign workspace",
    // Phase 2 wires the section→tool mapping; the allow-list is declared now so
    // the gate + tests are in place. All three are HITL, Tier A never auto-sent.
    destinationKey: "admin-agent-canvas",
    writeToolAllowlist: [
      "outreach_source_leads",
      "outreach_draft_email",
      "outreach_trigger_send_run",
    ],
    seedObjective:
      "Source distributor leads against the active ICP, draft outreach, and run a governed send — all human-in-the-loop. Nothing auto-sends.",
  },
  "lp-yield-explainer": {
    id: "lp-yield-explainer",
    audience: "lp",
    title: "How the yield works",
    destinationKey: "admin-agent-canvas",
    // LP read-only canvas: ZERO write tools by construction (pinned by Vitest).
    writeToolAllowlist: [],
    seedObjective:
      "Explain how the vault generates yield: mining revenue-share into a USDC reserve, monthly distributions, and the assumptions behind the target range.",
  },
};

export function getCanvasDefinition(
  canvasId: CanvasId,
): CanvasDefinition {
  return CANVAS_DEFINITIONS[canvasId];
}

/** True when this canvas is allowed to propose the given write tool. */
export function canvasAllowsWriteTool(
  canvasId: CanvasId,
  toolId: AdminWriteToolId,
): boolean {
  return CANVAS_DEFINITIONS[canvasId].writeToolAllowlist.includes(toolId);
}

/** Admin-only canvases (the ones that can carry write actions). */
export function isAdminCanvas(canvasId: CanvasId): boolean {
  return CANVAS_DEFINITIONS[canvasId].audience === "admin";
}
