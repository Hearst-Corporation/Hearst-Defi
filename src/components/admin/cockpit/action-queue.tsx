import Link from "next/link";

import { EmptySurface } from "@/components/ui/empty-surface";
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
  "kyc.review": "Review KYC",
  "lp.redemption": "Review redemption",
  "rebalance.signal": "Review signal",
  "memo.publish": "Publish memo",
  "mining.margin.red": "Review margin",
  "attestation.overdue": "Review proof",
};

/**
 * Cockpit Admin — Action Queue content (no panel wrapper/header — provided by parent cell).
 *
 * Lists pending operator actions sorted P0 → P1 → P2 with severity pills.
 * Each row has a CTA button linking to the relevant admin page.
 * Graceful empty state when there are no queued items.
 */
export function ActionQueue({ items }: ActionQueueProps) {
  if (items.length === 0) {
    return (
      <EmptySurface
        variant="inline"
        message="All clear — no operator actions queued."
        ariaLabel="Operator queue"
      />
    );
  }

  return (
    <ul className="dashboard-command-divide-stack" role="list" aria-label="Operator queue">
      {items.map((item) => (
        <ActionRow key={item.id} item={item} />
      ))}
    </ul>
  );
}

function ActionRow({ item }: { item: ActionQueueItem }) {
  const actionLabel = ACTION_LABELS[item.type] ?? item.type;
  const isCritical = item.severity === "P0";

  return (
    <li
      className={cn(
        "admin-doc-inline-row admin-doc-inline-row--between admin-doc-inline-row--start admin-doc-inline-row--actions dashboard-action-row cockpit-hover-row cockpit-hover-row--inset cursor-default",
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
    P0: "cockpit-severity--p0",
    P1: "cockpit-severity--p1",
    P2: "cockpit-severity--p2",
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
