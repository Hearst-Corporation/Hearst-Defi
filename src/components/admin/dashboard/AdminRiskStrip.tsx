// AdminRiskStrip — exposure and pending operator work.
//
// Replaces `risk-summary-card.tsx` (which scored the retired yield-era vault
// risk bands, canon F5) and `dashboard-recent-events.tsx` (which listed
// rebalance events of the same fixture model).
//
// What it shows instead: the real operator queue and the real audit trail,
// both already loaded by the page from Prisma. Severity styling comes from the
// item's own severity field — never from a literal the caller chose.

import Link from "next/link";

import { cn } from "@/lib/cn";
import { EmptySurface } from "@/components/catalyst/empty-surface";
import type { ActionQueueItem, AuditTrailEntry } from "@/lib/data/cockpit";

import {
  AdminDashboardCard,
  AdminDashboardCardHeader,
} from "./AdminDashboardSection";

/** Severity → text colour. Accent is a signal, never a fill. */
const SEVERITY_TEXT: Record<string, string> = {
  critical: "text-[var(--ct-status-danger)]",
  warning: "text-[var(--ct-status-warning)]",
  info: "text-[var(--ct-text-muted)]",
};

export function AdminRiskStrip({
  queue,
  audit,
}: {
  queue: readonly ActionQueueItem[];
  audit: readonly AuditTrailEntry[];
}) {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-[var(--ct-space-4)] lg:grid-cols-2">
      <AdminDashboardCard ariaLabel="Operator queue">
        <AdminDashboardCardHeader
          title="Operator queue"
          caption="Items awaiting a human decision"
          trailing={<LeafLink href="/admin/monitoring" />}
        />
        {queue.length === 0 ? (
          <EmptySurface
            variant="inline"
            message="Nothing is waiting on an operator."
            ariaLabel="Operator queue"
            className="m-[var(--ct-space-5)]"
          />
        ) : (
          <ul role="list" className="m-0 flex list-none flex-col p-0">
            {queue.slice(0, 5).map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-[var(--ct-space-4)] px-[var(--ct-space-5)] py-[var(--ct-space-3)] first:pt-[var(--ct-space-4)] last:pb-[var(--ct-space-4)] [&+&]:border-t [&+&]:border-[var(--ct-border-soft)]"
              >
                <div className="min-w-0">
                  <p
                    className="m-0 truncate font-medium text-[var(--ct-text-strong)]"
                    style={{ fontSize: "var(--ct-text-xs)" }}
                  >
                    {item.title}
                  </p>
                  <p
                    className="m-0 mt-[var(--ct-space-1)] truncate text-[var(--ct-text-faint)]"
                    style={{ fontSize: "var(--ct-text-nano)" }}
                  >
                    {item.context}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 font-semibold uppercase tracking-[0.1em]",
                    SEVERITY_TEXT[item.severity] ?? "text-[var(--ct-text-muted)]",
                  )}
                  style={{ fontSize: "var(--ct-text-nano)" }}
                >
                  {item.severity}
                </span>
              </li>
            ))}
          </ul>
        )}
      </AdminDashboardCard>

      <AdminDashboardCard ariaLabel="Audit trail">
        <AdminDashboardCardHeader
          title="Audit trail"
          caption="Most recent recorded actions"
          trailing={<LeafLink href="/admin/audit" />}
        />
        {audit.length === 0 ? (
          <EmptySurface
            variant="inline"
            message="No audited action has been recorded yet."
            ariaLabel="Audit trail"
            className="m-[var(--ct-space-5)]"
          />
        ) : (
          <ul role="list" className="m-0 flex list-none flex-col p-0">
            {audit.slice(0, 5).map((entry) => (
              <li
                key={entry.id}
                className="flex items-start justify-between gap-[var(--ct-space-4)] px-[var(--ct-space-5)] py-[var(--ct-space-3)] first:pt-[var(--ct-space-4)] last:pb-[var(--ct-space-4)] [&+&]:border-t [&+&]:border-[var(--ct-border-soft)]"
              >
                <div className="min-w-0">
                  <p
                    className="m-0 truncate font-medium text-[var(--ct-text-strong)]"
                    style={{ fontSize: "var(--ct-text-xs)" }}
                  >
                    {entry.action}
                  </p>
                  <p
                    className="m-0 mt-[var(--ct-space-1)] truncate text-[var(--ct-text-faint)]"
                    style={{ fontSize: "var(--ct-text-nano)" }}
                  >
                    {entry.entityType} · {entry.entityId}
                  </p>
                </div>
                <span
                  className="shrink-0 tabular-nums text-[var(--ct-text-faint)]"
                  style={{ fontSize: "var(--ct-text-nano)" }}
                >
                  {new Date(entry.occurredAt).toISOString().slice(0, 10)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </AdminDashboardCard>
    </div>
  );
}

function LeafLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 font-semibold text-[var(--ct-text-muted)] transition-colors hover:text-[var(--ct-accent-strong)]"
      style={{ fontSize: "var(--ct-text-nano)" }}
    >
      View full<span aria-hidden> →</span>
    </Link>
  );
}
