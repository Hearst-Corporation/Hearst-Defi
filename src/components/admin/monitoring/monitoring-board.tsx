import type { ReactNode } from "react";

import { BentoHeader, BentoPanel } from "@/components/ui/bento";
import { EmptySurface } from "@/components/ui/empty-surface";
import { cn } from "@/lib/cn";
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
            <Th className="pl-5 text-left">Agent</Th>
            <Th className="text-right">Runs</Th>
            <Th className="pr-5 text-right">Cost (USD)</Th>
          </>
        }
      >
        {stats.runsByAgent.map((row) => (
          <Tr key={row.agentName}>
            <Td className="pl-5 font-medium text-[var(--ct-text-strong)]">
              {row.agentName}
            </Td>
            <Td className="text-right tabular-nums text-[var(--ct-text-secondary)]">
              {row.count}
            </Td>
            <Td className="pr-5 text-right tabular-nums text-[var(--ct-text-secondary)]">
              ${row.costUsd.toFixed(4)}
            </Td>
          </Tr>
        ))}
      </MonitoringPanel>

      <MonitoringPanel
        title="Recent agent runs"
        subtitle="Latest executions"
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
            <Th className="pl-5 text-left">Agent</Th>
            <Th className="text-left">Model</Th>
            <Th className="text-left whitespace-nowrap">Status</Th>
            <Th className="text-right whitespace-nowrap">Tokens (in/out)</Th>
            <Th className="text-right whitespace-nowrap">Latency</Th>
            <Th className="text-right">Cost</Th>
            <Th className="pr-5 text-right">Time</Th>
          </>
        }
      >
        {stats.recentRuns.map((run) => (
          <Tr key={run.id}>
            <Td className="pl-5 font-medium text-[var(--ct-text-strong)]">
              {run.agentName}
            </Td>
            <Td className="text-[var(--ct-text-secondary)]">{run.model}</Td>
            <Td className="whitespace-nowrap">
              <RunStatusBadge status={run.status} />
              {run.errorType ? (
                <span className="ml-2 text-[var(--ct-text-muted)]">
                  {run.errorType}
                </span>
              ) : null}
            </Td>
            <Td className="text-right tabular-nums whitespace-nowrap text-[var(--ct-text-secondary)]">
              {run.inputTokens === null || run.outputTokens === null
                ? "—"
                : `${run.inputTokens} / ${run.outputTokens}`}
            </Td>
            <Td className="text-right tabular-nums text-[var(--ct-text-secondary)]">
              {run.latencyMs ? `${run.latencyMs}ms` : "—"}
            </Td>
            <Td className="text-right tabular-nums text-[var(--ct-text-secondary)]">
              {run.costUsd ? `$${run.costUsd.toFixed(4)}` : "—"}
            </Td>
            <Td className="pr-5 text-right text-[var(--ct-text-muted)]">
              {formatAdminDateTime(run.createdAt)}
            </Td>
          </Tr>
        ))}
      </MonitoringPanel>

      <MonitoringPanel
        title="Navigation traces"
        subtitle="Master Agent routing"
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
            <Th className="pl-5 text-left whitespace-nowrap">Profile</Th>
            <Th className="text-left whitespace-nowrap">Mode</Th>
            <Th className="text-left">Destination</Th>
            <Th className="text-left whitespace-nowrap">Status</Th>
            <Th className="text-left">Reason</Th>
            <Th className="pr-5 text-right">Time</Th>
          </>
        }
      >
        {stats.recentNavTraces.map((trace) => (
          <Tr key={trace.id}>
            <Td className="pl-5 whitespace-nowrap font-medium text-[var(--ct-text-strong)]">
              {trace.profile}
            </Td>
            <Td className="whitespace-nowrap text-[var(--ct-text-secondary)]">
              {trace.mode}
            </Td>
            <Td className="text-[var(--ct-text-secondary)]">
              {trace.destinationKey ?? "—"}
            </Td>
            <Td className="whitespace-nowrap">
              <RunStatusBadge status={trace.status} />
            </Td>
            <Td className="text-[var(--ct-text-muted)]">{trace.reason ?? "—"}</Td>
            <Td className="pr-5 text-right text-[var(--ct-text-muted)]">
              {formatAdminDateTime(trace.createdAt)}
            </Td>
          </Tr>
        ))}
      </MonitoringPanel>

      <MonitoringPanel
        title="Admin tool activity"
        subtitle="Read & write tool runs"
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
            <Th className="pl-5 text-left">Tool</Th>
            <Th className="text-left whitespace-nowrap">Kind</Th>
            <Th className="text-left whitespace-nowrap">Status</Th>
            <Th className="text-left">Error</Th>
            <Th className="pr-5 text-right">Time</Th>
          </>
        }
      >
        {stats.recentToolRuns.map((run) => (
          <Tr key={run.id}>
            <Td className="pl-5 font-medium text-[var(--ct-text-strong)]">
              {run.toolId}
            </Td>
            <Td className="whitespace-nowrap text-[var(--ct-text-secondary)]">
              {run.toolKind}
            </Td>
            <Td className="whitespace-nowrap">
              <RunStatusBadge status={run.status} />
            </Td>
            <Td className="text-[var(--ct-text-muted)]">
              {run.errorMessage ?? "—"}
            </Td>
            <Td className="pr-5 text-right text-[var(--ct-text-muted)]">
              {formatAdminDateTime(run.createdAt)}
            </Td>
          </Tr>
        ))}
      </MonitoringPanel>
    </div>
  );
}

/** Bento panel wrapping a Portfolio-style fixed table (header + body). */
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
      <div className="overflow-x-auto">
        <table className="min-w-full table-fixed">
          {colgroup}
          <thead>
            <tr className="border-b border-[var(--ct-border-soft)]">{header}</tr>
          </thead>
          <tbody>
            {isEmpty ? (
              <tr>
                <td colSpan={colSpan} className="px-5 py-8 text-center">
                  <p className="ct-metric-value text-[var(--ct-text-secondary)]">
                    {EMPTY_COPY.message}
                  </p>
                  <p className="ct-metric-caption mt-1">
                    {EMPTY_COPY.detail}
                  </p>
                </td>
              </tr>
            ) : (
              children
            )}
          </tbody>
        </table>
      </div>
    </BentoPanel>
  );
}

function Th({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "ct-bento-label bg-transparent px-4 py-3 text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

function Tr({ children }: { children: ReactNode }) {
  return (
    <tr className="border-b border-[var(--ct-border-soft)] transition-colors last:border-b-0 hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_2%,transparent)]">
      {children}
    </tr>
  );
}

function Td({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <td className={cn("ct-metric-caption px-4 py-3 align-middle", className)}>
      {children}
    </td>
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
