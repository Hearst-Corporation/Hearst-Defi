import type { HeroKpi } from "@/lib/data/cockpit";
import type { AgentGraphNode } from "@/lib/data/agent-graph";
import type { AgentTemplateRow } from "@/lib/data/agent-templates";

interface AgentsKpiInput {
  /** Persona templates loaded from DB (already on the page). */
  templates: AgentTemplateRow[];
  /** Graph nodes already loaded from LlmRun (already on the page). */
  nodes: AgentGraphNode[];
  /** Total count of base (code) agents in the static catalog. */
  baseAgentCount: number;
}

/**
 * Derives honest KPIs for the /admin/agents hub header.
 *
 * All numbers come from data already loaded by the page — zero extra queries.
 *
 * Returns [] when neither templates nor run activity exists (caller suppresses
 * the strip).
 *
 * Provenance:
 * - Base agents / templates → "manual" (static catalog / operator-confirmed DB records)
 * - Runs 24 h / active surfaces → "live" (real LlmRun rows from the last 24 h)
 */
export function buildAgentsKpiStrip({
  templates,
  nodes,
  baseAgentCount,
}: AgentsKpiInput): HeroKpi[] {
  // LLM agent nodes only (kind === "agent") — sources/outputs don't have runs.
  const agentNodes = nodes.filter((n) => n.agentName !== null);

  const totalRuns24h = agentNodes.reduce((sum, n) => sum + n.recentRuns, 0);
  const activeCount = agentNodes.filter((n) => n.state === "active").length;

  // Suppress the strip when there's nothing meaningful to show.
  if (templates.length === 0 && totalRuns24h === 0) return [];

  const activeTemplates = templates.filter((t) => !t.archived);
  const archivedTemplates = templates.filter((t) => t.archived);

  const kpis: HeroKpi[] = [
    {
      label: "Base agents",
      value: String(baseAgentCount),
      sublabel: "code execution surfaces",
      provenance: "manual",
    },
    {
      label: "Persona templates",
      value: String(activeTemplates.length),
      sublabel:
        archivedTemplates.length > 0
          ? `${archivedTemplates.length} archived`
          : "active",
      provenance: "manual",
      accent: activeTemplates.length > 0,
    },
  ];

  // Only surface run metrics when there is something to show.
  if (totalRuns24h > 0) {
    kpis.push({
      label: "Runs (24 h)",
      value: String(totalRuns24h),
      sublabel: "across all LLM agents",
      provenance: "live",
      accent: true,
    });
  }

  if (agentNodes.length > 0) {
    kpis.push({
      label: "Active surfaces",
      value: activeCount > 0 ? String(activeCount) : "None",
      sublabel: activeCount > 0 ? "ran in the last 10 min" : "all idle",
      provenance: "live",
      alert: activeCount === 0 && totalRuns24h > 0,
    });
  }

  return kpis;
}
