import "./risk-summary-responsive.css";
import "./system-readiness.css";
import "./dashboard.css";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { DashboardAssetsBoard } from "@/components/admin/dashboard";
import { resolveDashboardPageInputs } from "@/lib/admin/dashboard-page-view";
import { loadAdminOverview } from "@/lib/data/admin-overview";
import { loadCockpitPayload } from "@/lib/data/cockpit";
import { loadDashboardData } from "@/lib/data/dashboard";
import { loadOverviewClusters } from "@/lib/data/overview-clusters";
import { loadPlatformTotals } from "@/lib/data/platform-totals";
import { loadRiskFramework } from "@/lib/data/risk-framework";
import { DASHBOARD_FIXTURE_VAULTS } from "@/lib/vaults/dashboard-scope";

/** Soft TTL — cross-request caches in loaders revalidate silently in the background. */
export const revalidate = 30;

interface DashboardPageProps {
  searchParams: Promise<{ vault?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;

  const [data, risk, overview, cockpit, totals, overviewClusters] =
    await Promise.all([
      loadDashboardData(params.vault),
      loadRiskFramework(params.vault),
      loadAdminOverview(),
      loadCockpitPayload(),
      loadPlatformTotals(),
      loadOverviewClusters(),
    ]);

  const page = resolveDashboardPageInputs(data, risk, overview);

  const activeTicker =
    DASHBOARD_FIXTURE_VAULTS.find((v) => v.id === data.vaultMeta.id)?.ticker ??
    "HYV";

  return (
    <>
      <AdminPageHeader
        titleLead="Admin"
        titleAccent="Command Center"
        contextLabel={`${activeTicker} · Admin Command`}
        className="dashboard-page-header"
        actions={
          <div className="dashboard-header-status">
            <div className="dashboard-status-pill">
              <span className="dashboard-status-dot" />
              <span className="dashboard-status-label">Live</span>
            </div>
            <div className="dashboard-header-meta">
              <span className="dashboard-meta-label">Last updated</span>
              <span className="dashboard-meta-value">
                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          </div>
        }
      />

      <DashboardAssetsBoard
        data={page.data}
        risk={risk}
        proof={overview.proof}
        capitalUsdc={page.capitalUsdc}
        headlineApy={page.headlineApy}
        hasLiveKpis={page.hasLiveKpis}
        hasSeedPreview={page.hasSeedPreview}
        showVaultAnalytics={page.showVaultAnalytics}
        simulated={page.simulated}
        yieldPosture={page.yieldPosture}
        proofFresh={page.proofFresh}
        cockpit={cockpit}
        platformTotals={totals}
        overviewClusters={overviewClusters}
      />
    </>
  );
}
