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
    forbiddenActions: ["send_briefing", "write_to_db", "execute_tool"],
    safetyNotes: [
      "All inputs are read-only aggregates; the briefing is a deterministic composition.",
      "No external transmission, no persistence, no tool execution.",
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
    forbiddenActions: ["give_financial_advice", "write_to_db", "execute_tool"],
    safetyNotes: [
      "Output guard always runs; APY stays a range; no guarantee language.",
      "Read-only throughout — no mutation path exists.",
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
    forbiddenActions: [
      "deploy_product",
      "mark_vault_live",
      "send",
      "safe_signature",
      "write_to_db",
    ],
    safetyNotes: [
      "Advisory only — no vault state is modified.",
      "Mainnet deploy remains gated on a completed Spearbit audit (ADR-006).",
      "mark_live is a multi-sig page action, never reachable from a swarm.",
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
    forbiddenActions: [
      "send",
      "outreach_trigger_send_run",
      "source_leads_autonomously",
      "write_to_db",
    ],
    safetyNotes: [
      "Draft-only; the human approval gate is mandatory before any send.",
      "No send run is reachable from the swarm — sending is a separate gated path (ADR-016).",
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
    forbiddenActions: ["store_user_text", "external_transmit", "execute_tool"],
    safetyNotes: [
      "Reads session metadata only — never raw user text or secrets.",
      "Dry-run: no external transmission, no persistence performed.",
    ],
  },
] as const;

export const SWARM_IDS: readonly string[] = SWARM_DEFINITIONS.map((s) => s.id);

export function getSwarmDefinition(id: string): SwarmDefinition | undefined {
  return SWARM_DEFINITIONS.find((s) => s.id === id);
}
