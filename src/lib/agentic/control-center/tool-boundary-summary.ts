// Agentic Control Center — tool boundary summary (static, read-only).
//
// Describes the four tool tiers WITHOUT executing any tool, creating any token,
// or performing any write. Pure description for visibility. Tool ids mirror
// src/lib/llm/tools/registry.ts (11 read tools, 6 write tools).

import type { ToolBoundaryEntry } from "./types";

const BOUNDARY: ToolBoundaryEntry[] = [
  {
    category: "read-only",
    label: "Read-only tools",
    items: [
      "read_allocations_canonical",
      "read_market_snapshot",
      "read_routes_index",
      "read_specs_index",
      "read_runtime_capabilities",
      "generate_chart_spec",
      "generate_demo_plan",
      "export_demo_pack",
      "export_briefing_pack",
      "outreach_list_prospects",
      "outreach_stats",
    ],
    requiresConfirmation: false,
    notes:
      "Low risk, no confirmation. Bounded reads + read-only generation (chart spec, demo/briefing packs). admin chat mode + admin profile per policy.ts.",
  },
  {
    category: "draft-proposal",
    label: "Draft / proposal tools",
    items: [
      "create_review_note_draft",
      "create_governance_proposal_draft",
      "outreach_source_leads",
      "outreach_draft_email",
      "create_campaign_draft",
      "create_vault_draft",
    ],
    requiresConfirmation: true,
    notes:
      "Persist a DRAFT / proposal state ONLY (status=draft, governance state=DRAFT) — never live/executed/sent. Each is gated by a two-step input-bound single-use confirmation token before it touches the DB.",
  },
  {
    category: "confirmed-write",
    label: "Confirmed-write tools (HITL)",
    items: ["outreach_trigger_send_run"],
    requiresConfirmation: true,
    notes:
      "The only tool with an external effect. admin-only; runs the SAME governed cron — dispatches solely for Tier B/C when OUTREACH_AUTONOMY ≥ SEND, daily warm-up cap + suppression re-check + forbidden-words guard + unsubscribe link + audit. Tier A never auto-sent.",
  },
  {
    category: "forbidden-autonomous",
    label: "Forbidden autonomous actions",
    items: [
      "any financial / custodial action",
      "Safe / multisig signature",
      "vault promote / markAsLive",
      "mainnet deploy",
      "DB migration",
      "governance execution",
      "formula / methodology change",
      "Tier A outreach auto-send",
    ],
    requiresConfirmation: true,
    notes:
      "Zero tools in this tier — none reachable from the chat or an agent. These are human-gated admin server actions or out of the agentic surface entirely (ADR-012 / ADR-016 / ADR-017).",
  },
];

export function getToolBoundarySummary(): ToolBoundaryEntry[] {
  return BOUNDARY;
}
