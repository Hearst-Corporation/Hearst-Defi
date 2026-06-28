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
    <div className="dark flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page [--gutter:theme(spacing.8)] mb-8">
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        <AdminPageHeader
          titleLead="Monitoring"
          titleAccent="Console"
          contextLabel="System Health"
        />

        {/* Health KPI strip — suppressed when no runs recorded yet */}
        {monitoringKpis.length > 0 && (
          <AdminKpiStripPanel kpis={monitoringKpis} />
        )}

        <MonitoringBoard stats={stats} />
      </div>
    </div>
  );
}
