import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";

/**
 * Canonical dashboard panel header — eyebrow, h2/h3 title, optional provenance.
 */
export function DashboardPanelHeader({
  title,
  eyebrow,
  provenance,
  trustLabel,
  tone = "quiet",
  titleLevel = "widget",
  className,
}: {
  title: string;
  eyebrow?: string;
  provenance?: Provenance;
  /** Investor-facing trust copy shown beside provenance (e.g. Verified data). */
  trustLabel?: string;
  /** primary = command-row data cards; quiet = instrumentation panels */
  tone?: "primary" | "quiet";
  /** section = h2 (.h2) for portfolio/product sections; widget = h3 (.h3) default */
  titleLevel?: "section" | "widget";
  className?: string;
}) {
  const TitleTag = titleLevel === "section" ? "h2" : "h3";
  const titleRoleClass = titleLevel === "section" ? "h2" : "h3";

  return (
    <header className={cn("dashboard-card-header", className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-1">{eyebrow}</p> : null}
        <TitleTag
          className={cn(
            titleRoleClass,
            "min-w-0 break-words",
            tone === "quiet" ? "ct-text-body" : "ct-text-strong",
          )}
        >
          {title}
        </TitleTag>
      </div>
      {provenance || trustLabel ? (
        <div className="flex items-center gap-3 shrink-0">
          {trustLabel ? (
            <span className="body-xs ct-text-faint italic hidden sm:inline">
              {trustLabel}
            </span>
          ) : null}
          {provenance ? <ProvenanceBadge kind={provenance} variant="strip" /> : null}
        </div>
      ) : null}
    </header>
  );
}
