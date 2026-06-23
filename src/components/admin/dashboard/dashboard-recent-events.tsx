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
          className="dashboard-event-item cockpit-hover-row cockpit-hover-row--inset py-1 px-2 rounded-(--ct-radius-xs) flex items-center justify-between gap-4"
          aria-label={`${event.ruleId}: ${event.actionText}`}
        >
          <div className="dashboard-event-main min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="cockpit-value-md uppercase truncate">
                {event.actionText}
              </span>
              <span className="cockpit-value-xs truncate opacity-70">
                {event.impactText}
              </span>
            </div>
            <p className="cockpit-label-sm truncate m-0 opacity-80">
              {event.triggerText}
            </p>
          </div>
          <span className="cockpit-label-xs shrink-0 opacity-60">
            {formatAdminMonthDay(event.takenAt)}
          </span>
        </li>
      ))}
    </ul>
  );
}
