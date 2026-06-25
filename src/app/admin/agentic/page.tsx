// Admin · Agentic Control Tower V2 — read-only command console for the agentic chain.
// Server Component — gated by the admin layout (session.role === "admin").
//
// READ-ONLY: this page renders a navigable control tower (command summary,
// topology, capabilities, agents, actions & gates, crew simulations,
// observability, safety boundary). It executes no tool, creates no confirmation
// token, performs no write, and runs no LLM. The registry comes from
// getAgenticControlCenterData() (pure); the observability summary is a read-only
// fetch of recent router-decision metadata (no user text).

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AgenticControlTower } from "@/components/admin/agentic/agentic-control-tower";
import { getAgenticControlCenterData } from "@/lib/agentic/control-center";
import {
  getActionReadinessMatrix,
  getCrewSimulations,
} from "@/lib/agentic/system-map";
import { getReportingCrewBriefing } from "@/lib/agentic/reporting";
import {
  getRouterObservabilitySummary,
  resolveWindow,
} from "@/lib/agentic/observability/read-router-decisions";

// Dynamic: the observability section reads live (read-only) recent router
// decisions at request time. The registry + readiness + simulation data are pure.
export const dynamic = "force-dynamic";
export const metadata = { title: "Agentic Control Tower — Hearst Connect" };

export default async function AgenticControlTowerPage({
  searchParams,
}: {
  searchParams: Promise<{ routerWindow?: string }>;
}) {
  // Static, pure registry — router / inventory / gates / tools / safety.
  const controlCenter = getAgenticControlCenterData();

  // Live, best-effort durable router-decision metadata for the selected window.
  // getRouterObservabilitySummary never throws; a backend hiccup degrades to an
  // honest empty/unavailable state rather than breaking the page.
  const sp = await searchParams;
  const routerWindow = resolveWindow(sp.routerWindow);
  const observability = await getRouterObservabilitySummary({
    window: routerWindow,
  }).catch(() => null);

  // Deterministic read-only briefing composed from the data above (reuses the
  // same observability summary — no second read). Best-effort.
  const reportingCrew = await getReportingCrewBriefing({ observability }).catch(
    () => null,
  );

  // Action Readiness Matrix + Crew Simulations — both PURE, no I/O, no tool
  // execution. Classification + simulation only; nothing is invoked.
  const actionReadiness = getActionReadinessMatrix();
  const crewSimulations = getCrewSimulations();

  return (
    <>
      <AdminPageHeader
        titleLead="Agentic"
        titleAccent="Control Tower"
        contextLabel={`Agentic Control Tower · static registry ${controlCenter.version} / read-only`}
      />

      <AgenticControlTower
        controlCenter={controlCenter}
        observability={observability}
        reportingCrew={reportingCrew}
        actionReadiness={actionReadiness}
        crewSimulations={crewSimulations}
      />
    </>
  );
}
