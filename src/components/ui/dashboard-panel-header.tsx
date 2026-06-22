import type { ReactNode } from "react";
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";

/**
 * Canonical dashboard panel header — eyebrow, h2/h3 title, optional subtitle, provenance, and trailing slot.
 */
export function DashboardPanelHeader({
  title,
  eyebrow,
  subtitle,
  provenance,
  trustLabel,
  trailing,
  tone = "quiet",
  titleLevel = "widget",
  id,
  className,
}: {
  title: ReactNode;
  eyebrow?: string;
  /** Optional subtitle below the title. */
  subtitle?: string;
  provenance?: Provenance;
  /** Investor-facing trust copy shown beside provenance (e.g. Verified data). */
  trustLabel?: string;
  /** Optional trailing slot (e.g. for actions or "View all" links). */
  trailing?: ReactNode;
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
      <div className="min-w-0 flex flex-col gap-[var(--ct-space-1)]">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        {typeof title === "string" ? (
          <TitleTag
            id={id}
            className={cn(
              titleRoleClass,
              "dashboard-panel-title min-w-0 wrap-break-word",
              tone === "primary" && "ct-text-accent",
            )}
          >
            {title}
          </TitleTag>
        ) : (
          title
        )}
        {subtitle ? (
          <p className="body-xs ct-text-tertiary m-0 mono">{subtitle}</p>
        ) : null}
      </div>
      {provenance || trustLabel || trailing ? (
        <div className="flex items-center gap-[var(--ct-space-3)] shrink-0">
          {trailing}
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
