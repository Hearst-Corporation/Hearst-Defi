import Link from "next/link";

import { Card } from "@/components/ui/card";
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
      <Card className="dashboard-command-cell dashboard-command-cell--awaiting">
        <DashboardPanelHeader title="Action queue" tone="quiet" />
        <EmptySurface
          variant="inline"
          message="All clear — no pending actions."
          ariaLabel="Action queue"
        />
      </Card>
    );
  }

  return (
    <Card aria-label="Action queue" className="dashboard-command-cell">
      <DashboardPanelHeader title="Action queue" tone="quiet" />
      <ul className="dashboard-command-divide-stack" role="list">
        {items.map((item) => (
          <ActionRow key={item.id} item={item} />
        ))}
      </ul>
    </Card>
  );
}

function ActionRow({ item }: { item: ActionQueueItem }) {
  const actionLabel = ACTION_LABELS[item.type] ?? item.type;

  return (
    <li
      className="admin-doc-inline-row admin-doc-inline-row--between admin-doc-inline-row--start admin-doc-inline-row--actions py-3 first:pt-0 last:pb-0"
      aria-label={`${item.severity} — ${item.title}`}
    >
      <div className="min-w-0 admin-doc-stack admin-doc-stack--micro">
        <div className="admin-doc-inline-row admin-doc-inline-row--dense">
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
            "border transition-colors duration-(--ct-dur-fast)",
            item.severity === "P0"
              ? "border-(--ct-status-danger-border) ct-status-danger ct-status-danger-bg hover:bg-(--ct-status-danger) hover:ct-text-on-accent"
              : "border-(--ct-border) ct-text-muted hover:border-(--ct-accent) hover:ct-text-accent",
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
      className={cn(
        "stat-label inline-flex items-center justify-center shrink-0 w-8 h-5 rounded-sm border",
        styles[severity],
      )}
      aria-label={`Priority ${severity}`}
    >
      {severity}
    </span>
  );
}
