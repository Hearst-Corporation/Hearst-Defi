import type { ActionReadinessMatrix, ActionReadinessTier } from "./types";
import { ACTION_READINESS_ITEMS } from "./actions";
import { validateItem } from "./classify-action";

const SAFETY_NOTES: string[] = [
  "No action in this matrix executes autonomously without an explicit human gate.",
  "confirmed_write requires both humanGateRequired=true and confirmationRequired=true.",
  "forbidden_autonomous actions are hard-blocked regardless of environment flags.",
  "Tier A outreach auto-send is unconditionally blocked (ADR-016).",
  "draft_or_proposal items are stored as drafts only — no publish/send effect at creation time.",
  "Unknown write-like actions default to forbidden_autonomous (fail-safe classification).",
  "The Scenario/Risk engine is pure — no formula or model change can originate from any agent.",
  "Smart contract mainnet deploy is gated on a completed Spearbit audit (ADR-006).",
];

/**
 * Build a deterministic, pure Action Readiness Matrix from the static registry.
 * No I/O, no DB, no fetch. generatedAt is caller-supplied for purity.
 */
export function buildActionReadinessMatrix(generatedAt: string): ActionReadinessMatrix {
  const violations = ACTION_READINESS_ITEMS.flatMap(validateItem);
  if (violations.length > 0) {
    throw new Error(
      `Action Readiness Matrix internal consistency error:\n${violations.join("\n")}`
    );
  }

  const counts: Record<ActionReadinessTier, number> = {
    read_only: 0,
    draft_or_proposal: 0,
    confirmed_write: 0,
    forbidden_autonomous: 0,
  };
  for (const item of ACTION_READINESS_ITEMS) {
    counts[item.tier]++;
  }

  return {
    generatedAt,
    items: ACTION_READINESS_ITEMS,
    counts,
    safetyNotes: SAFETY_NOTES,
  };
}
