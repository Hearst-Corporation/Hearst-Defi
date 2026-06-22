import "server-only";

import {
  ADMIN_READ_TOOLS,
  ADMIN_WRITE_TOOLS,
} from "@/lib/llm/tools/registry";
import type {
  AdminReadToolId,
  AdminWriteToolId,
} from "@/lib/llm/tools/types";

/** Short labels for the admin agent-graph instruments view. */
const READ_GRAPH_LABELS: Record<AdminReadToolId, string> = {
  read_allocations_canonical: "Allocations",
  read_market_snapshot: "Market snapshot",
  read_routes_index: "Routes index",
  read_specs_index: "Specs index",
  read_runtime_capabilities: "Capabilities",
  generate_chart_spec: "Chart spec",
  generate_demo_plan: "Demo plan",
  export_demo_pack: "Demo pack",
  export_briefing_pack: "Briefing pack",
  outreach_list_prospects: "List prospects",
  outreach_stats: "Outreach stats",
};

const WRITE_GRAPH_LABELS: Record<AdminWriteToolId, string> = {
  create_review_note_draft: "Review note draft",
  create_governance_proposal_draft: "Governance proposal draft",
  outreach_source_leads: "Source leads",
  outreach_draft_email: "Draft email",
  outreach_trigger_send_run: "Trigger send run",
};

export interface AdminToolGraphEntry {
  id: string;
  label: string;
  description: string;
  kind: "read" | "write";
  riskLevel: "low" | "medium" | "high";
  confirmationRequired: boolean;
}

/** Live catalog derived from `registry.ts` — single source of tool ids/metadata. */
export function getAdminToolGraphCatalog(): {
  read: AdminToolGraphEntry[];
  write: AdminToolGraphEntry[];
} {
  const toEntry = (
    tool: (typeof ADMIN_READ_TOOLS)[number] | (typeof ADMIN_WRITE_TOOLS)[number],
    label: string,
    kind: "read" | "write",
  ): AdminToolGraphEntry => ({
    id: tool.id,
    label,
    description: tool.description.endsWith(".")
      ? tool.description
      : `${tool.description}.`,
    kind,
    riskLevel: tool.riskLevel,
    confirmationRequired: tool.kind === "write" ? tool.confirmationRequired : false,
  });

  return {
    read: ADMIN_READ_TOOLS.map((tool) =>
      toEntry(tool, READ_GRAPH_LABELS[tool.id], "read"),
    ),
    write: ADMIN_WRITE_TOOLS.map((tool) =>
      toEntry(tool, WRITE_GRAPH_LABELS[tool.id], "write"),
    ),
  };
}
