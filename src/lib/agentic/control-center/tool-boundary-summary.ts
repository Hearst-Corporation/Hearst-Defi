// Agentic Control Center — tool boundary summary (read-only).
//
// Describes the four tool tiers WITHOUT executing any tool, creating any token,
// or performing any write. Two views, both pure and read-only:
//   - getToolBoundarySummary(): the legacy STATIC tier description (v0), kept for
//     backward compatibility with existing consumers/tests.
//   - getToolBoundaryV1Summary(): the v1 reflection of the REAL registry ids
//     (src/lib/agentic/tool-boundary), with per-tool tier/gate/risk + consistency
//     warnings comparing the static list against the real registry.
// Tool ids mirror src/lib/llm/tools/registry.ts (11 read tools, 7 write tools).

import type { ToolBoundaryEntry } from "./types";
import {
  buildToolBoundaryV1Summary,
  type StaticBoundaryView,
  type ToolBoundaryV1Summary,
} from "@/lib/agentic/tool-boundary";

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

/**
 * The tool ids the STATIC boundary displays in its tool tiers (read-only,
 * draft-proposal, confirmed-write). The forbidden-autonomous tier lists ACTION
 * labels, not tool ids, so it is excluded from the drift comparison.
 */
function getStaticBoundaryView(): StaticBoundaryView {
  const toolIds = BOUNDARY.filter(
    (e) => e.category !== "forbidden-autonomous",
  ).flatMap((e) => e.items);
  return { toolIds };
}

/**
 * Tool Boundary v1 — read-only reflection of the REAL tool registry ids, with
 * per-tool tier/gate/risk, per-tier counts, and consistency warnings that
 * compare the static display above against the real registry. Pure: no tool is
 * executed, no token created, no write performed.
 */
export function getToolBoundaryV1Summary(): ToolBoundaryV1Summary {
  return buildToolBoundaryV1Summary(getStaticBoundaryView());
}
