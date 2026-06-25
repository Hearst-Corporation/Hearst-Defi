// Tool Boundary v1 — summary builder (pure, read-only, NO execution).
//
// Composes the reflected + classified real tools, per-tier counts, consistency
// issues (incl. static-vs-code drift), and safety notes into one read-only
// ToolBoundaryV1Summary for the Control Center. Pure: no I/O, no Date.now (the
// `generatedAt` is a static marker, matching the Control Center convention).

import type {
  ReflectedToolBoundaryItem,
  ToolBoundaryTier,
  ToolBoundaryTierCounts,
  ToolBoundaryV1Summary,
} from "./types";
import { classifyAllTools } from "./classify-tool";
import {
  checkToolBoundaryConsistency,
  type StaticBoundaryView,
} from "./consistency";

const ALL_TIERS: ToolBoundaryTier[] = [
  "read_only",
  "draft_or_proposal",
  "confirmed_write",
  "forbidden_autonomous",
  "unknown",
];

/** Static marker — NOT a live timestamp (pure code has no Date.now). */
const GENERATED_AT = "code reflection (static marker) / read-only";

const SAFETY_NOTES: string[] = [
  "Read-only reflection of the real tool registry. No tool is executed, added, removed, or changed.",
  "Every write tool requires a two-step input-bound single-use HITL confirmation token; no write is autonomous.",
  "Only read_only tools may be called without a human gate, and they can never write.",
  "Forbidden-autonomous actions are represented, not callable tools — they are never reachable from the chat or an agent (ADR-012 / ADR-016 / ADR-017).",
  "An unclassified real tool fails safe: high risk, non-autonomous, and raises a consistency warning.",
];

/** Count reflected items per tier (every tier present, default 0). Pure. */
export function countByTier(
  tools: readonly ReflectedToolBoundaryItem[],
): ToolBoundaryTierCounts {
  const counts = Object.fromEntries(
    ALL_TIERS.map((t) => [t, 0]),
  ) as ToolBoundaryTierCounts;
  for (const t of tools) counts[t.tier] += 1;
  return counts;
}

/**
 * Build the read-only Tool Boundary v1 summary. `staticView` is the set of tool
 * ids the existing static Control Center boundary displays (so drift is surfaced).
 * Pure — same input → same output.
 */
export function buildToolBoundaryV1Summary(
  staticView: StaticBoundaryView,
): ToolBoundaryV1Summary {
  const tools = classifyAllTools();
  const counts = countByTier(tools);
  const consistencyIssues = checkToolBoundaryConsistency(tools, staticView);

  return {
    generatedAt: GENERATED_AT,
    source: "code_reflection",
    counts,
    tools,
    consistencyIssues,
    safetyNotes: SAFETY_NOTES,
  };
}
