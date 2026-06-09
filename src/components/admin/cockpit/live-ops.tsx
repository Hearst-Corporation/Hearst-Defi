import Link from "next/link";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { explorerTxUrl } from "@/lib/chain/client";
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
 * Cockpit Admin — Live Ops column.
 *
 * Sections:
 *  1. Inngest job status rows (ok/err/pending/unknown)
 *  2. Sentry 24h error + warning count
 *  3. On-chain feed — last 5 events
 */
export function LiveOps({ inngestJobs, sentryStats, onChainEvents }: LiveOpsProps) {
  return (
    <Card aria-label="Live ops">
      <p className="eyebrow mb-4">Live Ops</p>

      {/* Inngest */}
      <div className="mb-5">
        <p className="body-xs ct-text-faint uppercase tracking-wide mb-2 font-medium">
          Inngest Jobs
        </p>
        <div className="flex flex-col divide-y divide-[var(--ct-border-soft)]">
          {inngestJobs.map((job) => (
            <InngestRow key={job.id} job={job} />
          ))}
        </div>
      </div>

      {/* Sentry 24h */}
      <div className="mb-5">
        <p className="body-xs ct-text-faint uppercase tracking-wide mb-2 font-medium">
          Sentry 24h
        </p>
        <div className="flex items-center gap-4">
          <SentryCounter
            label="Errors"
            count={sentryStats.errors24h}
            alert={sentryStats.errors24h > 0}
          />
          <SentryCounter
            label="Warnings"
            count={sentryStats.warnings24h}
            alert={false}
          />
        </div>
      </div>

      {/* On-chain feed */}
      <div>
        <p className="body-xs ct-text-faint uppercase tracking-wide mb-2 font-medium">
          On-chain feed
        </p>
        {onChainEvents.length === 0 ? (
          <p className="body-xs ct-text-faint">No recent on-chain events.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--ct-border-soft)]" role="list">
            {onChainEvents.map((ev) => (
              <OnChainEventRow key={ev.id} event={ev} />
            ))}
          </ul>
        )}
      </div>
    </Card>
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
      className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
      aria-label={`${job.name}: ${label}`}
    >
      <span className="body-xs ct-text-body truncate">{job.name}</span>
      <div className="flex items-center gap-1.5 shrink-0">
        <span
          aria-hidden
          className={cn("inline-block h-2 w-2 rounded-full", dot)}
        />
        <span
          className={cn(
            "body-xs font-medium",
            job.status === "ok"
              ? "text-[var(--ct-status-success)]"
              : job.status === "err"
                ? "text-[var(--ct-status-danger)]"
                : "ct-text-faint",
          )}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

const STATUS_DOT: Record<InngestJobStatus, string> = {
  ok: "bg-[var(--ct-status-success)]",
  err: "bg-[var(--ct-status-danger)]",
  pending: "bg-[var(--ct-status-warning)] animate-pulse",
  unknown: "bg-[var(--ct-border)] opacity-60",
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
    <div className="flex items-baseline gap-1.5">
      <span
        className={cn(
          "text-lg font-bold tabular leading-none",
          alert && count > 0
            ? "text-[var(--ct-status-danger)]"
            : "ct-text-strong",
        )}
      >
        {count}
      </span>
      <span className="body-xs ct-text-faint">{label}</span>
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

  const inner = (
    <li
      className="flex items-start gap-2 py-1.5 first:pt-0 last:pb-0"
      aria-label={`${event.type}: ${event.label}`}
    >
      <span
        aria-hidden
        className="shrink-0 w-4 text-center ct-text-faint text-xs mt-0.5"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="body-xs ct-text-body truncate block">{event.label}</span>
        <span className="text-micro ct-text-faint">{ago}</span>
      </span>
    </li>
  );

  if (event.txHash) {
    return (
      <Link
        href={explorerTxUrl(event.txHash)}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:opacity-80 transition-opacity"
      >
        {inner}
      </Link>
    );
  }

  return inner;
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
