// Admin · Agentic Control Tower — Topology (presentational).
//
// READ-ONLY. Rewritten 2026-06-26: the system wiring as a dense facts TABLE
// inside a collapsible group — one row per block (Router, Guards, HITL, Tools,
// Agents, Actions, Observability, Forbidden zone), each with a value + plain
// meaning. No grid of cards, no hardcoded values. Pure component.

import { AgenticGroup, AgenticTag, type AgenticTone } from "@/components/admin/agentic/agentic-group";
import type { AgenticControlCenterData } from "@/lib/agentic/control-center/types";
import type { RouterObservabilitySummary } from "@/lib/agentic/observability/types";
import type { ActionReadinessMatrix } from "@/lib/agentic/action-readiness/types";
import type { CrewSimulationResult } from "@/lib/agentic/crew-simulation/types";

interface TopologyRow {
  id: string;
  block: string;
  value: string;
  meaning: string;
  tone: AgenticTone;
}

export function AgenticTopologyMap({
  controlCenter,
  observability,
  actionReadiness,
  crewSimulations,
}: {
  controlCenter: AgenticControlCenterData;
  observability: RouterObservabilitySummary | null;
  actionReadiness: ActionReadinessMatrix | null;
  crewSimulations: CrewSimulationResult[] | null;
}) {
  const router = controlCenter.router;
  const routerActive = router.status === "active" && router.mode === "non-shadow";
  const guards = controlCenter.inventory.filter((i) => i.type === "guard").length;
  const gates = controlCenter.gates.length;
  const tb = controlCenter.toolBoundaryV1;
  const ar = actionReadiness;
  const agents = controlCenter.inventory.length;
  const crews = crewSimulations?.length ?? 0;
  const decisions = observability?.stats.total ?? 0;
  const forbidden = ar?.counts.forbidden_autonomous ?? 0;

  const rows: TopologyRow[] = [
    {
      id: "router",
      block: "Intent Router",
      value: routerActive ? "Active" : router.status,
      meaning: "Classifies every turn before the model.",
      tone: routerActive ? "accent" : "warning",
    },
    {
      id: "guards",
      block: "Compliance Guards",
      value: String(guards),
      meaning: "Always on, never bypassed.",
      tone: "success",
    },
    {
      id: "hitl",
      block: "HITL Gates",
      value: String(gates),
      meaning: "Human confirmation required.",
      tone: "warning",
    },
    {
      id: "tools",
      block: "Tool Boundary",
      value: tb
        ? String(tb.counts.read_only + tb.counts.draft_or_proposal + tb.counts.confirmed_write)
        : "—",
      meaning: "Read / draft / confirmed-write classified.",
      tone: "info",
    },
    {
      id: "agents",
      block: "Agents & Crews",
      value: String(agents),
      meaning: `${crews} simulated flows.`,
      tone: "neutral",
    },
    {
      id: "actions",
      block: "Actions",
      value: ar ? String(ar.items.length) : "—",
      meaning: "Classified by autonomy tier.",
      tone: "neutral",
    },
    {
      id: "observability",
      block: "Observability",
      value: observability ? String(decisions) : "—",
      meaning: observability ? "Router decisions watched." : "No recent data.",
      tone: "info",
    },
    {
      id: "forbidden",
      block: "Forbidden Zone",
      value: String(forbidden),
      meaning: "Action types never autonomous.",
      tone: "danger",
    },
  ];

  return (
    <AgenticGroup
      id="topology"
      title="Topology"
      count={rows.length}
      note="How the platform is wired — router at the centre, guards and gates around it, forbidden zone at the edge."
    >
      <table className="agentic-table">
        <thead>
          <tr>
            <th>Block</th>
            <th className="agentic-cell-num">Value</th>
            <th>Meaning</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} data-tone={r.tone}>
              <td className="agentic-cell-strong">{r.block}</td>
              <td className="agentic-cell-num">
                <AgenticTag tone={r.tone}>{r.value}</AgenticTag>
              </td>
              <td className="agentic-cell-muted">{r.meaning}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </AgenticGroup>
  );
}
