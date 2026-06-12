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
  return <div className={cn("ct-system-panel", className)} {...props} />;
}

/**
 * Canonical dashboard panel header — eyebrow, h3 title, optional provenance.
 */
export function DashboardPanelHeader({
  title,
  eyebrow,
  provenance,
  trustLabel,
  tone = "quiet",
  className,
}: {
  title: string;
  eyebrow?: string;
  provenance?: Provenance;
  /** Investor-facing trust copy shown beside provenance (e.g. Verified data). */
  trustLabel?: string;
  /** primary = command-row data cards; quiet = instrumentation panels */
  tone?: "primary" | "quiet";
  className?: string;
}) {
  return (
    <header
      className={cn(
        "dashboard-card-header ct-system-panel__header",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-1">{eyebrow}</p> : null}
        <h3
          className={cn(
            "h3 min-w-0 break-words",
            tone === "quiet" ? "ct-text-body" : "ct-text-strong",
          )}
        >
          {title}
        </h3>
      </div>
      {provenance || trustLabel ? (
        <div className="flex items-center gap-3 shrink-0">
          {trustLabel ? (
            <span className="body-xs ct-text-faint italic hidden sm:inline">
              {trustLabel}
            </span>
          ) : null}
          {provenance ? <ProvenanceBadge kind={provenance} compact /> : null}
        </div>
      ) : null}
    </header>
  );
}
