import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { EmptySurface } from "@/components/ui/empty-surface";
import { SystemPanel } from "@/components/ui/system-panel";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getMonitoringStats } from "@/lib/data/monitoring";

export const dynamic = "force-dynamic";

export default async function MonitoringPage() {
  await requireAdmin();
  const stats = await getMonitoringStats();
  const hasRuns = stats.totalRuns > 0;

  return (
    <div className="space-y-8">
      <AdminPageHeader title="Monitoring" />

      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard
          title="Total Runs"
          value={hasRuns ? stats.totalRuns.toString() : "—"}
          awaiting={!hasRuns}
        />
        <KpiCard
          title="Success Rate"
          value={
            hasRuns
              ? `${Math.round((stats.successfulRuns / stats.totalRuns) * 100)}%`
              : "—"
          }
          awaiting={!hasRuns}
        />
        <KpiCard
          title="Total Cost"
          value={hasRuns ? `$${stats.totalCostUsd.toFixed(4)}` : "—"}
          awaiting={!hasRuns}
        />
        <KpiCard
          title="Avg Latency"
          value={hasRuns ? `${stats.avgLatencyMs}ms` : "—"}
          awaiting={!hasRuns}
        />
      </div>

      <section className="space-y-4">
        <h2 className="h2">Runs by Agent</h2>
        <SystemPanel className="p-0 overflow-hidden">
          <div className="ct-table-surface border-0 rounded-none bg-transparent">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left ct-table-header font-medium ct-text-muted px-4 py-3">
                    Agent
                  </th>
                  <th className="text-right ct-table-header font-medium ct-text-muted px-4 py-3">
                    Runs
                  </th>
                  <th className="text-right ct-table-header font-medium ct-text-muted px-4 py-3">
                    Cost (USD)
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.runsByAgent.map((row) => (
                  <tr key={row.agentName}>
                    <td className="ct-table-cell px-4">{row.agentName}</td>
                    <td className="ct-table-cell px-4 text-right tabular">{row.count}</td>
                    <td className="ct-table-cell px-4 text-right tabular">
                      ${row.costUsd.toFixed(4)}
                    </td>
                  </tr>
                ))}
                {stats.runsByAgent.length === 0 ? (
                  <tr>
                    <td colSpan={3}>
                      <EmptySurface variant="inline" message="No agent runs recorded yet." />
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </SystemPanel>
      </section>

      <section className="space-y-4">
        <h2 className="h2">Recent Runs</h2>
        <SystemPanel className="p-0 overflow-hidden">
          <div className="ct-table-surface border-0 rounded-none bg-transparent">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left ct-table-header font-medium ct-text-muted px-4 py-3">
                    Agent
                  </th>
                  <th className="text-left ct-table-header font-medium ct-text-muted px-4 py-3">
                    Model
                  </th>
                  <th className="text-left ct-table-header font-medium ct-text-muted px-4 py-3">
                    Status
                  </th>
                  <th className="text-right ct-table-header font-medium ct-text-muted px-4 py-3">
                    Latency
                  </th>
                  <th className="text-right ct-table-header font-medium ct-text-muted px-4 py-3">
                    Cost
                  </th>
                  <th className="text-right ct-table-header font-medium ct-text-muted px-4 py-3">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.recentRuns.map((run) => (
                  <tr key={run.id}>
                    <td className="ct-table-cell px-4">{run.agentName}</td>
                    <td className="ct-table-cell px-4">{run.model}</td>
                    <td className="ct-table-cell px-4">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="ct-table-cell px-4 text-right tabular">
                      {run.latencyMs ? `${run.latencyMs}ms` : "—"}
                    </td>
                    <td className="ct-table-cell px-4 text-right tabular">
                      {run.costUsd ? `$${run.costUsd.toFixed(4)}` : "—"}
                    </td>
                    <td className="ct-table-cell px-4 text-right ct-text-muted">
                      {run.createdAt.toLocaleString()}
                    </td>
                  </tr>
                ))}
                {stats.recentRuns.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <EmptySurface variant="inline" message="No runs recorded yet." />
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </SystemPanel>
      </section>
    </div>
  );
}

function KpiCard({
  title,
  value,
  awaiting = false,
}: {
  title: string;
  value: string;
  awaiting?: boolean;
}) {
  return (
    <SystemPanel className="p-4">
      <p className="ct-table-header font-medium ct-text-muted mb-1">{title}</p>
      <p className={awaiting ? "body-md ct-text-faint tabular" : "stat-value ct-text-strong tabular"}>
        {value}
      </p>
      {awaiting ? (
        <p className="body-xs ct-text-faint mt-1">Awaiting first run</p>
      ) : null}
    </SystemPanel>
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
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] ?? "ct-surface-2 ct-text-muted"}`}
    >
      {status}
    </span>
  );
}
