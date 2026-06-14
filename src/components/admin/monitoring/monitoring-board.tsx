import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptySurface } from "@/components/ui/empty-surface";
import { PanelStatus } from "@/components/ui/panel-status";
import { DashboardPanelHeader } from "@/components/ui/dashboard-panel-header";
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
          colgroup={
            <colgroup>
              <col style={{ width: "60%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "20%" }} />
            </colgroup>
          }
          header={
            <>
              <th className="stat-label ct-table-header px-4 py-3 text-left">Agent</th>
              <th className="stat-label ct-table-header px-4 py-3 text-right">Runs</th>
              <th className="stat-label ct-table-header px-4 py-3 text-right">Cost (USD)</th>
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
          colSpan={7}
          isEmpty={stats.recentRuns.length === 0}
          colgroup={
            <colgroup>
              <col style={{ width: "20%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "18%" }} />
            </colgroup>
          }
          header={
            <>
              <th className="stat-label ct-table-header px-4 py-3 text-left">Agent</th>
              <th className="stat-label ct-table-header px-4 py-3 text-left">Model</th>
              <th className="stat-label ct-table-header px-4 py-3 text-left">Status</th>
              <th className="stat-label ct-table-header px-4 py-3 text-right">Tokens (in/out)</th>
              <th className="stat-label ct-table-header px-4 py-3 text-right">Latency</th>
              <th className="stat-label ct-table-header px-4 py-3 text-right">Cost</th>
              <th className="stat-label ct-table-header px-4 py-3 text-right">Time</th>
            </>
          }
        >
          {stats.recentRuns.map((run) => (
            <tr key={run.id}>
              <td className="ct-table-cell px-4">{run.agentName}</td>
              <td className="ct-table-cell px-4">{run.model}</td>
              <td className="ct-table-cell px-4">
                <RunStatusBadge status={run.status} />
                {run.errorType ? (
                  <span className="ct-text-muted ml-2">{run.errorType}</span>
                ) : null}
              </td>
              <td className="ct-table-cell px-4 text-right tabular">
                {run.inputTokens === null && run.outputTokens === null
                  ? "—"
                  : `${run.inputTokens ?? "—"} / ${run.outputTokens ?? "—"}`}
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

      <section>
        <DashboardPanelHeader title="Navigate Traces" tone="quiet" className="mb-4" />
        <MonitoringTable
          colSpan={6}
          isEmpty={stats.recentNavTraces.length === 0}
          colgroup={
            <colgroup>
              <col style={{ width: "12%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "24%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "18%" }} />
            </colgroup>
          }
          header={
            <>
              <th className="stat-label ct-table-header px-4 py-3 text-left">Profile</th>
              <th className="stat-label ct-table-header px-4 py-3 text-left">Mode</th>
              <th className="stat-label ct-table-header px-4 py-3 text-left">Destination</th>
              <th className="stat-label ct-table-header px-4 py-3 text-left">Status</th>
              <th className="stat-label ct-table-header px-4 py-3 text-left">Reason</th>
              <th className="stat-label ct-table-header px-4 py-3 text-right">Time</th>
            </>
          }
        >
          {stats.recentNavTraces.map((trace) => (
            <tr key={trace.id}>
              <td className="ct-table-cell px-4">{trace.profile}</td>
              <td className="ct-table-cell px-4">{trace.mode}</td>
              <td className="ct-table-cell px-4">{trace.destinationKey ?? "—"}</td>
              <td className="ct-table-cell px-4">
                <RunStatusBadge status={trace.status} />
              </td>
              <td className="ct-table-cell px-4 ct-text-muted">{trace.reason ?? "—"}</td>
              <td className="ct-table-cell px-4 text-right ct-text-muted">
                {formatAdminDateTime(trace.createdAt)}
              </td>
            </tr>
          ))}
        </MonitoringTable>
      </section>

      <section>
        <DashboardPanelHeader title="Admin Tool Runs" tone="quiet" className="mb-4" />
        <MonitoringTable
          colSpan={5}
          isEmpty={stats.recentToolRuns.length === 0}
          colgroup={
            <colgroup>
              <col style={{ width: "30%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "24%" }} />
              <col style={{ width: "18%" }} />
            </colgroup>
          }
          header={
            <>
              <th className="stat-label ct-table-header px-4 py-3 text-left">Tool</th>
              <th className="stat-label ct-table-header px-4 py-3 text-left">Kind</th>
              <th className="stat-label ct-table-header px-4 py-3 text-left">Status</th>
              <th className="stat-label ct-table-header px-4 py-3 text-left">Error</th>
              <th className="stat-label ct-table-header px-4 py-3 text-right">Time</th>
            </>
          }
        >
          {stats.recentToolRuns.map((run) => (
            <tr key={run.id}>
              <td className="ct-table-cell px-4">{run.toolId}</td>
              <td className="ct-table-cell px-4">{run.toolKind}</td>
              <td className="ct-table-cell px-4">
                <RunStatusBadge status={run.status} />
              </td>
              <td className="ct-table-cell px-4 ct-text-muted">{run.errorMessage ?? "—"}</td>
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
    <Card>
      <p className="stat-label ct-text-muted mb-1">{label}</p>
      <p className="stat-value ct-text-strong tabular">{value}</p>
    </Card>
  );
}

function MonitoringTable({
  colSpan,
  isEmpty,
  colgroup,
  header,
  children,
}: {
  colSpan: number;
  isEmpty: boolean;
  colgroup?: ReactNode;
  header: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="p-0 overflow-hidden" hoverOverlay={false}>
      <div className="overflow-x-auto">
        <table className="min-w-full table-fixed body-sm">
          {colgroup}
          <thead>
            <tr>{header}</tr>
          </thead>
          <tbody>
            {isEmpty ? (
              <tr>
                <td colSpan={colSpan}>
                  <PanelStatus {...EMPTY_COPY} />
                </td>
              </tr>
            ) : (
              children
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function RunStatusBadge({ status }: { status: string }) {
  const variantMap: Record<string, "success" | "danger" | "warning" | "default"> = {
    success: "success",
    published: "success",
    failed: "danger",
    timeout: "warning",
    blocked: "warning",
    queued: "default",
    confirmation_required: "default",
  };

  return (
    <Badge variant={variantMap[status] ?? "default"}>
      {status}
    </Badge>
  );
}
