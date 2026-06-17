import Link from "next/link";

import { EmptySurface } from "@/components/ui/empty-surface";
import { DashboardPanelHeader } from "@/components/ui/dashboard-panel-header";
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
  if (items.length === 0) {
    return (
      <div className="dashboard-command-cell dashboard-command-cell--awaiting">
        <DashboardPanelHeader title="Action queue" tone="quiet" />
        <EmptySurface
          variant="inline"
          message="All clear — no pending actions."
          ariaLabel="Action queue"
        />
      </div>
    );
  }

  return (
    <div aria-label="Action queue" className="dashboard-command-cell">
      <DashboardPanelHeader title="Action queue" tone="quiet" />
      <ul className="dashboard-command-divide-stack" role="list">
        {items.map((item) => (
          <ActionRow key={item.id} item={item} />
        ))}
      </ul>
    </div>
  );
}

function ActionRow({ item }: { item: ActionQueueItem }) {
  const actionLabel = ACTION_LABELS[item.type] ?? item.type;
  const isCritical = item.severity === "P0";

  return (
    <li
      className={cn(
        "admin-doc-inline-row admin-doc-inline-row--between admin-doc-inline-row--start admin-doc-inline-row--actions dashboard-action-row",
        isCritical && "dashboard-action-row--critical",
      )}
      aria-label={`${item.severity} — ${item.title}`}
    >
      <div className="admin-doc-inline-row admin-doc-inline-row--start flex-nowrap min-w-0 flex-1 dashboard-action-copy">
        <SeverityPill severity={item.severity} />
        <div className="admin-doc-stack admin-doc-stack--micro flex-1 min-w-0">
          <span className="body-sm ct-text-strong truncate dashboard-action-title">{item.title}</span>
          <span className="body-xs ct-text-muted truncate dashboard-action-context">
            {item.context}
          </span>
        </div>
      </div>

      {item.href ? (
        <Link
          href={item.href}
          className={cn(
            "dashboard-action-cta",
            item.severity === "P0" ? "dashboard-action-cta--danger" : "dashboard-action-cta--neutral",
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
    P0: "ct-status-danger-bg ct-status-danger border-(--ct-status-danger-border)",
    P1: "ct-status-warning-bg ct-status-warning border-(--ct-status-warning-border)",
    P2: "ct-surface-1 ct-text-faint border-(--ct-border-soft)",
  };

  return (
    <span
      className={cn("stat-label dashboard-severity-pill", styles[severity])}
      aria-label={`Priority ${severity}`}
    >
      {severity}
    </span>
  );
}
