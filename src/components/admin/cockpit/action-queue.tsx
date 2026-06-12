import Link from "next/link";

import { DashboardPanelHeader, SystemPanel } from "@/components/ui/system-panel";
import { cn } from "@/lib/cn";
import type { ActionQueueItem, ActionSeverity } from "@/lib/data/cockpit";

interface ActionQueueProps {
  items: ActionQueueItem[];
}

const ACTION_LABELS: Record<string, string> = {
  "multisig.sign": "Sign multisig",
  "oracle.stale": "Refresh oracle",
  "vault.paused": "Vault paused",
  "distribution.approve": "Approve distribution",
  "kyc.review": "KYC review",
  "lp.redemption": "LP redemption",
  "rebalance.signal": "Rebalance",
  "memo.publish": "Publish memo",
  "mining.margin.red": "Mining margin",
  "attestation.overdue": "Attestation",
};

/**
 * Cockpit Admin — Action Queue column.
 *
 * Lists pending operator actions sorted P0 → P1 → P2 with severity pills.
 * Each row has a CTA button linking to the relevant admin page.
 * Graceful empty state when there are no queued items.
 */
export function ActionQueue({ items }: ActionQueueProps) {
  return (
    <SystemPanel aria-label="Action queue">
      <DashboardPanelHeader eyebrow="Cockpit" title="Action Queue" tone="quiet" />

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 ct-empty-state">
          <span className="ct-text-accent text-2xl" aria-hidden>
            ✓
          </span>
          <span className="body-sm ct-text-muted">All clear — no pending actions.</span>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--ct-border-soft)]" role="list">
          {items.map((item) => (
            <ActionRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </SystemPanel>
  );
}

function ActionRow({ item }: { item: ActionQueueItem }) {
  const actionLabel = ACTION_LABELS[item.type] ?? item.type;

  return (
    <li
      className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
      aria-label={`${item.severity} — ${item.title}`}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <SeverityPill severity={item.severity} />
          <span className="body-sm ct-text-strong font-medium truncate">
            {item.title}
          </span>
        </div>
        <span className="body-xs ct-text-faint truncate pl-10">
          {item.context}
        </span>
      </div>

      {item.href ? (
        <Link
          href={item.href}
          className={cn(
            "shrink-0 rounded-sm px-3 py-1 body-xs font-medium",
            "border transition-colors duration-[var(--ct-dur-fast)]",
            item.severity === "P0"
              ? "border-[var(--ct-status-danger-border)] ct-status-danger ct-status-danger-bg hover:bg-[var(--ct-status-danger)] hover:text-[var(--ct-bg-deep)]"
              : "border-[var(--ct-border)] ct-text-muted hover:border-[var(--ct-accent)] hover:ct-text-accent",
          )}
          aria-label={`${actionLabel} — ${item.title}`}
        >
          {actionLabel} →
        </Link>
      ) : null}
    </li>
  );
}

function SeverityPill({ severity }: { severity: ActionSeverity }) {
  const styles: Record<ActionSeverity, string> = {
    P0: "ct-status-danger-bg ct-status-danger border-[var(--ct-status-danger-border)]",
    P1: "ct-status-warning-bg ct-status-warning border-[var(--ct-status-warning-border)]",
    P2: "ct-surface-1 ct-text-faint border-[var(--ct-border-soft)]",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center shrink-0 w-8 h-5 rounded-sm border text-micro font-bold tracking-wide",
        styles[severity],
      )}
      aria-label={`Priority ${severity}`}
    >
      {severity}
    </span>
  );
}
