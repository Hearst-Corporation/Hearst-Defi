import Link from "next/link";

import { AdminKpiStripPanel } from "@/components/admin/dashboard/admin-kpi-strip-panel";
import { cn } from "@/lib/cn";
import { explorerTxUrl, isPlaceholderTxHash } from "@/lib/chain/client";
import type { HeroKpi } from "@/lib/data/cockpit";
import type {
  InngestJob,
  InngestJobStatus,
  OnChainEvent,
  SentryStats,
} from "@/lib/data/cockpit";

/** Internal section eyebrow — one shared style for every Platform-status
 *  sub-section header (Inngest Jobs / LLM Health / Chain Activity), so they
 *  stop drifting per call-site. Title left, optional meta right. */
function PanelSubhead({ title, meta }: { title: string; meta?: string }) {
  return (
    <header className="mb-2.5 flex items-center justify-between">
      <h3 className="ct-bento-label">{title}</h3>
      {meta ? (
        <span className="text-[length:var(--ct-text-nano)] uppercase tracking-widest text-[var(--ct-text-faint)]">
          {meta}
        </span>
      ) : null}
    </header>
  );
}

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
    <div aria-label="Platform status" className="flex flex-col">

      {/* INNGEST JOBS */}
      <section className="flex flex-col border-b border-[var(--ct-border-soft)] px-5 py-4">
        <PanelSubhead title="Inngest Jobs" meta="Real-time" />
        <div className="flex flex-col">
          {inngestJobs.map((job) => (
            <InngestRow key={job.id} job={job} />
          ))}
        </div>
      </section>

      {/* LLM HEALTH — flush edge-to-edge like KPI strip */}
      <section className="flex flex-col border-b border-[var(--ct-border-soft)]">
        <div className="px-5 pt-4 pb-3">
          <PanelSubhead title="LLM Health" meta="24h Window" />
        </div>
        <AdminKpiStripPanel kpis={sentryKpis(sentryStats)} embedded />
      </section>

      {/* CHAIN ACTIVITY */}
      <section className="flex flex-col px-5 py-4">
        <PanelSubhead title="Chain Activity" meta="Live Feed" />
        {onChainEvents.length === 0 ? (
          <p className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-muted)] py-2" role="status">No recent on-chain events.</p>
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
      <span className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-body)] truncate uppercase">{job.name}</span>
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
                ? "text-[var(--ct-status-danger)]"
                : "text-[var(--ct-text-faint)]",
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
  err: "bg-[var(--ct-status-danger)]",
  pending: "bg-[var(--ct-status-warning)]",
  unknown: "bg-[var(--ct-text-faint)]",
};

const STATUS_LABEL: Record<InngestJobStatus, string> = {
  ok: "ok",
  err: "error",
  pending: "pending",
  unknown: "—",
};

/** Sentry 24h Errors / Warnings → canon KPI tiles. Errors turn red (alert)
 *  when > 0; warnings stay neutral white (one-accent colour discipline). */
function sentryKpis(stats: SentryStats): HeroKpi[] {
  return [
    {
      label: "Errors",
      value: String(stats.errors24h),
      sublabel: "critical · last 24h",
      provenance: "manual",
      ...(stats.errors24h > 0 ? { alert: true } : {}),
    },
    {
      label: "Warnings",
      value: String(stats.warnings24h),
      sublabel: "non-critical · last 24h",
      provenance: "manual",
    },
  ];
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
        className="shrink-0 text-[var(--ct-text-faint)] text-[length:var(--ct-text-nano)] font-bold w-4 text-center mt-px"
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <span className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-body)] truncate block uppercase">{event.label}</span>
        <span className="text-[length:var(--ct-text-nano)] uppercase tracking-widest text-[var(--ct-text-faint)]">{ago}</span>
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
        className={cn(rowClassName, "transition-colors hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_2%,transparent)]")}
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
