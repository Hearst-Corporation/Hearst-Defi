import Link from "next/link";

import { cn } from "@/lib/cn";
import type { ActionQueueItem, ActionSeverity } from "@/lib/data/cockpit";

// ---------------------------------------------------------------------------
// ActionQueue — operator queue rows for /admin/dashboard.
//
// ADOPTED from the retired cockpit board (mission E1, 2026-07-26): the generic
// ActivityFeed dropped the P0/P1/P2 severity and the per-item deep link, both
// of which are REAL loader data — this component keeps them on screen.
// ---------------------------------------------------------------------------

interface ActionQueueProps {
  items: readonly ActionQueueItem[];
}

const ACTION_LABELS: Record<string, string> = {
  "multisig.sign": "Sign multisig",
  "oracle.stale": "Refresh oracle",
  "vault.paused": "Vault paused",
  "distribution.approve": "Approve payout",
  "kyc.review": "Review KYC",
  "lp.redemption": "Review redemption",
  "rebalance.signal": "Review signal",
  "memo.publish": "Publish memo",
  "mining.margin.red": "Review margin",
  "attestation.overdue": "Review proof",
};

/**
 * Lists pending operator actions sorted P0 → P1 → P2 with severity dots.
 * Each row has a CTA link to the relevant admin page.
 * Graceful empty state when there are no queued items — the CALLER must only
 * render this when the queue read succeeded (an unreadable queue is a banner,
 * never this empty state).
 */
export function ActionQueue({ items }: ActionQueueProps) {
  if (items.length === 0) {
    return (
      <div
        role="status"
        aria-label="Operator queue"
        className="flex flex-1 items-center justify-center py-8 text-center text-[length:var(--ct-text-xs)] text-[var(--ct-text-muted)]"
      >
        All clear — no operator actions queued.
      </div>
    );
  }

  return (
    <ul role="list" aria-label="Operator queue" className="flex flex-col">
      {items.map((item) => (
        <ActionRow key={item.id} item={item} />
      ))}
    </ul>
  );
}

function ActionRow({ item }: { item: ActionQueueItem }) {
  const actionLabel = ACTION_LABELS[item.type] ?? item.type;
  const tone = SEVERITY_TONES[item.severity];

  return (
    <li
      className="flex items-center justify-between gap-3 border-b border-[var(--ct-border-soft)] py-3 transition-colors last:border-b-0 hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_2%,transparent)]"
      aria-label={`${item.severity} — ${item.title}`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <SeverityDot severity={item.severity} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="block truncate text-[length:var(--ct-text-xs)] font-medium text-[var(--ct-text-body)]">
            {item.title}
          </span>
          <span className="ct-bento-label block truncate">
            {item.context}
          </span>
        </div>
      </div>

      {item.href ? (
        <Link
          href={item.href}
          className={cn(
            "shrink-0 rounded-md border px-2 py-1 text-[length:var(--ct-text-deci)] uppercase tracking-[0.12em] font-bold transition-colors",
            tone.cta,
          )}
          aria-label={`${actionLabel} — ${item.title}`}
        >
          {actionLabel}
        </Link>
      ) : null}
    </li>
  );
}

function SeverityDot({ severity }: { severity: ActionSeverity }) {
  const tone = SEVERITY_TONES[severity];

  return (
    <span
      className="mt-0.5 inline-flex shrink-0 items-center gap-1.5"
      aria-label={`Priority ${severity}`}
    >
      <span className={cn("size-1.5 rounded-full", tone.dot)} aria-hidden />
      <span className={cn("text-[length:var(--ct-text-deci)] font-bold tracking-[0.12em]", tone.text)}>
        {severity}
      </span>
    </span>
  );
}

const SEVERITY_TONES: Record<
  ActionSeverity,
  { dot: string; text: string; cta: string }
> = {
  P0: {
    dot: "bg-[var(--ct-status-danger)]",
    text: "text-[var(--ct-status-danger)]",
    cta: "border-[var(--ct-status-danger-border)] bg-[var(--ct-status-danger-soft)] text-[var(--ct-status-danger)] hover:bg-[var(--ct-status-danger-soft)]",
  },
  P1: {
    dot: "bg-[var(--ct-status-warning)]",
    text: "text-[var(--ct-status-warning)]",
    cta: "border-[var(--ct-status-warning-border)] bg-[var(--ct-status-warning-soft)] text-[var(--ct-status-warning)] hover:bg-[var(--ct-status-warning-soft)]",
  },
  P2: {
    dot: "bg-[var(--ct-text-faint)]",
    text: "text-[var(--ct-text-faint)]",
    cta: "border-[var(--ct-border-soft)] bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] text-[var(--ct-text-muted)] hover:border-[var(--ct-border)] hover:text-[var(--ct-text-body)]",
  },
};
