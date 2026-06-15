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
  id,
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
  /** Applied to the title element for aria-labelledby on parent surfaces. */
  id?: string;
  className?: string;
}) {
  const TitleTag = titleLevel === "section" ? "h2" : "h3";
  const titleRoleClass = titleLevel === "section" ? "h2" : "h3";

  return (
    <header className={cn("dashboard-card-header", className)}>
      <div className="min-w-0 flex flex-col gap-1">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <TitleTag
          id={id}
          className={cn(
            titleRoleClass,
            "min-w-0 break-words",
            "text-[var(--ct-accent)]",
            tone === "quiet"
              ? "opacity-[var(--ct-opacity-80)] drop-shadow-[0_0_8px_var(--color-accent-dim)]"
              : "drop-shadow-[0_0_12px_var(--color-accent-subtle)]"
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
