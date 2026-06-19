import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminKpiStripPanel } from "@/components/admin/dashboard/admin-kpi-strip-panel";
import { MonitoringBoard } from "@/components/admin/monitoring/monitoring-board";
import { getMonitoringStats } from "@/lib/data/monitoring";
import { buildMonitoringKpiStrip } from "@/lib/admin/monitoring-kpi-strip";

export const dynamic = "force-dynamic";

export default async function MonitoringPage() {
  const stats = await getMonitoringStats();

  const monitoringKpis = buildMonitoringKpiStrip({
    totalRuns: stats.totalRuns,
    successfulRuns: stats.successfulRuns,
    failedRuns: stats.failedRuns,
    complianceBlockedRuns: stats.complianceBlockedRuns,
    totalCostUsd: stats.totalCostUsd,
    avgLatencyMs: stats.avgLatencyMs,
    lastRunAt: stats.recentRuns[0]?.createdAt ?? null,
  });

  return (
    <div className="admin-doc-shell">
      <AdminPageHeader
        title="Monitoring"
        eyebrow="System health"
        description="Agent runs, navigation traces, admin tools, and system health in one operator view."
      />

      {/* Health KPI strip — suppressed when no runs recorded yet */}
      {monitoringKpis.length > 0 && (
        <AdminKpiStripPanel kpis={monitoringKpis} />
      )}

      <MonitoringBoard stats={stats} />
    </div>
  );
}
