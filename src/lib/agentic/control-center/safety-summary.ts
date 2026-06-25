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
    id: "no-autonomous-source",
    claim: "No autonomous source",
    holds: true,
    evidence:
      "outreach_source_leads is a draft-only HITL write tool; creates scored prospects, nothing sent.",
  },
  {
    id: "no-autonomous-mark-live",
    claim: "No autonomous mark-live",
    holds: true,
    evidence: "markAsLive is a requireAdmin server action with approval quorum — not a chat tool.",
  },
  {
    id: "no-autonomous-safe-governance",
    claim: "No autonomous Safe / governance execution",
    holds: true,
    evidence:
      "Multisig signature + executeProposal are server actions behind a state machine — never chat tools; create_governance_proposal_draft stays DRAFT.",
  },
  {
    id: "no-autonomous-db-migration",
    claim: "No autonomous DB migration",
    holds: true,
    evidence: "No agent runs migrations; prisma/schema.prisma is a sensitive single-owner file.",
  },
  {
    id: "dangerous-refused-before-llm",
    claim: "Dangerous intents refused before LLM/tool/write",
    holds: true,
    evidence:
      "Router DANGEROUS_RULES → fixed refusal ack before any LLM call, nav, tool, or HITL token (intent-router-rules.ts + cockpit-chat/route.ts).",
  },
  {
    id: "router-active-before-llm",
    claim: "Router active before LLM for safe paths",
    holds: true,
    evidence:
      "Navigation fast-path + negation + education steering run before the LLM; AGENTIC_ROUTER_SHADOW removed (non-shadow).",
  },
  {
    id: "compliance-guard-active",
    claim: "Compliance guard remains active",
    holds: true,
    evidence:
      "chatOutputViolation blocks forbidden words + single-point APY on every surface; educational steering is prompt-only, no relaxation.",
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
