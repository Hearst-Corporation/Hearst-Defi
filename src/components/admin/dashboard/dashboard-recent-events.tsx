import { EmptySurface } from "@/components/ui/empty-surface";
import { formatAdminMonthDay } from "@/lib/vaults/product-display";
import type { DashboardRecentEvent } from "@/lib/data/dashboard";

/**
 * Rebalance activity loaded from `loadDashboardData` — not chain events.
 */
export function DashboardRecentEvents({
  events,
}: {
  events: DashboardRecentEvent[];
}) {
  if (events.length === 0) {
    return (
      <EmptySurface
        variant="inline"
        message="No rebalance events recorded yet."
        ariaLabel="Recent vault activity"
      />
    );
  }

  return (
    <ul className="dashboard-command-divide-stack m-0 p-0 list-none" role="list">
      {events.map((event) => (
        <li
          key={event.id}
          className="admin-doc-stack admin-doc-stack--micro min-w-0"
          aria-label={`${event.ruleId}: ${event.actionText}`}
        >
          <div className="admin-doc-inline-row admin-doc-inline-row--between admin-doc-inline-row--dense min-w-0">
            <span className="body-sm ct-text-strong truncate">{event.actionText}</span>
            <span className="body-xs ct-text-faint tabular shrink-0">
              {formatAdminMonthDay(event.takenAt)}
            </span>
          </div>
          <p className="body-xs ct-text-muted m-0 truncate">{event.triggerText}</p>
          <p className="body-xs ct-text-faint m-0 truncate">{event.impactText}</p>
        </li>
      ))}
    </ul>
  );
}
