import type { ReactNode } from "react";

import { EmptySurface } from "@/components/ui/empty-surface";
import { DashboardPanelHeader, SystemPanel } from "@/components/ui/system-panel";
import { cn } from "@/lib/cn";
import type { MonitoringStats } from "@/lib/data/monitoring";
import { formatAdminDateTime } from "@/lib/vaults/product-display";

const EMPTY_COPY = {
  message: "No agent runs recorded yet.",
  detail: "LLM agent invocations will appear here after the first run.",
} as const;

export function MonitoringBoard({ stats }: { stats: MonitoringStats }) {
  if (stats.totalRuns === 0) {
    return <EmptySurface variant="widget" className="min-h-32" {...EMPTY_COPY} />;
  }

  return (
    <div className="admin-doc-stack">
      <div className="admin-doc-kpi-grid-4">
        <KpiTile label="Total Runs" value={stats.totalRuns.toString()} />
        <KpiTile
          label="Success Rate"
          value={`${Math.round((stats.successfulRuns / stats.totalRuns) * 100)}%`}
        />
        <KpiTile label="Total Cost" value={`$${stats.totalCostUsd.toFixed(4)}`} />
        <KpiTile label="Avg Latency" value={`${stats.avgLatencyMs}ms`} />
      </div>

      <section>
        <DashboardPanelHeader title="Runs by Agent" tone="quiet" className="mb-4" />
        <MonitoringTable
          colSpan={3}
          isEmpty={stats.runsByAgent.length === 0}
          header={
            <>
              <th className="ct-table-header px-4 py-3 text-left font-medium ct-text-muted">Agent</th>
              <th className="ct-table-header px-4 py-3 text-right font-medium ct-text-muted">Runs</th>
              <th className="ct-table-header px-4 py-3 text-right font-medium ct-text-muted">Cost (USD)</th>
            </>
          }
        >
          {stats.runsByAgent.map((row) => (
            <tr key={row.agentName}>
              <td className="ct-table-cell px-4">{row.agentName}</td>
              <td className="ct-table-cell px-4 text-right tabular">{row.count}</td>
              <td className="ct-table-cell px-4 text-right tabular">${row.costUsd.toFixed(4)}</td>
            </tr>
          ))}
        </MonitoringTable>
      </section>

      <section>
        <DashboardPanelHeader title="Recent Runs" tone="quiet" className="mb-4" />
        <MonitoringTable
          colSpan={6}
          isEmpty={stats.recentRuns.length === 0}
          header={
            <>
              <th className="ct-table-header px-4 py-3 text-left font-medium ct-text-muted">Agent</th>
              <th className="ct-table-header px-4 py-3 text-left font-medium ct-text-muted">Model</th>
              <th className="ct-table-header px-4 py-3 text-left font-medium ct-text-muted">Status</th>
              <th className="ct-table-header px-4 py-3 text-right font-medium ct-text-muted">Latency</th>
              <th className="ct-table-header px-4 py-3 text-right font-medium ct-text-muted">Cost</th>
              <th className="ct-table-header px-4 py-3 text-right font-medium ct-text-muted">Time</th>
            </>
          }
        >
          {stats.recentRuns.map((run) => (
            <tr key={run.id}>
              <td className="ct-table-cell px-4">{run.agentName}</td>
              <td className="ct-table-cell px-4">{run.model}</td>
              <td className="ct-table-cell px-4">
                <RunStatusBadge status={run.status} />
              </td>
              <td className="ct-table-cell px-4 text-right tabular">
                {run.latencyMs ? `${run.latencyMs}ms` : "—"}
              </td>
              <td className="ct-table-cell px-4 text-right tabular">
                {run.costUsd ? `$${run.costUsd.toFixed(4)}` : "—"}
              </td>
              <td className="ct-table-cell px-4 text-right ct-text-muted">
                {formatAdminDateTime(run.createdAt)}
              </td>
            </tr>
          ))}
        </MonitoringTable>
      </section>
    </div>
  );
}

function KpiTile({ label, value }: { label: string; value: string }) {
  return (
    <SystemPanel className="p-4">
      <p className="stat-label ct-text-muted mb-1">{label}</p>
      <p className="stat-value ct-text-strong tabular">{value}</p>
    </SystemPanel>
  );
}

function MonitoringTable({
  colSpan,
  isEmpty,
  header,
  children,
}: {
  colSpan: number;
  isEmpty: boolean;
  header: ReactNode;
  children: ReactNode;
}) {
  return (
    <SystemPanel className="overflow-hidden p-0">
      <div className="ct-table-surface rounded-none border-0 bg-transparent">
        <table className="w-full body-sm">
          <thead>
            <tr>{header}</tr>
          </thead>
          <tbody>
            {isEmpty ? (
              <tr>
                <td colSpan={colSpan}>
                  <EmptySurface variant="inline" {...EMPTY_COPY} />
                </td>
              </tr>
            ) : (
              children
            )}
          </tbody>
        </table>
      </div>
    </SystemPanel>
  );
}

function RunStatusBadge({ status }: { status: string }) {
  const tone: Record<string, string> = {
    success: "ct-status-success-bg",
    failed: "ct-status-danger-bg",
    timeout: "ct-status-warning-bg",
    queued: "ct-status-info-bg",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 body-xs font-medium",
        tone[status] ?? "ct-surface-2 ct-text-muted",
      )}
    >
      {status}
    </span>
  );
}
