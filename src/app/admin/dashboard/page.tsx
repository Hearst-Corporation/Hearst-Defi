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
              <span className="dashboard-status-dot dashboard-status-dot--live" />
              <span className="dashboard-status-label">System Live</span>
            </div>
            <div className="dashboard-header-meta">
              <div className="flex items-center gap-6">
                <div className="flex flex-col items-end gap-0.5">
                  <span className="dashboard-meta-label">Uptime</span>
                  <span className="dashboard-meta-value text-ct-status-success">99.98%</span>
                </div>
                <div className="w-px h-8 bg-[var(--ct-border-ghost)]" />
                <div className="flex flex-col items-end gap-0.5">
                  <span className="dashboard-meta-label">Sync</span>
                  <span className="dashboard-meta-value">
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                  </span>
                </div>
              </div>
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
