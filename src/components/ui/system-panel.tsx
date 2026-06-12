import { cn } from "@/lib/cn";

/**
 * Secondary instrumentation surface for admin cockpit panels (Live Metrics,
 * Live Ops, Audit Trail). Quieter than `Card` — no glass-panel chrome or hover wash.
 */
export function SystemPanel({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("dashboard-system-panel ct-card", className)}
      {...props}
    />
  );
}

export function SystemPanelTitle({
  eyebrow,
  title,
  className,
}: {
  eyebrow?: string;
  title: string;
  className?: string;
}) {
  return (
    <header className={cn("dashboard-system-panel__header", className)}>
      {eyebrow ? <p className="eyebrow mb-1">{eyebrow}</p> : null}
      <h3 className="h3 ct-text-body">{title}</h3>
    </header>
  );
}
