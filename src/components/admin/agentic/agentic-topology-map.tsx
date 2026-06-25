// Admin · Agentic Control Tower — Topology Map V2 (presentational).
//
// READ-ONLY. A readable system SCHEMA — a handful of major blocks (not a wall of
// 32 cards): Router at the centre, Guards / HITL / Tool Boundary around it,
// Observability above, Agents & Crews + Actions to the side, the Forbidden zone
// at the edge. Each block shows a big number + a plain label. Connections are
// rendered sober (a small flow legend), never repeated jargon pills. No write
// controls. Pure component; data passed in, SSR-testable.

import type { AgenticControlCenterData } from "@/lib/agentic/control-center/types";
import type { RouterObservabilitySummary } from "@/lib/agentic/observability/types";
import type { ActionReadinessMatrix } from "@/lib/agentic/action-readiness/types";
import type { CrewSimulationResult } from "@/lib/agentic/crew-simulation/types";

type BlockTone = "control" | "guard" | "agents" | "actions" | "observe" | "forbidden";

interface TopologyBlock {
  id: string;
  label: string;
  /** Big headline value (number or short status). */
  value: string;
  /** One-line plain meaning. */
  hint: string;
  tone: BlockTone;
  /** Optional jump-link to the detail section. */
  href?: string;
  /** Grid placement class suffix (positions the block in the schema). */
  area: string;
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

  const blocks: TopologyBlock[] = [
    {
      id: "observability",
      label: "Observability",
      value: observability ? String(decisions) : "—",
      hint: observability ? "router decisions watched" : "no recent data",
      tone: "observe",
      href: "#router-observability",
      area: "obs",
    },
    {
      id: "guards",
      label: "Compliance Guards",
      value: String(guards),
      hint: "always on, never bypassed",
      tone: "guard",
      href: "#safety-boundary",
      area: "guard",
    },
    {
      id: "router",
      label: "Intent Router",
      value: routerActive ? "Active" : router.status,
      hint: "classifies every turn before the model",
      tone: "control",
      href: "#capabilities",
      area: "router",
    },
    {
      id: "agents",
      label: "Agents & Crews",
      value: String(agents),
      hint: `${crews} simulated flows`,
      tone: "agents",
      href: "#agents-overview",
      area: "agents",
    },
    {
      id: "hitl",
      label: "HITL Gates",
      value: String(gates),
      hint: "human confirmation required",
      tone: "guard",
      href: "#action-readiness",
      area: "hitl",
    },
    {
      id: "tools",
      label: "Tool Boundary",
      value: tb ? String(tb.counts.read_only + tb.counts.draft_or_proposal + tb.counts.confirmed_write) : "—",
      hint: "read / draft / confirmed-write",
      tone: "control",
      href: "#action-readiness",
      area: "tools",
    },
    {
      id: "actions",
      label: "Actions",
      value: ar ? String(ar.items.length) : "—",
      hint: "classified by autonomy tier",
      tone: "actions",
      href: "#action-readiness",
      area: "actions",
    },
    {
      id: "forbidden",
      label: "Forbidden Zone",
      value: String(forbidden),
      hint: "action types never autonomous",
      tone: "forbidden",
      href: "#safety-boundary",
      area: "forbidden",
    },
  ];

  return (
    <section id="topology" className="agentic-stack" aria-label="Agentic topology">
      <div className="agentic-section-head">
        <h2 className="agentic-section-title m-0">Topology</h2>
        <p className="body-sm ct-text-muted m-0">
          How the platform is wired — router at centre, guards and gates around it, forbidden zone at the edge.
        </p>
      </div>

      <div className="agentic-topology">
        {blocks.map((b) => {
          const inner = (
            <>
              <span className="agentic-topology-value tabular-nums">{b.value}</span>
              <span className="agentic-topology-label">{b.label}</span>
              <span className="agentic-topology-hint ct-text-faint">{b.hint}</span>
            </>
          );
          return b.href ? (
            <a
              key={b.id}
              href={b.href}
              className={`agentic-topology-node agentic-topology-node--${b.area}`}
              data-tone={b.tone}
              aria-label={`${b.label} — open details`}
            >
              {inner}
            </a>
          ) : (
            <div
              key={b.id}
              className={`agentic-topology-node agentic-topology-node--${b.area}`}
              data-tone={b.tone}
            >
              {inner}
            </div>
          );
        })}
      </div>

    </section>
  );
}
