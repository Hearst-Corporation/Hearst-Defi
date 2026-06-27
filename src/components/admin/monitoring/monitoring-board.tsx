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
            <Td className="pl-5 font-medium text-white">{row.agentName}</Td>
            <Td className="text-right tabular-nums text-zinc-300">{row.count}</Td>
            <Td className="pr-5 text-right tabular-nums text-zinc-300">
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
            <Td className="pl-5 font-medium text-white">{run.agentName}</Td>
            <Td className="text-zinc-300">{run.model}</Td>
            <Td className="whitespace-nowrap">
              <RunStatusBadge status={run.status} />
              {run.errorType ? (
                <span className="ml-2 text-zinc-500">{run.errorType}</span>
              ) : null}
            </Td>
            <Td className="text-right tabular-nums whitespace-nowrap text-zinc-300">
              {run.inputTokens === null || run.outputTokens === null
                ? "—"
                : `${run.inputTokens} / ${run.outputTokens}`}
            </Td>
            <Td className="text-right tabular-nums text-zinc-300">
              {run.latencyMs ? `${run.latencyMs}ms` : "—"}
            </Td>
            <Td className="text-right tabular-nums text-zinc-300">
              {run.costUsd ? `$${run.costUsd.toFixed(4)}` : "—"}
            </Td>
            <Td className="pr-5 text-right text-zinc-500">
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
            <Td className="pl-5 whitespace-nowrap font-medium text-white">
              {trace.profile}
            </Td>
            <Td className="whitespace-nowrap text-zinc-300">{trace.mode}</Td>
            <Td className="text-zinc-300">{trace.destinationKey ?? "—"}</Td>
            <Td className="whitespace-nowrap">
              <RunStatusBadge status={trace.status} />
            </Td>
            <Td className="text-zinc-500">{trace.reason ?? "—"}</Td>
            <Td className="pr-5 text-right text-zinc-500">
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
            <Td className="pl-5 font-medium text-white">{run.toolId}</Td>
            <Td className="whitespace-nowrap text-zinc-300">{run.toolKind}</Td>
            <Td className="whitespace-nowrap">
              <RunStatusBadge status={run.status} />
            </Td>
            <Td className="text-zinc-500">{run.errorMessage ?? "—"}</Td>
            <Td className="pr-5 text-right text-zinc-500">
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
        <table className="min-w-full table-fixed text-[13px]">
          {colgroup}
          <thead>
            <tr className="border-b border-white/5">{header}</tr>
          </thead>
          <tbody>
            {isEmpty ? (
              <tr>
                <td colSpan={colSpan} className="px-5 py-8 text-center">
                  <p className="text-[13px] font-medium text-zinc-400">
                    {EMPTY_COPY.message}
                  </p>
                  <p className="mt-1 text-[12px] text-zinc-500">
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
        "bg-transparent px-4 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500",
        className,
      )}
    >
      {children}
    </th>
  );
}

function Tr({ children }: { children: ReactNode }) {
  return (
    <tr className="border-b border-white/5 transition-colors last:border-b-0 hover:bg-white/[0.02]">
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
  return <td className={cn("px-4 py-3 align-middle", className)}>{children}</td>;
}

/**
 * Status pill — bento color map.
 * success/published = accent green #A7FB90, failed = red-400,
 * timeout/blocked = amber-400, queued/confirmation_required = zinc.
 */
function RunStatusBadge({ status }: { status: string }) {
  const toneMap: Record<string, string> = {
    success: "border-[#A7FB90]/30 bg-[#A7FB90]/10 text-[#A7FB90]",
    published: "border-[#A7FB90]/30 bg-[#A7FB90]/10 text-[#A7FB90]",
    failed: "border-red-400/30 bg-red-400/10 text-red-400",
    timeout: "border-amber-400/30 bg-amber-400/10 text-amber-400",
    blocked: "border-amber-400/30 bg-amber-400/10 text-amber-400",
    queued: "border-white/10 bg-white/5 text-zinc-400",
    confirmation_required: "border-white/10 bg-white/5 text-zinc-400",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        toneMap[status] ?? "border-white/10 bg-white/5 text-zinc-400",
      )}
    >
      {status}
    </span>
  );
}
