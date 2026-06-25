// Tool Boundary v1 — registry reflection (pure, client-safe, NO execution).
//
// Reflects the REAL tool registry WITHOUT importing the server-only registry.ts
// (which pulls prisma + server actions and runs side effects on import). Instead
// it is driven by the authoritative, side-effect-free id arrays exported from
// `@/lib/llm/tools/types` (ADMIN_READ_TOOL_IDS / ADMIN_WRITE_TOOL_IDS) plus a
// curated metadata map keyed by those exact ids.
//
// The metadata map is kept in sync with the registry by completeness tests that
// FAIL if any real tool id is missing or any extra id is present — so the map can
// never silently drift from the code. Handlers (`run`) are NEVER referenced here.

import {
  ADMIN_READ_TOOL_IDS,
  ADMIN_WRITE_TOOL_IDS,
} from "@/lib/llm/tools/types";
import type { ToolBoundaryRiskLevel } from "./types";

/** Path of the registry the ids/metadata mirror. */
export const TOOL_REGISTRY_SOURCE = "src/lib/llm/tools/registry.ts";
/** Path of the pure id arrays this reflection is driven by. */
export const TOOL_IDS_SOURCE = "src/lib/llm/tools/types.ts";

/** Curated, tested metadata for one real tool id. */
export interface ReflectedToolMeta {
  /** kind from the registry — read tools never write, write tools always confirm. */
  kind: "read" | "write";
  /** Per-tool riskLevel mirrored from registry.ts (low/medium/high). */
  riskLevel: Extract<ToolBoundaryRiskLevel, "low" | "medium" | "high">;
  /** Short human description mirrored from the registry. */
  description: string;
  /**
   * True for the single confirmed-write tool with an EXTERNAL effect
   * (outreach_trigger_send_run). All other writes are draft/proposal-only.
   */
  externalEffect: boolean;
}

/**
 * Real tool metadata, keyed by the exact registry ids. Mirrors registry.ts:
 *   - reads: 11, kind "read", risk "low", confirmationRequired false
 *   - writes: 7, kind "write", confirmationRequired true, draft-only except the send run
 * Completeness is asserted by tests against ADMIN_READ_TOOL_IDS/ADMIN_WRITE_TOOL_IDS.
 */
export const REFLECTED_TOOL_META: Record<string, ReflectedToolMeta> = {
  // ---- read tools (11) -----------------------------------------------------
  read_allocations_canonical: {
    kind: "read",
    riskLevel: "low",
    description: "Canonical allocations for all vaults",
    externalEffect: false,
  },
  read_market_snapshot: {
    kind: "read",
    riskLevel: "low",
    description: "Latest mining and vault snapshots",
    externalEffect: false,
  },
  read_routes_index: {
    kind: "read",
    riskLevel: "low",
    description: "Index of product routes",
    externalEffect: false,
  },
  read_specs_index: {
    kind: "read",
    riskLevel: "low",
    description: "Index of product specs",
    externalEffect: false,
  },
  read_runtime_capabilities: {
    kind: "read",
    riskLevel: "low",
    description: "Runtime capabilities / feature flags snapshot",
    externalEffect: false,
  },
  generate_chart_spec: {
    kind: "read",
    riskLevel: "low",
    description: "Generate a read-only chart spec (no persistence)",
    externalEffect: false,
  },
  generate_demo_plan: {
    kind: "read",
    riskLevel: "low",
    description: "Generate a read-only demo plan (no persistence)",
    externalEffect: false,
  },
  export_demo_pack: {
    kind: "read",
    riskLevel: "low",
    description: "Assemble a read-only demo pack (no persistence)",
    externalEffect: false,
  },
  export_briefing_pack: {
    kind: "read",
    riskLevel: "low",
    description: "Assemble a read-only briefing pack (no persistence)",
    externalEffect: false,
  },
  outreach_list_prospects: {
    kind: "read",
    riskLevel: "low",
    description: "List outreach prospects (read-only, no side effects)",
    externalEffect: false,
  },
  outreach_stats: {
    kind: "read",
    riskLevel: "low",
    description: "Outreach stats (read-only, no side effects)",
    externalEffect: false,
  },

  // ---- write tools (7) — all confirmationRequired:true ---------------------
  create_review_note_draft: {
    kind: "write",
    riskLevel: "medium",
    description: "Create admin review note draft",
    externalEffect: false,
  },
  create_governance_proposal_draft: {
    kind: "write",
    riskLevel: "high",
    description: "Create governance proposal draft only (state=DRAFT, never executed)",
    externalEffect: false,
  },
  outreach_source_leads: {
    kind: "write",
    riskLevel: "medium",
    description:
      "Source distributor leads via Apollo against the active ICP. Creates 'new' prospects; sends nothing.",
    externalEffect: false,
  },
  outreach_draft_email: {
    kind: "write",
    riskLevel: "medium",
    description: "Draft a distributor cold email and persist it as an agent draft. Does NOT send.",
    externalEffect: false,
  },
  outreach_trigger_send_run: {
    kind: "write",
    riskLevel: "high",
    description:
      "Trigger the SAME governed outreach send run as the cron. Dispatches only Tier B/C when OUTREACH_AUTONOMY ≥ SEND; Tier A never auto-sent; warm-up cap + suppression re-check + forbidden-words guard + unsubscribe + audit.",
    externalEffect: true,
  },
  create_vault_draft: {
    kind: "write",
    riskLevel: "high",
    description:
      "Create a vault in the 'draft' state ONLY (createDraftVault). Going live (markAsLive) is a separate state-machine action, never a tool.",
    externalEffect: false,
  },
  create_campaign_draft: {
    kind: "write",
    riskLevel: "medium",
    description:
      "Create an OutreachCampaign in the 'draft' state ONLY (createCampaign). Does not source, draft, or send.",
    externalEffect: false,
  },
};

/** A reflected real tool id + its kind, as discovered from the id arrays. */
export interface ReflectedToolId {
  id: string;
  kind: "read" | "write";
  /** Metadata when classified; undefined when the id has no curated entry. */
  meta?: ReflectedToolMeta;
}

/**
 * The real tool ids discovered from the side-effect-free registry id arrays,
 * each joined with its curated metadata (or undefined when unclassified — which
 * the consistency layer turns into a warning). Reads first, then writes; stable
 * order. NEVER touches a handler. Pure.
 */
export function reflectRealToolIds(): ReflectedToolId[] {
  const reads: ReflectedToolId[] = ADMIN_READ_TOOL_IDS.map((id) => ({
    id,
    kind: "read" as const,
    meta: REFLECTED_TOOL_META[id],
  }));
  const writes: ReflectedToolId[] = ADMIN_WRITE_TOOL_IDS.map((id) => ({
    id,
    kind: "write" as const,
    meta: REFLECTED_TOOL_META[id],
  }));
  return [...reads, ...writes];
}

/** The real read tool ids (re-exported for tests / consumers). */
export const REAL_READ_TOOL_IDS: readonly string[] = ADMIN_READ_TOOL_IDS;
/** The real write tool ids (re-exported for tests / consumers). */
export const REAL_WRITE_TOOL_IDS: readonly string[] = ADMIN_WRITE_TOOL_IDS;
