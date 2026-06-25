// Agentic Control Center v0 — safety summary (static, read-only).
//
// The headline guarantees, each with the repo/ADR evidence behind it.

import type { SafetySummaryItem } from "./types";

const SAFETY: SafetySummaryItem[] = [
  {
    id: "no-autonomous-deploy",
    claim: "No autonomous deploy",
    holds: true,
    evidence: "No deploy tool in the registry; mainnet gated on Spearbit audit (ADR-006).",
  },
  {
    id: "no-autonomous-send",
    claim: "No autonomous send",
    holds: true,
    evidence:
      "outreach_trigger_send_run is HITL; default OUTREACH_AUTONOMY=SUGGEST sends nothing. Tier A never auto-sent (ADR-016).",
  },
  {
    id: "no-autonomous-mark-live",
    claim: "No autonomous mark-live",
    holds: true,
    evidence: "markAsLive is a requireAdmin server action with approval quorum — not a chat tool.",
  },
  {
    id: "no-autonomous-db-migration",
    claim: "No autonomous DB migration",
    holds: true,
    evidence: "No agent runs migrations; prisma/schema.prisma is a sensitive single-owner file.",
  },
  {
    id: "hitl-enabled",
    claim: "HITL enabled on every write",
    holds: true,
    evidence:
      "Two-step input-bound single-use confirmation token (src/lib/llm/tools/confirmations.ts) on every write tool.",
  },
  {
    id: "product-deploy-qa-pass",
    claim: "Product / Vault / Deploy safety QA PASS",
    holds: true,
    evidence:
      "Documented in docs/agent-file-locks.md (PR #30): live deploy probe REFUSED, zero writes; 148 safety tests green.",
  },
  {
    id: "router-v2-active",
    claim: "Deterministic Intent Router v2 active",
    holds: true,
    evidence:
      "PR #36 (merge bcb55f2c) — educational read-only hint CONSUMED, negation hole closed; docs/agentic/DETERMINISTIC_INTENT_ROUTER_V2.md.",
  },
  {
    id: "product-education-passes",
    claim: "Product education passes via prompt steering",
    holds: true,
    evidence:
      "\"explique-moi comment marchent les produits\" → product_explanation → educational steering; the guard is not relaxed.",
  },
  {
    id: "yield-education-passes",
    claim: "Yield education stays PASS",
    holds: true,
    evidence:
      "\"explique comment fonctionne le yield\" answers compliantly; per-source breakdowns allowed, single-point APY still blocked.",
  },
];

export function getSafetySummary(): SafetySummaryItem[] {
  return SAFETY;
}
