// /admin/dashboard — operator overview.
//
// Rebuilt from docs/front-dashboard-zero-rebuild-canon.md. The surface lives in
// `src/components/admin/dashboard/`; this route loads and composes.
//
// Loaders KEPT (real Prisma aggregates / real reads):
//   loadAdminOverview   — proof + custody status
//   loadCockpitPayload  — operator queue, audit trail
//   loadPlatformTotals  — investors, invested capital
//   loadOverviewClusters— capacity, KYC, governance, distributions
//
// Loaders DROPPED (canon F5 — the retired yield-era fixture model):
//   loadDashboardData / loadRiskFramework / resolveDashboardPageInputs /
//   DASHBOARD_FIXTURE_VAULTS. They scoped the page to the yield / defensive /
//   btc-plus fixtures and produced headlineApy, yieldPosture and risk.band —
//   vocabulary the Series 1 product boundary excludes.

import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { AdminDashboard } from "@/components/admin/dashboard/AdminDashboard";
import { getVaultMode } from "@/lib/chain/dynavault";
import {
  buildOperatingKpis,
  resolveOperatingReadiness,
} from "@/lib/admin/dashboard-operating-view";
import { buildOverviewClustersView } from "@/lib/admin/overview-clusters-view";
import { loadAdminOverview } from "@/lib/data/admin-overview";
import { loadCockpitPayload } from "@/lib/data/cockpit";
import { loadOverviewClusters } from "@/lib/data/overview-clusters";
import { loadPlatformTotals } from "@/lib/data/platform-totals";

/** Soft TTL — cross-request caches in loaders revalidate silently in the background. */
export const revalidate = 30;

/** Series 1 contract mode, in operator words. */
function contractLabel(mode: "v2" | "legacy" | "not_configured"): string {
  switch (mode) {
    case "v2":
      return "DynaVault v2.1";
    case "legacy":
      return "Legacy vault";
    case "not_configured":
      return "Not configured";
  }
}

export default async function AdminDashboardPage() {
  const [overview, cockpit, totals, clusters] = await Promise.all([
    loadAdminOverview(),
    loadCockpitPayload(),
    loadPlatformTotals(),
    loadOverviewClusters(),
  ]);

  const mode = getVaultMode();

  const readiness = resolveOperatingReadiness({
    proof: overview.proof,
    operatorQueueCount: cockpit.actionQueue.length,
    auditEntryCount: cockpit.auditTrail.length,
    vaultMode: mode,
  });

  const kpis = buildOperatingKpis({
    proof: overview.proof,
    operatorQueueCount: cockpit.actionQueue.length,
    investorCount: totals.investorCount,
    investedCapitalUsdc: totals.investedCapitalUsdc,
  });

  // The Exposure cluster's allocation read is not available without the retired
  // fixture model, so no allocation is passed: the resolver renders the cluster
  // from the real distribution aggregates instead of inventing a split.
  const clustersView = buildOverviewClustersView({
    totals,
    clusters,
    allocations: [],
    allocationProvenance: "estimated",
  });

  return (
    <AdminPageShell
      titleLead="Hearst"
      titleAccent="Operations"
      contextLabel="Series 1 · Operator overview"
    >
      <AdminDashboard
        readiness={readiness}
        kpis={kpis}
        clusters={clustersView}
        queue={cockpit.actionQueue}
        audit={cockpit.auditTrail}
        contractLabel={contractLabel(mode)}
      />
    </AdminPageShell>
  );
}
