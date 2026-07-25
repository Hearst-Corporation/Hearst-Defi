import type { ReactNode } from "react";

import { BentoHeader, BentoPanel } from "@/components/catalyst/bento";
import { EmptySurface } from "@/components/catalyst/empty-surface";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/catalyst/table";
import { cn } from "@/lib/cn";
import type { MonitoringStats } from "@/lib/data/monitoring";
import { formatAdminDateTime } from "@/lib/vaults/product-display";

const EMPTY_COPY = {
  message: "No monitoring activity recorded yet.",
  detail: "Agent runs, traces, and admin-tool activity will appear here after the first execution.",
} as const;

const HEAD_CLASS = "ct-bento-label bg-transparent";
const CELL_CLASS = "ct-metric-caption align-middle";

export function MonitoringBoard({ stats }: { stats: MonitoringStats }) {
  if (stats.totalRuns === 0) {
    return <EmptySurface variant="widget" className="min-h-32" {...EMPTY_COPY} />;
  }

  return (
    <div className="flex flex-col gap-y-5">
      <MonitoringPanel
        title="Run volume by agent"
        subtitle="Calls & cost per agent"
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
            <TableHeader className={cn(HEAD_CLASS, "text-left")}>
              Agent
            </TableHeader>
            <TableHeader className={cn(HEAD_CLASS, "text-right")}>
              Runs
            </TableHeader>
            <TableHeader className={cn(HEAD_CLASS, "text-right")}>
              Cost (USD)
            </TableHeader>
          </>
        }
      >
        {stats.runsByAgent.map((row) => (
          <TableRow key={row.agentName} className={ROW_CLASS}>
            <TableCell
              className={cn(CELL_CLASS, "font-medium text-[var(--ct-text-strong)]")}
            >
              {row.agentName}
            </TableCell>
            <TableCell
              className={cn(
                CELL_CLASS,
                "text-right tabular-nums text-[var(--ct-text-secondary)]",
              )}
            >
              {row.count}
            </TableCell>
            <TableCell
              className={cn(
                CELL_CLASS,
                "text-right tabular-nums text-[var(--ct-text-secondary)]",
              )}
            >
              ${row.costUsd.toFixed(4)}
            </TableCell>
          </TableRow>
        ))}
      </MonitoringPanel>

      <MonitoringPanel
        title="Recent agent runs"
        subtitle="20 most recent (display cap)"
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
            <TableHeader className={cn(HEAD_CLASS, "text-left")}>
              Agent
            </TableHeader>
            <TableHeader className={cn(HEAD_CLASS, "text-left")}>
              Model
            </TableHeader>
            <TableHeader className={cn(HEAD_CLASS, "text-left whitespace-nowrap")}>
              Status
            </TableHeader>
            <TableHeader
              className={cn(HEAD_CLASS, "text-right whitespace-nowrap")}
            >
              Tokens (in/out)
            </TableHeader>
            <TableHeader
              className={cn(HEAD_CLASS, "text-right whitespace-nowrap")}
            >
              Latency
            </TableHeader>
            <TableHeader className={cn(HEAD_CLASS, "text-right")}>
              Cost
            </TableHeader>
            <TableHeader className={cn(HEAD_CLASS, "text-right")}>
              Time
            </TableHeader>
          </>
        }
      >
        {stats.recentRuns.map((run) => (
          <TableRow key={run.id} className={ROW_CLASS}>
            <TableCell
              className={cn(CELL_CLASS, "font-medium text-[var(--ct-text-strong)]")}
            >
              {run.agentName}
            </TableCell>
            <TableCell
              className={cn(CELL_CLASS, "text-[var(--ct-text-secondary)]")}
            >
              {run.model}
            </TableCell>
            <TableCell className={cn(CELL_CLASS, "whitespace-nowrap")}>
              <RunStatusBadge status={run.status} />
              {run.errorType ? (
                <span className="ml-2 text-[var(--ct-text-muted)]">
                  {run.errorType}
                </span>
              ) : null}
            </TableCell>
            <TableCell
              className={cn(
                CELL_CLASS,
                "text-right tabular-nums whitespace-nowrap text-[var(--ct-text-secondary)]",
              )}
            >
              {run.inputTokens === null || run.outputTokens === null
                ? "—"
                : `${run.inputTokens} / ${run.outputTokens}`}
            </TableCell>
            <TableCell
              className={cn(
                CELL_CLASS,
                "text-right tabular-nums text-[var(--ct-text-secondary)]",
              )}
            >
              {run.latencyMs ? `${run.latencyMs}ms` : "—"}
            </TableCell>
            <TableCell
              className={cn(
                CELL_CLASS,
                "text-right tabular-nums text-[var(--ct-text-secondary)]",
              )}
            >
              {run.costUsd ? `$${run.costUsd.toFixed(4)}` : "—"}
            </TableCell>
            <TableCell
              className={cn(
                CELL_CLASS,
                "text-right text-[var(--ct-text-muted)]",
              )}
            >
              {formatAdminDateTime(run.createdAt)}
            </TableCell>
          </TableRow>
        ))}
      </MonitoringPanel>

      <MonitoringPanel
        title="Navigation traces"
        subtitle="Master Agent routing · 20 most recent (display cap)"
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
            <TableHeader
              className={cn(HEAD_CLASS, "text-left whitespace-nowrap")}
            >
              Profile
            </TableHeader>
            <TableHeader className={cn(HEAD_CLASS, "text-left whitespace-nowrap")}>
              Mode
            </TableHeader>
            <TableHeader className={cn(HEAD_CLASS, "text-left")}>
              Destination
            </TableHeader>
            <TableHeader className={cn(HEAD_CLASS, "text-left whitespace-nowrap")}>
              Status
            </TableHeader>
            <TableHeader className={cn(HEAD_CLASS, "text-left")}>
              Reason
            </TableHeader>
            <TableHeader className={cn(HEAD_CLASS, "text-right")}>
              Time
            </TableHeader>
          </>
        }
      >
        {stats.recentNavTraces.map((trace) => (
          <TableRow key={trace.id} className={ROW_CLASS}>
            <TableCell
              className={cn(
                CELL_CLASS,
                "whitespace-nowrap font-medium text-[var(--ct-text-strong)]",
              )}
            >
              {trace.profile}
            </TableCell>
            <TableCell
              className={cn(
                CELL_CLASS,
                "whitespace-nowrap text-[var(--ct-text-secondary)]",
              )}
            >
              {trace.mode}
            </TableCell>
            <TableCell
              className={cn(CELL_CLASS, "text-[var(--ct-text-secondary)]")}
            >
              {trace.destinationKey ?? "—"}
            </TableCell>
            <TableCell className={cn(CELL_CLASS, "whitespace-nowrap")}>
              <RunStatusBadge status={trace.status} />
            </TableCell>
            <TableCell className={cn(CELL_CLASS, "text-[var(--ct-text-muted)]")}>
              {trace.reason ?? "—"}
            </TableCell>
            <TableCell
              className={cn(
                CELL_CLASS,
                "text-right text-[var(--ct-text-muted)]",
              )}
            >
              {formatAdminDateTime(trace.createdAt)}
            </TableCell>
          </TableRow>
        ))}
      </MonitoringPanel>

      <MonitoringPanel
        title="Admin tool activity"
        subtitle="Read & write tool runs · 20 most recent (display cap)"
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
            <TableHeader className={cn(HEAD_CLASS, "text-left")}>
              Tool
            </TableHeader>
            <TableHeader className={cn(HEAD_CLASS, "text-left whitespace-nowrap")}>
              Kind
            </TableHeader>
            <TableHeader className={cn(HEAD_CLASS, "text-left whitespace-nowrap")}>
              Status
            </TableHeader>
            <TableHeader className={cn(HEAD_CLASS, "text-left")}>
              Error
            </TableHeader>
            <TableHeader className={cn(HEAD_CLASS, "text-right")}>
              Time
            </TableHeader>
          </>
        }
      >
        {stats.recentToolRuns.map((run) => (
          <TableRow key={run.id} className={ROW_CLASS}>
            <TableCell
              className={cn(CELL_CLASS, "font-medium text-[var(--ct-text-strong)]")}
            >
              {run.toolId}
            </TableCell>
            <TableCell
              className={cn(
                CELL_CLASS,
                "whitespace-nowrap text-[var(--ct-text-secondary)]",
              )}
            >
              {run.toolKind}
            </TableCell>
            <TableCell className={cn(CELL_CLASS, "whitespace-nowrap")}>
              <RunStatusBadge status={run.status} />
            </TableCell>
            <TableCell className={cn(CELL_CLASS, "text-[var(--ct-text-muted)]")}>
              {run.errorMessage ?? "—"}
            </TableCell>
            <TableCell
              className={cn(
                CELL_CLASS,
                "text-right text-[var(--ct-text-muted)]",
              )}
            >
              {formatAdminDateTime(run.createdAt)}
            </TableCell>
          </TableRow>
        ))}
      </MonitoringPanel>
    </div>
  );
}

