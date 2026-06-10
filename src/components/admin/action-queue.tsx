import Link from "next/link";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import type { AdminActionItem } from "@/lib/data/admin-overview";

interface ActionQueueProps {
  items: AdminActionItem[];
  totalActionRequired: number;
}

/**
 * Investor-ops Action Queue — what an admin must do next, sourced from real
 * counts (KYC, distributions, subscription documents, governance). Untracked
 * domains (subscription intents, wallet exceptions) render as honest "not yet
 * tracked" rows, never a green zero. Each actionable row deep-links to the
 * surface that resolves it.
 */
export function ActionQueue({ items, totalActionRequired }: ActionQueueProps) {
  return (
    <Card className="flex h-full flex-col">
      <div className="dash-label relative z-10">
        <div className="flex flex-col gap-0.5">
          <span className="text-micro font-bold uppercase tracking-widest ct-text-muted">
            Action queue
          </span>
          <p className="text-micro font-medium uppercase tracking-wide ct-text-faint mono">
            {totalActionRequired > 0
              ? `${totalActionRequired} item${totalActionRequired > 1 ? "s" : ""} need review`
              : "No items awaiting action"}
          </p>
        </div>
      </div>

      <ul className="mt-6 flex flex-col relative z-10 divide-y divide-[var(--ct-border-soft)]/50">
        {items.map((item) => (
          <li key={item.key}>
            <ActionRow item={item} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ActionRow({ item }: { item: AdminActionItem }) {
  const active = item.tracked && item.count > 0;

  const body = (
    <div
      className={cn(
        "flex items-center justify-between gap-3 py-3 first:pt-0",
        item.href && "px-2 -mx-2 rounded-sm transition-colors hover:ct-surface-1",
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span
          className={cn(
            "body-sm font-medium",
            item.tracked ? "ct-text-primary" : "ct-text-faint italic",
          )}
        >
          {item.label}
        </span>
        <span className="body-xs ct-text-muted truncate">{item.hint}</span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {item.tracked ? (
          <span
            className={cn(
              "tabular text-2xl font-semibold leading-none",
              active ? "ct-status-glow-warning" : "ct-text-faint",
            )}
          >
            {item.count}
          </span>
        ) : (
          <span className="body-xs ct-text-faint uppercase tracking-wide">
            n/a
          </span>
        )}
        {item.href ? (
          <span aria-hidden className="ct-text-faint">
            →
          </span>
        ) : null}
      </div>
    </div>
  );

  if (item.href) {
    return (
      <Link
        href={item.href}
        className="block focus-visible:outline-none focus-visible:shadow-[var(--ct-shadow-focus-ring)] rounded-sm"
        aria-label={`${item.label}: ${item.hint}`}
      >
        {body}
      </Link>
    );
  }

  return body;
}
