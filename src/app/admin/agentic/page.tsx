// Admin · Agentic Control Tower — read-only command console for the agentic chain.
// Server Component — gated by the admin layout (session.role === "admin").
//
// READ-ONLY: this page renders a navigable control tower (command summary,
// topology, capabilities, agents, actions & gates, crew simulations,
// observability, safety boundary). It executes no tool, creates no confirmation
// token, performs no write, and runs no LLM.

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AgenticControlTower } from "@/components/admin/agentic/agentic-control-tower";
import { getAgenticControlCenterData } from "@/lib/agentic/control-center";
import {
  getActionReadinessMatrix,
  getCrewSimulations,
} from "@/lib/agentic/system-map";
import {
  getRouterObservabilitySummary,
  resolveWindow,
} from "@/lib/agentic/observability/read-router-decisions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agentic Control Tower — Hearst Connect" };

export default async function AgenticControlTowerPage({
  searchParams,
}: {
  searchParams: Promise<{ routerWindow?: string }>;
}) {
  const controlCenter = getAgenticControlCenterData();

  const sp = await searchParams;
  const routerWindow = resolveWindow(sp.routerWindow);
  const observability = await getRouterObservabilitySummary({
    window: routerWindow,
  }).catch(() => null);

  const actionReadiness = getActionReadinessMatrix();
  const crewSimulations = getCrewSimulations();

  return (
    <div className="dark flex flex-col rounded-2xl border border-white/10 bg-zinc-900 mb-8">
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        <AdminPageHeader
          titleLead="Agentic"
          titleAccent="Control Tower"
          contextLabel={`registry ${controlCenter.version} · read-only`}
        />

        <AgenticControlTower
          controlCenter={controlCenter}
          observability={observability}
          actionReadiness={actionReadiness}
          crewSimulations={crewSimulations}
        />
      </div>
    </div>
  );
}
