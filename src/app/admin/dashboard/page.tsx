import "./risk-summary-responsive.css";
import "./system-readiness.css";
import "./dashboard.css";

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
    <div className="dark flex flex-col rounded-2xl border border-white/10 bg-zinc-900 [--gutter:theme(spacing.8)] mb-8">
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">

        {/* HEADER */}
        <div className="flex flex-wrap items-center justify-between pb-3 border-b border-white/10 gap-4">
          <h1 className="text-[13px] font-semibold text-white uppercase tracking-wider">
            Admin <span className="text-[#A7FB90]">Command Center</span>
          </h1>
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.15em]">
            {activeTicker} · Admin Command
          </div>
        </div>

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
      </div>
    </div>
  );
}
