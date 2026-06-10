import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getMonitoringStats } from "@/lib/data/monitoring";

export const dynamic = "force-dynamic";

export default async function MonitoringPage() {
  await requireAdmin();
  const stats = await getMonitoringStats();

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Monitoring"
        description="Observability dashboard for LLM runs, costs, and system health."
      />

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Total Runs" value={stats.totalRuns.toString()} />
        <KpiCard
          title="Success Rate"
          value={`${stats.totalRuns > 0 ? Math.round((stats.successfulRuns / stats.totalRuns) * 100) : 0}%`}
        />
        <KpiCard
          title="Total Cost"
          value={`$${stats.totalCostUsd.toFixed(4)}`}
        />
        <KpiCard
          title="Avg Latency"
          value={`${stats.avgLatencyMs}ms`}
        />
      </div>

      {/* Agent Breakdown */}
      <section className="space-y-4">
        <h2 className="h2">Runs by Agent</h2>
        <Card className="ct-border-soft rounded-[var(--ct-radius-lg)] overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--ct-border)]">
                <th className="text-left ct-table-header font-medium ct-text-muted">Agent</th>
                <th className="text-right ct-table-header font-medium ct-text-muted">Runs</th>
                <th className="text-right ct-table-header font-medium ct-text-muted">Cost (USD)</th>
              </tr>
            </thead>
            <tbody>
              {stats.runsByAgent.map((row) => (
                <tr key={row.agentName} className="border-b border-[var(--ct-border-soft)]">
                  <td className="ct-table-cell">{row.agentName}</td>
                  <td className="ct-table-cell text-right tabular">{row.count}</td>
                  <td className="ct-table-cell text-right tabular">${row.costUsd.toFixed(4)}</td>
                </tr>
              ))}
              {stats.runsByAgent.length === 0 && (
                <tr>
                  <td colSpan={3}>
                    <div className="ct-empty-state">No runs recorded yet.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </Card>
      </section>

      {/* Recent Runs */}
      <section className="space-y-4">
        <h2 className="h2">Recent Runs</h2>
        <Card className="ct-border-soft rounded-[var(--ct-radius-lg)] overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--ct-border)]">
                <th className="text-left ct-table-header font-medium ct-text-muted">Agent</th>
                <th className="text-left ct-table-header font-medium ct-text-muted">Model</th>
                <th className="text-left ct-table-header font-medium ct-text-muted">Status</th>
                <th className="text-right ct-table-header font-medium ct-text-muted">Latency</th>
                <th className="text-right ct-table-header font-medium ct-text-muted">Cost</th>
                <th className="text-right ct-table-header font-medium ct-text-muted">Time</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentRuns.map((run) => (
                <tr key={run.id} className="border-b border-[var(--ct-border-soft)]">
                  <td className="ct-table-cell">{run.agentName}</td>
                  <td className="ct-table-cell">{run.model}</td>
                  <td className="ct-table-cell">
                    <StatusBadge status={run.status} />
                  </td>
                  <td className="ct-table-cell text-right tabular">
                    {run.latencyMs ? `${run.latencyMs}ms` : "—"}
                  </td>
                  <td className="ct-table-cell text-right tabular">
                    {run.costUsd ? `$${run.costUsd.toFixed(4)}` : "—"}
                  </td>
                  <td className="ct-table-cell text-right ct-text-muted">
                    {run.createdAt.toLocaleString()}
                  </td>
                </tr>
              ))}
              {stats.recentRuns.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <div className="ct-empty-state">No runs recorded yet.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </Card>
      </section>
    </div>
  );
}

function KpiCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="glass-panel ct-kpi-card relative overflow-hidden">
      <div className="relative z-[var(--ct-z-raised)]">
        <p className="stat-label mb-1">{title}</p>
        <p className="stat-value ct-text-strong">{value}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    success: "ct-status-success-bg",
    failed: "ct-status-danger-bg",
    timeout: "ct-status-warning-bg",
    queued: "ct-status-info-bg",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-[var(--ct-radius-full)] text-xs font-medium ${colors[status] ?? "ct-surface-2 ct-text-muted"}`}
    >
      {status}
    </span>
  );
}
