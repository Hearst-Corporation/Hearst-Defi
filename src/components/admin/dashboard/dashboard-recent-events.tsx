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
        className="flex-1 flex items-center justify-center py-(--ct-space-8)"
      />
    );
  }

  return (
    <ul className="dashboard-command-divide-stack m-0 p-0 list-none" role="list">
      {events.map((event) => (
        <li
          key={event.id}
          className="dashboard-event-item"
          aria-label={`${event.ruleId}: ${event.actionText}`}
        >
          <div className="dashboard-event-main">
            <span className="dashboard-event-action truncate">
              {event.actionText}
            </span>
            <p className="dashboard-event-trigger truncate m-0">
              {event.triggerText}
            </p>
            <p className="dashboard-event-impact truncate m-0">
              {event.impactText}
            </p>
          </div>
          <span className="dashboard-event-time shrink-0">
            {formatAdminMonthDay(event.takenAt)}
          </span>
        </li>
      ))}
    </ul>
  );
}
