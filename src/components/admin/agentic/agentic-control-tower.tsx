// Admin · Agentic Control Tower (orchestrator, presentational).
//
// READ-ONLY. The single composition for /admin/agentic V2: a command summary
// hero, a sticky section nav, a readable topology schema, a capabilities board,
// a grouped agents overview, the actions & gates matrix, the crew-simulation
// flows, observability + quality, and a safety boundary. Hierarchy first,
// details progressive — not a documentation wall. No write controls anywhere.

import { AgenticCommandSummary } from "@/components/admin/agentic/agentic-command-summary";
import { AgenticSectionNav } from "@/components/admin/agentic/agentic-section-nav";
import { AgenticTopologyMap } from "@/components/admin/agentic/agentic-topology-map";
import { AgenticCapabilitiesBoard } from "@/components/admin/agentic/agentic-capabilities-board";
import { AgenticAgentsOverview } from "@/components/admin/agentic/agentic-agents-overview";
import { AgenticSafetyBoundary } from "@/components/admin/agentic/agentic-safety-boundary";
import { ActionReadinessMatrixSection } from "@/components/admin/agentic/action-readiness-matrix-section";
import { CrewSimulationSection } from "@/components/admin/agentic/crew-simulation-section";
import { RouterObservabilitySection } from "@/components/admin/agentic/router-observability-section";
import { ReportingCrewSection } from "@/components/admin/agentic/reporting-crew-section";

import type { AgenticControlCenterData } from "@/lib/agentic/control-center/types";
import type { RouterObservabilitySummary } from "@/lib/agentic/observability/types";
import type { ActionReadinessMatrix } from "@/lib/agentic/action-readiness/types";
import type { CrewSimulationResult } from "@/lib/agentic/crew-simulation/types";
import type { ReportingCrewBriefing } from "@/lib/agentic/reporting/types";
import { buildTowerSummary } from "@/lib/agentic/system-map/tower-summary";

export function AgenticControlTower({
  controlCenter,
  observability,
  reportingCrew,
  actionReadiness,
  crewSimulations,
}: {
  controlCenter: AgenticControlCenterData;
  observability: RouterObservabilitySummary | null;
  reportingCrew: ReportingCrewBriefing | null;
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
      {/* Overview — command summary + section nav. */}
      <div id="overview" className="agentic-overview">
        <AgenticCommandSummary summary={summary} />
        <AgenticSectionNav />
      </div>

      {/* Topology — readable schema. */}
      <AgenticTopologyMap
        controlCenter={controlCenter}
        observability={observability}
        actionReadiness={actionReadiness}
        crewSimulations={crewSimulations}
      />

      {/* Capabilities — what runs autonomously / gated / never. */}
      <AgenticCapabilitiesBoard matrix={actionReadiness} />

      {/* Agents & Crews — grouped by domain. */}
      <AgenticAgentsOverview controlCenter={controlCenter} />

      {/* Actions & Gates — the readiness matrix (refined). */}
      <ActionReadinessMatrixSection matrix={actionReadiness} />

      {/* Simulations — read-only crew flows, executable: false. */}
      <CrewSimulationSection simulations={crewSimulations} />

      {/* Observability & Quality — live read-only telemetry. */}
      <RouterObservabilitySection summary={observability} />

      {/* Reporting Crew — read-only briefing. */}
      <ReportingCrewSection briefing={reportingCrew} />

      {/* Safety Boundary — the hard limits in plain language. */}
      <AgenticSafetyBoundary controlCenter={controlCenter} matrix={actionReadiness} />
    </div>
  );
}
