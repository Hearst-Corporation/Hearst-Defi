// Admin · Agentic Control Tower (detailed archive) — read-only command console.
// Server Component — gated by the admin layout (session.role === "admin").
//
// READ-ONLY: this page renders the full 8-zone control tower (command summary,
// topology, capabilities, agents, actions & gates, crew simulations,
// observability, safety boundary). It executes no tool, creates no confirmation
// token, performs no write, and runs no LLM. The simplified console lives at
// /admin/agentic; this is the preserved detailed view.

import Link from "next/link";

import { AdminPageShell } from "@/components/admin/admin-page-shell";
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
export const metadata = { title: "Agentic Control Tower (détaillé)" };

export default async function AgenticControlTowerDetailedPage({
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
    <AdminPageShell
      titleLead="Agentic"
      titleAccent="Control Tower"
      contextLabel={`registry ${controlCenter.version} · read-only`}
      lead={
        <Link
          href="/admin/agentic"
          className="ct-metric-caption hover:text-[var(--ct-text-strong)]"
        >
          ← Console
        </Link>
      }
    >
      <AgenticControlTower
        controlCenter={controlCenter}
        observability={observability}
        actionReadiness={actionReadiness}
        crewSimulations={crewSimulations}
      />
    </AdminPageShell>
  );
}
