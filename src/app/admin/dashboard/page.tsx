import "./risk-summary-responsive.css";
import "./system-readiness.css";
import "./dashboard.css";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { DashboardAssetsBoard } from "@/components/admin/dashboard";
import { FixtureVaultPills } from "@/components/admin/fixture-vault-pills";
import { resolveDashboardPageInputs } from "@/lib/admin/dashboard-page-view";
import { loadAdminOverview } from "@/lib/data/admin-overview";
import { loadCockpitPayload } from "@/lib/data/cockpit";
import { loadDashboardData } from "@/lib/data/dashboard";
import { loadPlatformTotals } from "@/lib/data/platform-totals";
import { loadRiskFramework } from "@/lib/data/risk-framework";
import {
  adminDashboardVaultHref,
  DASHBOARD_FIXTURE_VAULTS,
} from "@/lib/vaults/dashboard-scope";

/** Soft TTL — cross-request caches in loaders revalidate silently in the background. */
export const revalidate = 30;

interface DashboardPageProps {
  searchParams: Promise<{ vault?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;

  const [data, risk, overview, cockpit, totals] = await Promise.all([
    loadDashboardData(params.vault),
    loadRiskFramework(params.vault),
    loadAdminOverview(),
    loadCockpitPayload(),
    loadPlatformTotals(),
  ]);

  const page = resolveDashboardPageInputs(data, risk, overview);

  const activeTicker =
    DASHBOARD_FIXTURE_VAULTS.find((v) => v.id === data.vaultMeta.id)?.ticker ??
    "HYV";

  return (
    <div className="admin-doc-shell">
      <AdminPageHeader
        titleLead="Admin"
        titleAccent="Command Center"
        contextLabel={`${activeTicker} · Admin Command`}
        className="dashboard-page-header"
        filters={
          <FixtureVaultPills
            activeVaultId={data.vaultMeta.id}
            resolveHref={adminDashboardVaultHref}
          />
        }
      />

      <DashboardAssetsBoard
        data={page.data}
        risk={risk}
        proof={overview.proof}
        capitalUsdc={page.capitalUsdc}
        headlineApy={page.headlineApy}
        hasLiveKpis={page.hasLiveKpis}
        simulated={page.simulated}
        yieldPosture={page.yieldPosture}
        proofFresh={page.proofFresh}
        cockpit={cockpit}
        investorCount={totals.investorCount}
        investedCapitalUsdc={totals.investedCapitalUsdc}
      />
    </div>
  );
}
