import type { ReactNode } from "react";

import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";

export { PanelStatus } from "@/components/catalyst/panel-status";


export type PfCockpitPanelVariant = "wide" | "compact" | "table";

export type PfCockpitTitleVariant = "rail" | "primary";
export type PfCockpitPanelChrome = "panel" | "embedded";

/** Flat graphite panel — same surface family as the hero rail sidebar.
 *
 * Portfolio widget shell tiers (cockpit /portfolio):
 *   L1 — PfCockpitPanel: standalone widget shell when a module owns its surface
 *   L2 — embedded pane: widget content rendered inside a fused parent surface
 *   L3 — ProductSection: multi-widget section chrome (header + welded bento grid)
 *
 * ModuleChrome (glass Card) stays reserved for non-portfolio modules embedded in
 * ProductSection elsewhere. Portfolio widgets may render either as a standalone
 * PfCockpitPanel or as an embedded pane inside a fused cockpit surface.
 */
export function PfCockpitPanel({
  variant = "wide",
  chrome = "panel",
  "aria-label": ariaLabel,
  children,
  className,
}: {
  variant?: PfCockpitPanelVariant;
  chrome?: PfCockpitPanelChrome;
  "aria-label": string;
  children: ReactNode;
  className?: string;
}) {
  if (chrome === "embedded") {
    return (
      <div
        className={cn("pf-embedded-pane", className)}
        aria-label={ariaLabel}
        data-pf-panel-chrome="embedded"
        data-pf-panel-variant={variant}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "pf-cockpit-panel",
        variant === "wide" && "pf-cockpit-panel--wide",
        variant === "compact" && "pf-cockpit-panel--compact",
        variant === "table" && "pf-cockpit-panel--table",
        className,
      )}
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}

function panelTitleClass(variant: PfCockpitTitleVariant): string {
  return variant === "primary"
    ? "pf-cockpit-panel__title--primary"
    : "pf-panel-title";
}

/** Panel title — rail (micro uppercase) or primary (sm semibold, chart / CTA). */
export function PfCockpitPanelHeader({
  title,
  subtitle,
  provenance,
  trailing,
  titleEnd,
  titleVariant = "rail",
}: {
  title: ReactNode;
  subtitle?: string;
  provenance?: Provenance;
  trailing?: ReactNode;
  titleEnd?: ReactNode;
  titleVariant?: PfCockpitTitleVariant;
}) {
  const titleClass = panelTitleClass(titleVariant);
  const titleNode =
    typeof title === "string" ? (
      <h2 className={titleClass}>{title}</h2>
    ) : (
      title
    );

  return (
    <header className="pf-cockpit-panel__header">
      <div className="pf-cockpit-panel__header-main min-w-0">
        {titleEnd ? (
          <div className="pf-cockpit-panel__title-row">
            {titleNode}
            <span className="pf-cockpit-panel__title-end">{titleEnd}</span>
          </div>
        ) : (
          titleNode
        )}
        {subtitle ? (
          <p className="pf-cockpit-panel__subtitle body-xs ct-text-tertiary m-0 mono">
            {subtitle}
          </p>
        ) : null}
      </div>
      {trailing || provenance ? (
        <div className="pf-cockpit-panel__header-trail">
          {trailing}
          {provenance ? <ProvenanceBadge kind={provenance} compact /> : null}
        </div>
      ) : null}
    </header>
  );
}
