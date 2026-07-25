import { cn } from "@/lib/cn";
import { ProvenanceBadge } from "@/ui/badge";

export type ActivityItem = {
  id: string;
  title: string;
  detail?: string;
  timestamp: string;
  provenance?: React.ComponentProps<typeof ProvenanceBadge>["source"];
};

export function ActivityFeed({
  items,
  className,
  emptyTitle = "No activity yet",
}: {
  items: ActivityItem[];
  className?: string;
  emptyTitle?: string;
}) {
  if (!items.length) {
    return (
      <p className={cn("py-8 text-center text-sm text-muted", className)}>
        {emptyTitle}
      </p>
    );
  }

  return (
    <ul className={cn("divide-y divide-border-subtle", className)}>
      {items.map((item) => (
        <li key={item.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
          <span
            aria-hidden
            className="mt-2 size-1.5 shrink-0 rounded-full bg-accent"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-foreground">{item.title}</p>
              {item.provenance ? (
                <ProvenanceBadge source={item.provenance} />
              ) : null}
            </div>
            {item.detail ? (
              <p className="mt-0.5 text-sm text-muted">{item.detail}</p>
            ) : null}
            <time className="mt-1 block text-xs text-subtle tabular-nums">
              {item.timestamp}
            </time>
          </div>
        </li>
      ))}
    </ul>
  );
}
