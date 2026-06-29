// Admin · Agentic Control Tower — Topology (presentational).
//
// READ-ONLY. Rewritten 2026-06-26: the system wiring as a dense facts TABLE
// inside a collapsible group — one row per block (Router, Guards, HITL, Tools,
// Agents, Actions, Observability, Forbidden zone), each with a value + plain
// meaning. No grid of cards, no hardcoded values. Pure component.
//
// Canonized (Mission #064): the custom `agentic-table` is replaced by the canon
// Catalyst Table primitive and `agentic-tag` by BentoBadge, so this section
// renders exactly like the rest of the admin.

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/catalyst/table";
import { cn } from "@/lib/cn";
import type { AgenticTone } from "@/components/admin/agentic/agentic-group";
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

// The Value column shows a plain numeric/short value (3, 12, 19, "Active"),
// not a badge — a tone only tints its colour. Bigger + tabular, no chip.
const TONE_TEXT: Record<AgenticTone, string> = {
  success: "text-[var(--ct-accent)]",
  warning: "text-[var(--ct-status-warning)]",
  danger: "text-[var(--ct-status-danger)]",
  accent: "text-[var(--ct-accent)]",
  info: "text-[var(--ct-text-strong)]",
  neutral: "text-[var(--ct-text-strong)]",
};

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
    <div id="topology" className="agentic-group-body min-w-0 border-t-0">
      <Table dense>
        <TableHead>
          <TableRow>
            <TableHeader>Block</TableHeader>
            <TableHeader className="text-right">Value</TableHeader>
            <TableHeader>Meaning</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id} data-tone={r.tone}>
              <TableCell className="ct-metric-value">{r.block}</TableCell>
              <TableCell className="text-right">
                <span
                  className={cn(
                    "text-[length:var(--ct-text-sm)] font-medium tabular-nums",
                    TONE_TEXT[r.tone],
                  )}
                >
                  {r.value}
                </span>
              </TableCell>
              <TableCell className="ct-metric-caption">{r.meaning}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
