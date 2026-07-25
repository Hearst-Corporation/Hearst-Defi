import { getVaultMode } from "@/lib/chain/dynavault";
import {
  buildOperatingKpis,
  resolveOperatingReadiness,
} from "@/lib/admin/dashboard-operating-view";
import { buildOverviewClustersView } from "@/lib/admin/overview-clusters-view";
import { loadAdminOverview } from "@/lib/data/admin-overview";
import { AUDIT_TRAIL_DISPLAY_CAP, loadCockpitPayload } from "@/lib/data/cockpit";
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
  // `null` = the read failed (Loaded envelope) — NEVER coerced to 0: the
  // readiness resolver and the KPI strip render "unavailable", not "Clear".
  const queueCount =
    cockpit.actionQueue.status === "ok" ? cockpit.actionQueue.data.length : null;
  const auditCount =
    cockpit.auditTrail.status === "ok" ? cockpit.auditTrail.data.length : null;

  const readiness = resolveOperatingReadiness({
    proof: overview.proof,
    operatorQueueCount: queueCount,
    auditEntryCount: auditCount,
    vaultMode: mode,
  });
  const kpis = buildOperatingKpis({
    proof: overview.proof,
    operatorQueueCount: queueCount,
    investorCount: totals.investorCount,
    investedCapitalUsdc: totals.investedCapitalUsdc,
  });
  const clustersView = buildOverviewClustersView({ totals, clusters });

  return (
    <AdminDashboardView
      readiness={readiness}
      kpis={kpis}
      clusters={clustersView}
      queue={cockpit.actionQueue}
      audit={cockpit.auditTrail}
      auditDisplayCap={AUDIT_TRAIL_DISPLAY_CAP}
      contractLabel={contractLabel(mode)}
    />
  );
}
