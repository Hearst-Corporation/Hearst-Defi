import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptySurface } from "@/components/ui/empty-surface";
import { PanelStatus } from "@/components/ui/panel-status";
import { DashboardPanelHeader } from "@/components/ui/dashboard-panel-header";
import type { MonitoringStats } from "@/lib/data/monitoring";
import { formatAdminDateTime } from "@/lib/vaults/product-display";

const EMPTY_COPY = {
  message: "No monitoring activity recorded yet.",
  detail: "Agent runs, traces, and admin-tool activity will appear here after the first execution.",
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
        {stats.complianceBlockedRuns > 0 ? (
          <KpiTile
            label="Chat compliance blocked"
            value={stats.complianceBlockedRuns.toString()}
          />
        ) : null}
      </div>

      <section>
        <DashboardPanelHeader title="Run volume by agent" tone="quiet" className="mb-[var(--ct-space-4)]" />
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
              <th className="stat-label ct-table-header px-[var(--ct-space-4)] py-[var(--ct-space-3)] text-left">Agent</th>
              <th className="stat-label ct-table-header px-[var(--ct-space-4)] py-[var(--ct-space-3)] text-right">Runs</th>
              <th className="stat-label ct-table-header px-[var(--ct-space-4)] py-[var(--ct-space-3)] text-right">Cost (USD)</th>
            </>
          }
        >
          {stats.runsByAgent.map((row) => (
            <tr key={row.agentName}>
              <td className="ct-table-cell px-[var(--ct-space-4)]">{row.agentName}</td>
              <td className="ct-table-cell px-[var(--ct-space-4)] text-right tabular">{row.count}</td>
              <td className="ct-table-cell px-[var(--ct-space-4)] text-right tabular">${row.costUsd.toFixed(4)}</td>
            </tr>
          ))}
        </MonitoringTable>
      </section>

      <section>
        <DashboardPanelHeader title="Recent agent runs" tone="quiet" className="mb-[var(--ct-space-4)]" />
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
              <th className="stat-label ct-table-header px-[var(--ct-space-4)] py-[var(--ct-space-3)] text-left">Agent</th>
              <th className="stat-label ct-table-header px-[var(--ct-space-4)] py-[var(--ct-space-3)] text-left">Model</th>
              <th className="stat-label ct-table-header px-[var(--ct-space-4)] py-[var(--ct-space-3)] text-left whitespace-nowrap">Status</th>
              <th className="stat-label ct-table-header px-[var(--ct-space-4)] py-[var(--ct-space-3)] text-right whitespace-nowrap">Tokens (in/out)</th>
              <th className="stat-label ct-table-header px-[var(--ct-space-4)] py-[var(--ct-space-3)] text-right whitespace-nowrap">Latency</th>
              <th className="stat-label ct-table-header px-[var(--ct-space-4)] py-[var(--ct-space-3)] text-right">Cost</th>
              <th className="stat-label ct-table-header px-[var(--ct-space-4)] py-[var(--ct-space-3)] text-right">Time</th>
            </>
          }
        >
          {stats.recentRuns.map((run) => (
            <tr key={run.id}>
              <td className="ct-table-cell px-[var(--ct-space-4)]">{run.agentName}</td>
              <td className="ct-table-cell px-[var(--ct-space-4)]">{run.model}</td>
              <td className="ct-table-cell px-[var(--ct-space-4)] whitespace-nowrap">
                <RunStatusBadge status={run.status} />
                {run.errorType ? (
                  <span className="ct-text-muted ml-[var(--ct-space-2)]">{run.errorType}</span>
                ) : null}
              </td>
              <td className="ct-table-cell px-[var(--ct-space-4)] text-right tabular whitespace-nowrap">
                {run.inputTokens === null || run.outputTokens === null
                  ? "—"
                  : `${run.inputTokens} / ${run.outputTokens}`}
              </td>
              <td className="ct-table-cell px-[var(--ct-space-4)] text-right tabular">
                {run.latencyMs ? `${run.latencyMs}ms` : "—"}
              </td>
              <td className="ct-table-cell px-[var(--ct-space-4)] text-right tabular">
                {run.costUsd ? `$${run.costUsd.toFixed(4)}` : "—"}
              </td>
              <td className="ct-table-cell px-[var(--ct-space-4)] text-right ct-text-muted">
                {formatAdminDateTime(run.createdAt)}
              </td>
            </tr>
          ))}
        </MonitoringTable>
      </section>

      <section>
        <DashboardPanelHeader title="Navigation traces" tone="quiet" className="mb-[var(--ct-space-4)]" />
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
              <th className="stat-label ct-table-header px-[var(--ct-space-4)] py-[var(--ct-space-3)] text-left whitespace-nowrap">Profile</th>
              <th className="stat-label ct-table-header px-[var(--ct-space-4)] py-[var(--ct-space-3)] text-left whitespace-nowrap">Mode</th>
              <th className="stat-label ct-table-header px-[var(--ct-space-4)] py-[var(--ct-space-3)] text-left">Destination</th>
              <th className="stat-label ct-table-header px-[var(--ct-space-4)] py-[var(--ct-space-3)] text-left whitespace-nowrap">Status</th>
              <th className="stat-label ct-table-header px-[var(--ct-space-4)] py-[var(--ct-space-3)] text-left">Reason</th>
              <th className="stat-label ct-table-header px-[var(--ct-space-4)] py-[var(--ct-space-3)] text-right">Time</th>
            </>
          }
        >
          {stats.recentNavTraces.map((trace) => (
            <tr key={trace.id}>
              <td className="ct-table-cell px-[var(--ct-space-4)] whitespace-nowrap">{trace.profile}</td>
              <td className="ct-table-cell px-[var(--ct-space-4)] whitespace-nowrap">{trace.mode}</td>
              <td className="ct-table-cell px-[var(--ct-space-4)]">{trace.destinationKey ?? "—"}</td>
              <td className="ct-table-cell px-[var(--ct-space-4)] whitespace-nowrap">
                <RunStatusBadge status={trace.status} />
              </td>
              <td className="ct-table-cell px-[var(--ct-space-4)] ct-text-muted">{trace.reason ?? "—"}</td>
              <td className="ct-table-cell px-[var(--ct-space-4)] text-right ct-text-muted">
                {formatAdminDateTime(trace.createdAt)}
              </td>
            </tr>
          ))}
        </MonitoringTable>
      </section>

      <section>
        <DashboardPanelHeader title="Admin tool activity" tone="quiet" className="mb-[var(--ct-space-4)]" />
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
              <th className="stat-label ct-table-header px-[var(--ct-space-4)] py-[var(--ct-space-3)] text-left">Tool</th>
              <th className="stat-label ct-table-header px-[var(--ct-space-4)] py-[var(--ct-space-3)] text-left whitespace-nowrap">Kind</th>
              <th className="stat-label ct-table-header px-[var(--ct-space-4)] py-[var(--ct-space-3)] text-left whitespace-nowrap">Status</th>
              <th className="stat-label ct-table-header px-[var(--ct-space-4)] py-[var(--ct-space-3)] text-left">Error</th>
              <th className="stat-label ct-table-header px-[var(--ct-space-4)] py-[var(--ct-space-3)] text-right">Time</th>
            </>
          }
        >
          {stats.recentToolRuns.map((run) => (
            <tr key={run.id}>
              <td className="ct-table-cell px-[var(--ct-space-4)]">{run.toolId}</td>
              <td className="ct-table-cell px-[var(--ct-space-4)] whitespace-nowrap">{run.toolKind}</td>
              <td className="ct-table-cell px-[var(--ct-space-4)] whitespace-nowrap">
                <RunStatusBadge status={run.status} />
              </td>
              <td className="ct-table-cell px-[var(--ct-space-4)] ct-text-muted">{run.errorMessage ?? "—"}</td>
              <td className="ct-table-cell px-[var(--ct-space-4)] text-right ct-text-muted">
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
      <p className="stat-label ct-text-muted mb-[var(--ct-space-1)]">{label}</p>
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
