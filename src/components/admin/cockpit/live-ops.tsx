import Link from "next/link";

import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { explorerTxUrl, isPlaceholderTxHash } from "@/lib/chain/client";
import type {
  InngestJob,
  InngestJobStatus,
  OnChainEvent,
  SentryStats,
} from "@/lib/data/cockpit";

interface LiveOpsProps {
  inngestJobs: InngestJob[];
  sentryStats: SentryStats;
  onChainEvents: OnChainEvent[];
}

/**
 * Cockpit Admin — Live Ops content (no panel wrapper/header — provided by parent cell).
 *
 * Sections:
 *  1. Inngest job status rows (ok/err/pending/unknown)
 *  2. Sentry 24h error + warning count
 *  3. On-chain feed — last 5 events
 */
export function LiveOps({ inngestJobs, sentryStats, onChainEvents }: LiveOpsProps) {
  return (
    <div aria-label="Platform status" className="flex flex-col gap-6">

      {/* INNGEST JOBS */}
      <section className="flex flex-col">
        <header className="flex items-center justify-between mb-2.5">
          <h3 className="text-[length:var(--ct-text-nano)] uppercase tracking-[0.15em] font-bold text-zinc-500">Inngest Jobs</h3>
          <span className="text-[length:var(--ct-text-nano)] uppercase tracking-widest text-zinc-600">Real-time</span>
        </header>
        <div className="flex flex-col">
          {inngestJobs.map((job) => (
            <InngestRow key={job.id} job={job} />
          ))}
        </div>
      </section>

      {/* LLM HEALTH */}
      <section className="flex flex-col">
        <header className="flex items-center justify-between mb-2.5">
          <h3 className="text-[length:var(--ct-text-nano)] uppercase tracking-[0.15em] font-bold text-zinc-500">LLM Health</h3>
          <span className="text-[length:var(--ct-text-nano)] uppercase tracking-widest text-zinc-600">24h Window</span>
        </header>
        <div className="flex items-stretch gap-3 bg-surface-inset rounded-lg p-4">
          <Tooltip
            content={(
              <div className="flex flex-col gap-1 max-w-[220px] whitespace-normal">
                <div className="text-[length:var(--ct-text-2xs)] font-medium text-white">Sentry Errors</div>
                <div className="text-[length:var(--ct-text-micro)] text-zinc-400 leading-snug">Critical exceptions captured in the last 24 hours across all services.</div>
              </div>
            )}
          >
            <div className="flex-1 cursor-help">
              <SentryCounter
                label="Errors"
                count={sentryStats.errors24h}
                alert={sentryStats.errors24h > 0}
              />
            </div>
          </Tooltip>
          <div className="w-px self-stretch bg-white/5" />
          <Tooltip
            content={(
              <div className="flex flex-col gap-1 max-w-[220px] whitespace-normal">
                <div className="text-[length:var(--ct-text-2xs)] font-medium text-white">Sentry Warnings</div>
                <div className="text-[length:var(--ct-text-micro)] text-zinc-400 leading-snug">Non-critical warnings captured in the last 24 hours.</div>
              </div>
            )}
          >
            <div className="flex-1 cursor-help">
              <SentryCounter
                label="Warnings"
                count={sentryStats.warnings24h}
                alert={false}
              />
            </div>
          </Tooltip>
        </div>
      </section>

      {/* CHAIN ACTIVITY */}
      <section className="flex flex-col">
        <header className="flex items-center justify-between mb-2.5">
          <h3 className="text-[length:var(--ct-text-nano)] uppercase tracking-[0.15em] font-bold text-zinc-500">Chain Activity</h3>
          <span className="text-[length:var(--ct-text-nano)] uppercase tracking-widest text-zinc-600">Live Feed</span>
        </header>
        {onChainEvents.length === 0 ? (
          <p className="text-[length:var(--ct-text-xs)] text-zinc-400 py-2" role="status">No recent on-chain events.</p>
        ) : (
          <ul className="flex flex-col" role="list">
            {onChainEvents.map((ev) => (
              <OnChainEventRow key={ev.id} event={ev} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function InngestRow({ job }: { job: InngestJob }) {
  const dot = STATUS_DOT[job.status];
  const label = STATUS_LABEL[job.status];

  return (
    <div
      className="flex items-center justify-between gap-3 py-2.5 border-b border-[var(--ct-border-soft)] last:border-b-0"
      aria-label={`${job.name}: ${label}`}
    >
      <span className="text-[length:var(--ct-text-xs)] text-zinc-300 truncate uppercase">{job.name}</span>
      <div className="flex items-center gap-1.5 shrink-0">
        <span
          aria-hidden
          className={cn(
            "size-1.5 rounded-full",
            dot,
            job.status === "pending" && "animate-pulse",
          )}
        />
        <span
          className={cn(
            "text-[length:var(--ct-text-nano)] uppercase tracking-widest",
            job.status === "ok"
              ? "text-[var(--ct-accent)]"
              : job.status === "err"
                ? "text-red-400"
                : "text-zinc-500",
          )}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

const STATUS_DOT: Record<InngestJobStatus, string> = {
  ok: "bg-[var(--ct-accent)]",
  err: "bg-red-400",
  pending: "bg-amber-400",
  unknown: "bg-zinc-600",
};

const STATUS_LABEL: Record<InngestJobStatus, string> = {
  ok: "ok",
  err: "error",
  pending: "pending",
  unknown: "—",
};

function SentryCounter({
  label,
  count,
  alert,
}: {
  label: string;
  count: number;
  alert: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[length:var(--ct-text-nano)] uppercase tracking-[0.15em] font-bold text-zinc-500">{label}</span>
      <span
        className={cn(
          "text-[18px] font-medium tabular-nums leading-none",
          alert && count > 0 ? "text-red-400" : "text-white",
        )}
      >
        {count}
      </span>
    </div>
  );
}

const EVENT_TYPE_ICON: Record<OnChainEvent["type"], string> = {
  deposit: "↓",
  sign: "✎",
  swap: "⇄",
  oracle_update: "◎",
  other: "·",
};

function OnChainEventRow({ event }: { event: OnChainEvent }) {
  const icon = EVENT_TYPE_ICON[event.type];
  const ago = formatAgo(new Date(event.occurredAt));

  const content = (
    <>
      <span
        aria-hidden
        className="shrink-0 text-zinc-600 text-[length:var(--ct-text-nano)] font-bold w-4 text-center mt-px"
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <span className="text-[length:var(--ct-text-xs)] text-zinc-300 truncate block uppercase">{event.label}</span>
        <span className="text-[length:var(--ct-text-nano)] uppercase tracking-widest text-zinc-600">{ago}</span>
      </div>
    </>
  );

  const rowClassName =
    "flex items-start gap-3 py-3 border-b border-[var(--ct-border-soft)] last:border-b-0";

  const interactiveContent =
    event.txHash && !isPlaceholderTxHash(event.txHash) ? (
      <Link
        href={explorerTxUrl(event.txHash)}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(rowClassName, "transition-colors hover:bg-white/[0.02]")}
      >
        {content}
      </Link>
    ) : (
      <div className={rowClassName}>{content}</div>
    );

  return (
    <li aria-label={`${event.type}: ${event.label}`}>{interactiveContent}</li>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.round(diffHr / 24);
  return `${diffDays}d ago`;
}
