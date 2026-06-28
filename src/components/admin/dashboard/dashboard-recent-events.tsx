import { EmptySurface } from "@/components/catalyst/empty-surface";
import { formatAdminMonthDay } from "@/lib/vaults/product-display";
import type { DashboardRecentEvent } from "@/lib/data/dashboard";

/**
 * Rebalance activity loaded from `loadDashboardData` — not chain events.
 *
 * Portfolio bento timeline: a hairline rail with one dot per event. The most
 * recent entry is the accent (--ct-accent); older entries are muted.
 * Body text 13px, metadata micro uppercase. Data mapping is unchanged.
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
    <ul role="list" className="m-0 list-none p-0">
      {events.map((event, index) => {
        const isLatest = index === 0;
        const isLast = index === events.length - 1;

        return (
          <li
            key={event.id}
            className="relative flex gap-x-4 pb-5 last:pb-0"
            aria-label={`${event.ruleId}: ${event.actionText}`}
          >
            {/* Connecting rail — runs to the next dot, omitted on the last item. */}
            {!isLast ? (
              <div className="absolute top-0 -bottom-0 left-0 flex w-6 justify-center">
                <div className="w-px bg-[var(--ct-border)]" />
              </div>
            ) : (
              <div className="absolute top-0 left-0 flex h-6 w-6 justify-center">
                <div className="w-px bg-[var(--ct-border)]" />
              </div>
            )}

            <div className="relative flex size-6 flex-none items-center justify-center rounded-full bg-surface-card ring-1 ring-[var(--ct-border-soft)]">
              {isLatest ? (
                <div className="size-2 rounded-full bg-[var(--ct-accent)] ring-4 ring-[var(--ct-surface-card)]" />
              ) : (
                <div className="size-1.5 rounded-full bg-[color-mix(in_srgb,var(--ct-text-strong)_20%,transparent)]" />
              )}
            </div>

            <div className="min-w-0 flex-auto py-0.5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 truncate text-[length:var(--ct-text-xs)] text-[var(--ct-text-secondary)]">
                  <span className="font-medium text-[var(--ct-text-strong)]">{event.actionText}</span>
                  {event.impactText ? (
                    <span className="ml-2 text-[var(--ct-text-muted)]">{event.impactText}</span>
                  ) : null}
                </p>
                <time
                  dateTime={event.takenAt.toISOString()}
                  className="shrink-0 text-[length:var(--ct-text-deci)] font-medium uppercase tracking-wider text-[var(--ct-text-faint)]"
                >
                  {formatAdminMonthDay(event.takenAt)}
                </time>
              </div>
              <p className="m-0 mt-1 truncate text-[length:var(--ct-text-deci)] uppercase tracking-widest text-[var(--ct-text-faint)]">
                {event.triggerText}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
