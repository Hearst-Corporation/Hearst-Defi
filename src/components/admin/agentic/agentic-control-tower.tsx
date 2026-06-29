// Admin · Agentic Control Tower (orchestrator, presentational).
//
// READ-ONLY. The single composition for /admin/agentic. Canonized 2026-06-29:
// every top-level zone is now a canon AdminSectionCard (the same frame every
// other admin page uses — customers/outreach/agents/feedback), stacked in a
// full-width flex-col gap-5 flow. The section components render frameless
// bodies (no own card / no <details> top-level frame) so there is no
// double-frame. Content, counts, and security copy are unchanged. No write
// controls anywhere.

import { AdminSectionCard } from "@/components/admin/admin-page-shell";
import { AgenticStatusLine } from "@/components/admin/agentic/agentic-command-summary";
import { AgenticTopologyMap } from "@/components/admin/agentic/agentic-topology-map";
import { AgenticCapabilitiesBoard } from "@/components/admin/agentic/agentic-capabilities-board";
import { AgenticAgentsOverview } from "@/components/admin/agentic/agentic-agents-overview";
import { AgenticSafetyBoundary } from "@/components/admin/agentic/agentic-safety-boundary";
import { ActionReadinessMatrixSection } from "@/components/admin/agentic/action-readiness-matrix-section";
import { CrewSimulationSection } from "@/components/admin/agentic/crew-simulation-section";
import {
  RouterObservabilitySection,
  ObservabilityWindowSelector,
} from "@/components/admin/agentic/router-observability-section";

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

  const observabilityWindow = observability?.window ?? "24h";

  return (
    <div className="agentic-tower flex min-w-0 flex-col gap-5">
      <AdminSectionCard
        ariaLabel="Agentic command summary"
        title="Command Summary"
        subtitle="Autonomy, gates, forbidden actions, and simulated crews."
      >
        <div className="p-5">
          <AgenticStatusLine summary={summary} />
        </div>
      </AdminSectionCard>

      <AdminSectionCard
        ariaLabel="Topology"
        title="Topology"
        subtitle="Router at the centre, guards and gates around it, forbidden zone at the edge."
      >
        <AgenticTopologyMap
          controlCenter={controlCenter}
          observability={observability}
          actionReadiness={actionReadiness}
          crewSimulations={crewSimulations}
        />
      </AdminSectionCard>

      <AdminSectionCard
        ariaLabel="Capabilities"
        title="Capabilities"
        subtitle="What the platform can do, by how much human oversight it needs."
      >
        <AgenticCapabilitiesBoard matrix={actionReadiness} />
      </AdminSectionCard>

      <AdminSectionCard
        ariaLabel="Agents & Crews"
        title="Agents & Crews"
        subtitle="Units grouped by domain — read-only and gated-write inventory."
      >
        <AgenticAgentsOverview controlCenter={controlCenter} />
      </AdminSectionCard>

      <AdminSectionCard
        ariaLabel="Actions & Gates"
        title="Actions & Gates"
        subtitle="Every platform action classified by autonomy tier. Green runs on its own; amber needs human confirmation; red never runs autonomously."
      >
        <ActionReadinessMatrixSection matrix={actionReadiness} />
      </AdminSectionCard>

      <AdminSectionCard
        ariaLabel="Crew Simulation"
        title="Crew Simulation"
        subtitle="What each crew would do — read-only simulation. No step executes; no tool is called."
      >
        <div className="p-5">
          <CrewSimulationSection simulations={crewSimulations} />
        </div>
      </AdminSectionCard>

      <AdminSectionCard
        ariaLabel="Observability"
        title="Observability"
        subtitle="Read-only metadata about what the router did on recent chat turns. No message text, no secrets."
        headerTrailing={
          <ObservabilityWindowSelector current={observabilityWindow} />
        }
      >
        <RouterObservabilitySection summary={observability} />
      </AdminSectionCard>

      <AdminSectionCard
        ariaLabel="Safety Boundary"
        title="Safety Boundary"
        subtitle="The hard limits. Nothing executes here. Every write is gated; the most dangerous actions can never be autonomous."
      >
        <AgenticSafetyBoundary controlCenter={controlCenter} matrix={actionReadiness} />
      </AdminSectionCard>
    </div>
  );
}
