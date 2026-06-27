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
    <div className="dark flex flex-col rounded-2xl border border-white/10 bg-zinc-900 [--gutter:theme(spacing.8)] mb-8">
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">

        {/* HEADER */}
        <div className="flex flex-wrap items-center justify-between pb-3 border-b border-white/10 gap-4">
          <h1 className="text-[13px] font-semibold text-white uppercase tracking-wider">
            Monitoring <span className="text-[#A7FB90]">Console</span>
          </h1>
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.15em]">
            System Health
          </div>
        </div>

        {/* Health KPI strip — suppressed when no runs recorded yet */}
        {monitoringKpis.length > 0 && (
          <AdminKpiStripPanel kpis={monitoringKpis} />
        )}

        <MonitoringBoard stats={stats} />
      </div>
    </div>
  );
}
