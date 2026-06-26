/**
 * Swarm registry — the single typed source of truth for swarm definitions.
 *
 * Every swarm composes EXISTING crew-simulation scenarios (it invents no new
 * agents and changes no real numbers). Modes are restricted to the safe union
 * (simulation / dry_run / gated) by the SwarmDefinition type.
 *
 * Crew ids referenced here MUST match src/lib/agentic/crew-simulation/scenarios:
 *   reporting_crew_briefing · outreach_draft_flow · product_review_flow ·
 *   risk_explanation_flow · vault_readiness_flow · memory_distill_flow
 */

import type { SwarmDefinition } from "./types";

export const SWARM_DEFINITIONS: readonly SwarmDefinition[] = [
  {
    id: "platform_reporting_swarm",
    label: "Platform Reporting Swarm",
    description:
      "Composes the reporting crew to produce a read-only executive briefing of the agentic platform state. Pure read + compose; nothing is executed.",
    mode: "simulation",
    coordination: "sequential",
    crewIds: ["reporting_crew_briefing"],
    // Enforced read-only scope: reach an admin surface, compose the briefing, and
    // read the platform's own observability / quality / tool-boundary signals.
    allowedActionIds: [
      "navigate_admin_surface",
      "compose_reporting_briefing",
      "read_observability",
      "review_router_quality",
      "inspect_tool_boundary",
    ],
    // Categorical prohibitions (a reporting swarm never sends or sources leads).
    forbiddenActions: ["outreach_trigger_send_run", "source_leads_autonomously"],
    safetyNotes: [
      "All inputs are read-only aggregates; the briefing is a deterministic composition.",
      "No external transmission, no persistence, no tool execution.",
      "Scope is enforced: drafts, outreach, and vault mutations are out-of-scope.",
    ],
  },
  {
    id: "lp_explainer_swarm",
    label: "LP Explainer Swarm",
    description:
      "Composes the risk-explanation crew to produce a human-readable, output-guarded explanation for an LP. No financial advice, no write reachable.",
    mode: "simulation",
    coordination: "sequential",
    crewIds: ["risk_explanation_flow"],
    // Enforced read-only scope: reach an admin surface and explain product / yield
    // to an LP. No catalog action for risk/provenance exists yet — explanation is
    // produced by the risk_explanation crew, not a write action.
    allowedActionIds: ["navigate_admin_surface", "explain_product", "explain_yield"],
    // Categorical prohibitions (an LP explainer never sends or sources leads).
    forbiddenActions: ["outreach_trigger_send_run", "source_leads_autonomously"],
    safetyNotes: [
      "Output guard always runs; APY stays a range; no guarantee language.",
      "Read-only throughout — no mutation path exists.",
      "Scope is enforced: outreach drafts, vault drafts, and sends are out-of-scope.",
    ],
  },
  {
    id: "vault_governance_swarm",
    label: "Vault Governance Swarm",
    description:
      "Composes the product-review and vault-readiness crews into an advisory governance dry-run. Every output is a draft/advisory; mainnet deploy and mark-live stay hard-blocked (forbidden, not merely gated).",
    mode: "dry_run",
    coordination: "sequential",
    crewIds: ["product_review_flow", "vault_readiness_flow"],
    // Enforced governance dry-run scope: reach an admin surface, read observability,
    // and produce draft-only review / governance / vault artifacts. All drafts are
    // `gated` (the effect needs a human gate); nothing is executed.
    allowedActionIds: [
      "navigate_admin_surface",
      "read_observability",
      "create_review_note_draft",
      "create_governance_proposal_draft",
      "create_vault_draft",
    ],
    // Categorical prohibitions (a governance dry-run never deploys, marks-live, or
    // sends). deploy_product + mark_vault_live are also blocked by the global floor.
    forbiddenActions: [
      "deploy_product",
      "mark_vault_live",
      "outreach_trigger_send_run",
    ],
    safetyNotes: [
      "Advisory only — no vault state is modified.",
      "Mainnet deploy remains gated on a completed Spearbit audit (ADR-006).",
      "mark_live is a multi-sig page action, never reachable from a swarm.",
      "Scope is enforced: drafts are gated; outreach and live mutations are out-of-scope/forbidden.",
    ],
  },
  {
    id: "outreach_governed_swarm",
    label: "Outreach Governed Swarm",
    description:
      "Composes the outreach-draft crew. Produces a compliance-checked draft and halts at a human approval gate. Sending is blocked until explicit HITL confirmation; Tier A is never auto-sent.",
    mode: "gated",
    coordination: "sequential",
    crewIds: ["outreach_draft_flow"],
    // Enforced positive scope (catalog action ids only). The swarm is DRAFT-ONLY:
    // it may reach an admin surface, read product/yield content, and produce
    // outreach drafts — nothing else. The send-run is deliberately absent here and
    // listed in forbiddenActions (sending is a separate ADR-016 gated path).
    allowedActionIds: [
      "navigate_admin_surface",
      "explain_product",
      "explain_yield",
      "draft_outreach_email",
      "create_campaign_draft",
    ],
    forbiddenActions: [
      // Catalog ids the swarm hard-blocks even with a token (sending / lead-sourcing).
      "outreach_trigger_send_run",
      "source_leads_autonomously",
      "tier_a_auto_send",
    ],
    safetyNotes: [
      "Draft-only; the human approval gate is mandatory before any send.",
      "No send run is reachable from the swarm — sending is a separate gated path (ADR-016).",
      "Scope is enforced: any action outside allowedActionIds is blocked as action_out_of_swarm_scope.",
    ],
  },
  {
    id: "memory_maintenance_swarm",
    label: "Memory Maintenance Swarm",
    description:
      "Composes the memory-distill crew to produce a concise internal summary from session metadata (no user text). Dry-run: any would-be persistence is suppressed.",
    mode: "dry_run",
    coordination: "sequential",
    crewIds: ["memory_distill_flow"],
    // THEORETICAL-BUT-BOUNDED: no memory-specific catalog action exists yet, so the
    // distillation itself is produced by the crew, not a write action. The swarm is
    // given a minimal read-only scope (reach a surface + read status) and an enforced
    // boundary — every other action is out-of-scope. A future lot may add a
    // read-only `read_session_context` / `distill_memory` action to make it real.
    allowedActionIds: ["navigate_admin_surface", "read_observability"],
    // Categorical prohibitions (memory housekeeping never sends or sources leads).
    forbiddenActions: ["outreach_trigger_send_run", "source_leads_autonomously"],
    safetyNotes: [
      "Reads session metadata only — never raw user text or secrets.",
      "Dry-run: no external transmission, no persistence performed.",
      "Theoretical-but-bounded: minimal read-only scope; everything else is out-of-scope.",
    ],
  },
] as const;

export const SWARM_IDS: readonly string[] = SWARM_DEFINITIONS.map((s) => s.id);

export function getSwarmDefinition(id: string): SwarmDefinition | undefined {
  return SWARM_DEFINITIONS.find((s) => s.id === id);
}
