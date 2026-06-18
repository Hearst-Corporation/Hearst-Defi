import type { ReactNode } from "react";

import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";

export { PanelStatus } from "@/components/ui/panel-status";


export type PfCockpitPanelVariant = "wide" | "compact" | "table";

export type PfCockpitTitleVariant = "rail" | "primary";

/** Flat graphite panel — same surface family as the hero rail sidebar.
 *
 * Portfolio widget shell tiers (cockpit /portfolio):
 *   L1 — PfCockpitPanel: all LP widgets (graphite, not glass Card)
 *   L2 — NestedPanel: inset rows inside a cockpit panel (proof, risk, trust)
 *   L3 — ProductSection: multi-widget section chrome (header + welded bento grid)
 *
 * ModuleChrome (glass Card) is reserved for non-portfolio modules embedded in
 * ProductSection elsewhere; portfolio widgets must use PfCockpitPanel only.
 */
export function PfCockpitPanel({
  variant = "wide",
  "aria-label": ariaLabel,
  children,
  className,
}: {
  variant?: PfCockpitPanelVariant;
  "aria-label": string;
  children: ReactNode;
  className?: string;
}) {
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
  titleVariant = "rail",
}: {
  title: ReactNode;
  subtitle?: string;
  provenance?: Provenance;
  trailing?: ReactNode;
  titleVariant?: PfCockpitTitleVariant;
}) {
  const titleClass = panelTitleClass(titleVariant);

  return (
    <header className="pf-cockpit-panel__header">
      <div className="pf-cockpit-panel__header-main min-w-0">
        {typeof title === "string" ? (
          <h3 className={titleClass}>{title}</h3>
        ) : (
          title
        )}
        {subtitle ? (
          <p className="pf-cockpit-panel__subtitle body-xs ct-text-faint m-0 mono">
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

/** Subsection label inside a cockpit panel (stat-label scale, not h3). */
export function PfCockpitSubhead({
  title,
  meta,
  className,
}: {
  title: ReactNode;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("pf-cockpit-panel__subhead", className)}>
      <span className="stat-label">{title}</span>
      {meta ? (
        <span className="pf-cockpit-panel__subhead-meta tabular body-xs ct-text-faint font-normal">
          {meta}
        </span>
      ) : null}
    </div>
  );
}
