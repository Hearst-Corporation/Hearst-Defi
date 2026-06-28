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
    <div className="dark flex flex-col rounded-2xl border border-white/10 bg-surface-page [--gutter:theme(spacing.8)] mb-8">
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">

        {/* HEADER */}
        <div className="flex flex-wrap items-end justify-between pb-3 border-b border-white/10 gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
              System Health
            </span>
            <h1 className="text-[24px] font-semibold tracking-tight text-white">
              Monitoring <span className="text-[#A7FB90]">Console</span>
            </h1>
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
