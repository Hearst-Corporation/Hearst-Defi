import Link from "next/link";

import { Card } from "@/components/ui/card";
import { PanelStatus } from "@/components/ui/panel-status";
import { DashboardPanelHeader } from "@/components/ui/dashboard-panel-header";
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
 * Cockpit Admin — Live Ops column.
 *
 * Sections:
 *  1. Inngest job status rows (ok/err/pending/unknown)
 *  2. Sentry 24h error + warning count
 *  3. On-chain feed — last 5 events
 */
export function LiveOps({ inngestJobs, sentryStats, onChainEvents }: LiveOpsProps) {
  return (
    <div aria-label="Live ops" className="dashboard-command-cell">
      <DashboardPanelHeader title="Live ops" tone="quiet" />

      <div className="dashboard-command-divide-stack">
        <div className="dashboard-live-ops-section">
          <span className="dashboard-live-ops-section__title">Inngest jobs</span>
          <div className="dashboard-command-divide-stack">
            {inngestJobs.map((job) => (
              <InngestRow key={job.id} job={job} />
            ))}
          </div>
        </div>

        <div className="dashboard-live-ops-section">
          <span className="dashboard-live-ops-section__title">Sentry 24h</span>
          <div className="admin-doc-inline-row admin-doc-inline-row--relaxed admin-doc-inline-row--actions">
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

        <div className="dashboard-live-ops-section">
          <span className="dashboard-live-ops-section__title">On-chain feed</span>
          {onChainEvents.length === 0 ? (
            <PanelStatus message="No recent on-chain events." />
          ) : (
            <ul className="dashboard-command-divide-stack" role="list">
              {onChainEvents.map((ev) => (
                <OnChainEventRow key={ev.id} event={ev} />
              ))}
            </ul>
          )}
        </div>
      </div>
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
      className="admin-doc-inline-row admin-doc-inline-row--between admin-doc-inline-row--actions dashboard-inngest-row"
      aria-label={`${job.name}: ${label}`}
    >
      <span className="body-xs ct-text-body truncate">{job.name}</span>
      <div className="admin-doc-inline-row admin-doc-inline-row--dense shrink-0">
        <span aria-hidden className={cn("dashboard-status-dot", dot)} />
        <span
          className={cn(
            "body-xs font-medium",
            job.status === "ok"
              ? "ct-status-success"
              : job.status === "err"
                ? "ct-status-danger"
                : "ct-text-muted",
          )}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

const STATUS_DOT: Record<InngestJobStatus, string> = {
  ok: "bg-(--ct-status-success)",
  err: "bg-(--ct-status-danger)",
  pending: "bg-(--ct-status-warning) animate-pulse",
  unknown: "bg-(--ct-border) opacity-[var(--ct-opacity-60)]",
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
    <div className="admin-doc-inline-row admin-doc-inline-row--baseline admin-doc-inline-row--dense">
      <span
        className={cn(
          "stat-value tabular",
          alert && count > 0 ? "ct-status-danger" : "ct-text-strong",
        )}
      >
        {count}
      </span>
      <span className="body-xs ct-text-muted">{label}</span>
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
      className="admin-doc-inline-row admin-doc-inline-row--start admin-doc-inline-row--actions dashboard-event-row"
      aria-label={`${event.type}: ${event.label}`}
    >
      <span
        aria-hidden
        className="shrink-0 ct-text-muted body-xs w-4 text-center mt-0.5"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="body-xs ct-text-body truncate block">{event.label}</span>
        <span className="body-xs ct-text-muted">{ago}</span>
      </span>
    </li>
  );

  if (event.txHash && !isPlaceholderTxHash(event.txHash)) {
    return (
      <Link
        href={explorerTxUrl(event.txHash)}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:opacity-[var(--ct-opacity-80)] transition-opacity"
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
