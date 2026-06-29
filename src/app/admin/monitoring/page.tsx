import { AdminPageShell, AdminSectionCard } from "@/components/admin/admin-page-shell";
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
    <AdminPageShell
      titleLead="Monitoring"
      titleAccent="Console"
      contextLabel="System Health"
      className="[--gutter:theme(spacing.8)]"
    >
      {/* Canon welded first block: KPI strip soldered to the board inside ONE
          AdminSectionCard (like /admin/customers). When no runs are recorded the
          KPI strip is empty and MonitoringBoard renders its own EmptySurface —
          no floating KPI tiles, no empty frame around a lone empty state. */}
      {monitoringKpis.length > 0 ? (
        <AdminSectionCard
          kpis={monitoringKpis}
          kpiTitle="System Health"
          kpiSubtitle={`${stats.totalRuns} agent run${stats.totalRuns === 1 ? "" : "s"} recorded`}
          ariaLabel="System health"
        >
          <div className="p-5">
            <MonitoringBoard stats={stats} />
          </div>
        </AdminSectionCard>
      ) : (
        <MonitoringBoard stats={stats} />
      )}
    </AdminPageShell>
  );
}
