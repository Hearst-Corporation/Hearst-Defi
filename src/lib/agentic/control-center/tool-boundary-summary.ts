// Agentic Control Center v0 — tool boundary summary (static, read-only).
//
// Describes the four tool tiers WITHOUT executing any tool, creating any token,
// or performing any write. Pure description for visibility.

import type { ToolBoundaryEntry } from "./types";

const BOUNDARY: ToolBoundaryEntry[] = [
  {
    category: "read-only",
    label: "Read-only tools",
    items: [
      "list_products",
      "list_routes",
      "list_specs",
      "get_live_price",
      "chart_from_ai",
      "outreach_list_prospects",
      "outreach_stats",
    ],
    requiresConfirmation: false,
    notes:
      "Low risk, no confirmation. Bounded reads only; allowed in normal + admin chat modes per policy.ts.",
  },
  {
    category: "draft-proposal",
    label: "Draft / proposal tools",
    items: [
      "outreach_source_leads (draft prospects)",
      "outreach_draft_email (draft message)",
      "create_vault_draft (draft scenario)",
      "admin review-note draft",
      "governance-proposal draft",
    ],
    requiresConfirmation: true,
    notes:
      "Produce a DRAFT only. Every one is gated by a two-step input-bound single-use confirmation token before it touches the DB.",
  },
  {
    category: "confirmed-write",
    label: "Confirmed-write tools (HITL)",
    items: ["outreach_trigger_send_run"],
    requiresConfirmation: true,
    notes:
      "The only tool with an external effect. Admin-only chat mode; dispatches solely for Tier B/C when OUTREACH_AUTONOMY ≥ SEND, daily cap + warm-up + suppression re-check + forbidden-words guard + unsubscribe link + audit. Tier A never auto-sent.",
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
      "Never reachable from the chat or an agent. These are human-gated admin server actions or out of the agentic surface entirely (ADR-012 / ADR-016 / ADR-017).",
  },
];

export function getToolBoundarySummary(): ToolBoundaryEntry[] {
  return BOUNDARY;
}
