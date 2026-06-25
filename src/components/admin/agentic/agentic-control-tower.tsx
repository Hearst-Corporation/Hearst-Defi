// Admin · Agentic Control Tower (orchestrator, presentational).
//
// READ-ONLY. The single composition for /admin/agentic: command summary hero,
// sticky section nav, topology schema, capabilities matrix, agents overview,
// action readiness matrix, crew simulations, observability, and safety boundary.
// Hierarchy first, details progressive. No write controls anywhere.

import { AgenticCommandSummary } from "@/components/admin/agentic/agentic-command-summary";
import { AgenticSectionNav } from "@/components/admin/agentic/agentic-section-nav";
import { AgenticTopologyMap } from "@/components/admin/agentic/agentic-topology-map";
import { AgenticCapabilitiesBoard } from "@/components/admin/agentic/agentic-capabilities-board";
import { AgenticAgentsOverview } from "@/components/admin/agentic/agentic-agents-overview";
import { AgenticSafetyBoundary } from "@/components/admin/agentic/agentic-safety-boundary";
import { ActionReadinessMatrixSection } from "@/components/admin/agentic/action-readiness-matrix-section";
import { CrewSimulationSection } from "@/components/admin/agentic/crew-simulation-section";
import { RouterObservabilitySection } from "@/components/admin/agentic/router-observability-section";

import type { AgenticControlCenterData } from "@/lib/agentic/control-center/types";
import type { RouterObservabilitySummary } from "@/lib/agentic/observability/types";
import type { ActionReadinessMatrix } from "@/lib/agentic/action-readiness/types";
import type { CrewSimulationResult } from "@/lib/agentic/crew-simulation/types";
import { buildTowerSummary } from "@/lib/agentic/system-map/tower-summary";

export function AgenticControlTower({
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
  const summary = buildTowerSummary({
    controlCenter,
    observability,
    actionReadiness,
    crewSimulations,
  });

  return (
    <div className="agentic-tower">
      <div id="overview" className="agentic-overview">
        <AgenticCommandSummary summary={summary} />
        <AgenticSectionNav />
      </div>

      <AgenticTopologyMap
        controlCenter={controlCenter}
        observability={observability}
        actionReadiness={actionReadiness}
        crewSimulations={crewSimulations}
      />

      <AgenticCapabilitiesBoard matrix={actionReadiness} />

      <AgenticAgentsOverview controlCenter={controlCenter} />

      <ActionReadinessMatrixSection matrix={actionReadiness} />

      <CrewSimulationSection simulations={crewSimulations} />

      <RouterObservabilitySection summary={observability} />

      <AgenticSafetyBoundary controlCenter={controlCenter} matrix={actionReadiness} />
    </div>
  );
}