const ROW_CLASS =
  "transition-colors hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_2%,transparent)]";

/** Bento panel wrapping a Portfolio-style table (header + body) via Catalyst primitives. */
function MonitoringPanel({
  title,
  subtitle,
  colSpan,
  isEmpty,
  colgroup,
  header,
  children,
}: {
  title: string;
  subtitle: string;
  colSpan: number;
  isEmpty: boolean;
  colgroup?: ReactNode;
  header: ReactNode;
  children: ReactNode;
}) {
  return (
    <BentoPanel>
      <BentoHeader title={title} subtitle={subtitle} as="h3" />
      <Table>
        {colgroup}
        <TableHead>
          <TableRow>{header}</TableRow>
        </TableHead>
        <TableBody>
          {isEmpty ? (
            <TableRow>
              <TableCell colSpan={colSpan} className="py-8 text-center">
                <p className="ct-metric-value text-[var(--ct-text-secondary)]">
                  {EMPTY_COPY.message}
                </p>
                <p className="ct-metric-caption mt-1">{EMPTY_COPY.detail}</p>
              </TableCell>
            </TableRow>
          ) : (
            children
          )}
        </TableBody>
      </Table>
    </BentoPanel>
  );
}

/**
 * Status pill — single-accent color map (--ct-* tokens, ADR-013).
 * success/published = accent (--ct-accent), failed = danger,
 * timeout/blocked = warning, queued/confirmation_required = neutral.
 */
const ACCENT_TONE =
  "border-[color-mix(in_srgb,var(--ct-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--ct-accent)_10%,transparent)] text-[var(--ct-accent)]";
const DANGER_TONE =
  "border-[color-mix(in_srgb,var(--ct-status-danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--ct-status-danger)_10%,transparent)] text-[var(--ct-status-danger)]";
const WARNING_TONE =
  "border-[color-mix(in_srgb,var(--ct-status-warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--ct-status-warning)_10%,transparent)] text-[var(--ct-status-warning)]";
const NEUTRAL_TONE =
  "border-[var(--ct-border)] bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] text-[var(--ct-text-secondary)]";

function RunStatusBadge({ status }: { status: string }) {
  const toneMap: Record<string, string> = {
    success: ACCENT_TONE,
    published: ACCENT_TONE,
    failed: DANGER_TONE,
    timeout: WARNING_TONE,
    blocked: WARNING_TONE,
    queued: NEUTRAL_TONE,
    confirmation_required: NEUTRAL_TONE,
  };

  return (
    <span
      className={cn(
        "ct-bento-label inline-flex items-center rounded-md border px-2 py-0.5",
        toneMap[status] ?? NEUTRAL_TONE,
      )}
    >
      {status}
    </span>
  );
}
