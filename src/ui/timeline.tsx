import { cn } from "@/lib/cn";
import { Badge } from "@/ui/badge";

export type TimelineItem = {
  id: string;
  title: string;
  description?: string;
  timestamp: string;
  /**
   * `success` follows the single accent automatically (the success tokens
   * resolve to `--ct-accent` since vague 0 — never a second green).
   * `danger` is reserved for SYSTEM FAILURE events only (a job that crashed,
   * a broadcast that failed) — never for neutral/absent states, which render
   * `default` grey.
   */
  status?: "default" | "success" | "warning" | "danger";
};

export function Timeline({
  items,
  className,
}: {
  items: TimelineItem[];
  className?: string;
}) {
  return (
    <ol className={cn("space-y-0", className)}>
      {items.map((item, index) => (
        <li
          key={item.id}
          className="relative flex gap-4 pb-6 last:pb-0"
        >
          {index < items.length - 1 ? (
            <span
              aria-hidden
              className="absolute left-[7px] top-4 h-[calc(100%-0.5rem)] w-px bg-border-subtle"
            />
          ) : null}
          <span
            aria-hidden
            className={cn(
              "relative z-10 mt-1 size-[15px] shrink-0 rounded-full border-2",
              item.status === "success" && "border-success bg-success/20",
              item.status === "warning" && "border-warning bg-warning/20",
              item.status === "danger" && "border-danger bg-danger/20",
              (!item.status || item.status === "default") && "border-border-strong bg-surface-overlay",
            )}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-foreground">{item.title}</p>
              {item.status && item.status !== "default" ? (
                <Badge variant={item.status === "success" ? "success" : item.status}>
                  {item.status}
                </Badge>
              ) : null}
            </div>
            {item.description ? (
              <p className="mt-0.5 text-sm text-muted">{item.description}</p>
            ) : null}
            <time className="mt-1 block text-xs text-subtle tabular-nums">
              {item.timestamp}
            </time>
          </div>
        </li>
      ))}
    </ol>
  );
}
