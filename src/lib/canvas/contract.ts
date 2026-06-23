/**
 * Agent Canvas Workspace — shared contract.
 *
 * The cockpit chat (Section 3) can hand off to a central canvas page (Section 2)
 * that the agent WRITES INTO live: a preset opens the canvas, the agent streams
 * structured `CanvasState` frames into it, and surfaces HITL action proposals as
 * buttons. This module is the single canonical contract for that state, shared by
 * BOTH the server emitter (`src/lib/canvas/emit.ts`) and the client renderer
 * (`src/components/admin/agent-canvas/*` + `cockpit-shell/src/chat/useChat.ts`).
 *
 * NO `"server-only"` here: this file is imported across the `@hearst/cockpit-shell`
 * alias boundary by the dé-vendored chat hook (which already imports `@/lib/...`,
 * see `cockpit-shell/src/chat/ChatKimi.tsx`). Keep it dependency-free and pure types
 * + one runtime guard so it stays importable from a client bundle.
 *
 * Invariants this contract structurally upholds (CLAUDE.md non-negotiables):
 *  - #1 APY is always a range string — never a single point.
 *  - #2 Every datum carries a provenance badge (`CanvasField.provenance` is required).
 *  - #3 A proposed action is PTAI-shaped (`PendingActionProposal.summary`).
 *  - #10 A "not guaranteed" disclaimer is always present (`CanvasState.disclaimer`).
 *  - No-auto-execute: a `PendingActionProposal` is INERT DATA. It names a write-tool
 *    id + the exact input, but carries NO confirmation token — the stream emitter
 *    has no access to `createWriteConfirmation`, so a usable token can never appear
 *    in a frame. Execution requires the two-step `/api/admin/chat-tools` flow.
 */

import type { AdminWriteToolId } from "@/lib/llm/tools/types";

/** Schema version of the contract itself. Bump on any breaking shape change. */
export const CANVAS_CONTRACT_VERSION = 1 as const;

/**
 * The CLOSED set of canvases. The registry (`src/lib/canvas/registry.ts`) is the
 * only gate on what each canvas may do; the agent cannot invent a new canvas id.
 *
 * - `create-vault`   — admin: draft a new vault/product (lands on createDraftVault).
 * - `outreach`       — admin: source/draft/send outreach (Phase 2).
 * - `lp-yield-explainer` — LP read-only: the agent explains, no write actions.
 */
export const CANVAS_IDS = [
  "create-vault",
  "outreach",
  "lp-yield-explainer",
] as const;
export type CanvasId = (typeof CANVAS_IDS)[number];

export function isCanvasId(value: unknown): value is CanvasId {
  return (
    typeof value === "string" && (CANVAS_IDS as readonly string[]).includes(value)
  );
}

/** Provenance badges — non-negotiable #2. Mirrors the product-chat chart provenance. */
export const CANVAS_PROVENANCES = [
  "Live",
  "Oracle",
  "Attested",
  "Estimated",
  "Manual",
  "Stale",
] as const;
export type Provenance = (typeof CANVAS_PROVENANCES)[number];

/** Audience of a canvas. V1: admin write-canvases + an LP read-only canvas. */
export type CanvasAudience = "admin" | "lp";

/**
 * A provenance-tagged datum the canvas displays. APY values MUST be a range
 * string (#1, e.g. "8-15%"), enforced upstream by the output guard, never here.
 */
export interface CanvasField {
  /** Stable id within its section, e.g. "ticker", "targetApy". */
  key: string;
  label: string;
  value: string;
  /** Non-optional — no field renders without a badge (#2). */
  provenance: Provenance;
  editable: boolean;
  /**
   * Present iff `editable` — maps the field to a write-tool input key. The
   * client dirty-merge is keyed on this so an agent frame can't clobber an
   * in-progress admin edit.
   */
  inputBinding?: { toolInputKey: string };
  note?: string;
}

/**
 * A choice the agent offers. It NEVER executes a write — it either pre-fills the
 * chat input (continue the conversation) or patches a field value locally.
 */
export interface CanvasOption {
  id: string;
  label: string;
  effect:
    | { kind: "prefill_chat"; prompt: string }
    | { kind: "set_field"; sectionId: string; fieldKey: string; value: string };
  selected?: boolean;
}

/** PTAI-shaped action summary — non-negotiable #3. */
export interface ActionSummaryPtai {
  projection: string;
  trigger: string;
  action: string;
  impact: string;
}

/**
 * A proposed write. INERT DATA — emitting it never executes anything. It names a
 * real write-tool id (which MUST be in `ADMIN_WRITE_TOOL_IDS`) plus the EXACT
 * input the server will hash into the confirmation token. The canvas action
 * button drives the two-step propose→confirm flow against `/api/admin/chat-tools`;
 * the proposal itself carries no token.
 */
export interface PendingActionProposal {
  /** Canvas-local id, for dedupe / button keying. */
  proposalId: string;
  /** MUST be in ADMIN_WRITE_TOOL_IDS — pinned by Vitest + re-checked server-side. */
  toolId: AdminWriteToolId;
  /** Exact payload; re-hashed server-side at confirm (single-use, payload-bound). */
  input: Record<string, unknown>;
  /** e.g. "Create draft vault (DRAFT only)". */
  label: string;
  riskLevel: "low" | "medium" | "high";
  summary: ActionSummaryPtai;
  /** Honesty list, e.g. ["Does NOT mark the vault live", "Tier A is never auto-sent"]. */
  willNotDo: string[];
}

export type CanvasSectionStatus = "building" | "ready" | "blocked";

export interface CanvasSection {
  /** Stable; upserted by id like product-chat charts. */
  id: string;
  title: string;
  /** building → ready mirrors the product-chat chart status progression. */
  status: CanvasSectionStatus;
  intro?: string;
  fields: CanvasField[];
  options: CanvasOption[];
  /** Empty for read-only (LP) canvases. */
  actions: PendingActionProposal[];
}

export interface CanvasState {
  contractVersion: typeof CANVAS_CONTRACT_VERSION;
  canvasId: CanvasId;
  /**
   * Monotonic. The client IGNORES any frame with `revision <= current`, so a
   * lost / out-of-order / duplicated CustomEvent frame can never regress the
   * rendered canvas state.
   */
  revision: number;
  /** Set server-side. The client cross-checks (defense in depth). */
  audience: CanvasAudience;
  title: string;
  /** "not guaranteed" disclaimer — always rendered (#10). */
  disclaimer: string;
  /**
   * Mirrors `masterAgentEnabled`. When false, the canvas renders action buttons
   * DISABLED (the agent can't regenerate proposals with the kill-switch off).
   */
  agentLive: boolean;
  sections: CanvasSection[];
}

/** The ONLY addition to the in-band stream wire protocol. */
export interface CanvasStateEvent {
  type: "canvas_state";
  canvas: CanvasState;
}

/**
 * Runtime guard. Kept deliberately strict on the load-bearing fields (type,
 * canvasId, revision, contractVersion) — these gate whether a frame is applied.
 * Used by BOTH the server emitter and the client splitter (single source, so the
 * two can never drift).
 */
export function isCanvasStateEvent(value: unknown): value is CanvasStateEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<CanvasStateEvent>;
  if (event.type !== "canvas_state") return false;
  const canvas = event.canvas;
  if (!canvas || typeof canvas !== "object") return false;
  const c = canvas as Partial<CanvasState>;
  return (
    c.contractVersion === CANVAS_CONTRACT_VERSION &&
    isCanvasId(c.canvasId) &&
    typeof c.revision === "number" &&
    Array.isArray(c.sections)
  );
}
