import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";

/**
 * Secondary instrumentation surface for admin cockpit panels. Quieter than
 * `Card` — no glass-panel chrome or hover wash.
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

/**
 * Canonical dashboard panel header — eyebrow, h3 title, optional provenance.
 * Replaces ad-hoc CellHeader / SystemPanelTitle duplicates.
 */
export function DashboardPanelHeader({
  title,
  eyebrow,
  provenance,
  tone = "quiet",
  className,
}: {
  title: string;
  eyebrow?: string;
  provenance?: Provenance;
  /** primary = command-row data cards; quiet = instrumentation panels */
  tone?: "primary" | "quiet";
  className?: string;
}) {
  return (
    <header
      className={cn(
        "dashboard-card-header dashboard-system-panel__header",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-1">{eyebrow}</p> : null}
        <h3
          className={cn(
            "h3 min-w-0",
            tone === "quiet" && "ct-text-body",
          )}
        >
          {title}
        </h3>
      </div>
      {provenance ? <ProvenanceBadge kind={provenance} compact /> : null}
    </header>
  );
}

/** @deprecated Use DashboardPanelHeader */
export const SystemPanelTitle = DashboardPanelHeader;
