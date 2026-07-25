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
import { AdminDashboardView } from "@/views/admin/dashboard-view";

export const revalidate = 30;

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
  const clustersView = buildOverviewClustersView({
    totals,
    clusters,
    allocations: [],
    allocationProvenance: "estimated",
  });

  return (
    <AdminDashboardView
      readiness={readiness}
      kpis={kpis}
      clusters={clustersView}
      queue={cockpit.actionQueue.map((q) => ({
        id: q.id,
        title: q.title,
        detail: q.context,
        at: q.createdAt,
      }))}
      audit={cockpit.auditTrail.map((a) => ({
        id: a.id,
        title: a.action,
        at: a.occurredAt,
      }))}
      contractLabel={contractLabel(mode)}
    />
  );
}
