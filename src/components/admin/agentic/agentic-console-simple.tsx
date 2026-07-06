// Admin · Agentic Console (simplified, orchestrator, presentational).
//
// READ-ONLY. The pared-down composition for /admin/agentic: three canon
// AdminSectionCards — Agents, Tool boundary, Observability. It executes no tool,
// creates no confirmation token, performs no write, and runs no LLM. There are
// NO <button>/<form>/<input> and no actionable (run/execute/…) labels anywhere.
//
// The full 8-zone AgenticControlTower is preserved and archived at
// /admin/agentic/detailed — this view only demounts it at the page level.

import { AdminSectionCard } from "@/components/admin/admin-page-shell";
import { AgenticAgentsCards } from "@/components/admin/agentic/agentic-agents-cards";
import { AgenticToolBoundaryCondensed } from "@/components/admin/agentic/agentic-tool-boundary-condensed";
import {
  RouterObservabilitySection,
  ObservabilityWindowSelector,
} from "@/components/admin/agentic/router-observability-section";
import { buildToolBoundaryKpiStrip } from "@/lib/admin/tool-boundary-kpi-strip";

import type { AgenticControlCenterData } from "@/lib/agentic/control-center/types";
import type {
  RouterObservabilitySummary,
  RouterObservabilityWindow,
} from "@/lib/agentic/observability/types";

export function AgenticConsoleSimple({
  controlCenter,
  observability,
  observabilityWindow,
}: {
  controlCenter: AgenticControlCenterData;
  observability: RouterObservabilitySummary | null;
  observabilityWindow: RouterObservabilityWindow;
}) {
  const toolBoundaryCounts = controlCenter.toolBoundaryV1?.counts;
  const toolBoundaryKpis = toolBoundaryCounts
    ? buildToolBoundaryKpiStrip(toolBoundaryCounts)
    : undefined;

  return (
    <>
      <AdminSectionCard
        ariaLabel="Agents"
        title="Agents"
        subtitle="The base agents in the platform, grouped by where they run. Read-only inventory."
      >
        <AgenticAgentsCards />
      </AdminSectionCard>

      <AdminSectionCard
        ariaLabel="Tool boundary"
        kpis={toolBoundaryKpis}
        kpiTitle="Tool boundary"
        kpiSubtitle="What the model may call, by tier"
        title="Tool boundary"
        subtitle="What the model may call, by tier. Every write is human-in-the-loop."
      >
        <AgenticToolBoundaryCondensed controlCenter={controlCenter} />
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
    </>
  );
}
