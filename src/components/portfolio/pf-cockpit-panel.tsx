import type { ReactNode } from "react";

import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";

export type PfCockpitPanelVariant = "wide" | "compact" | "table";

/** Flat graphite panel — same surface family as the hero rail sidebar. */
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

/** Rail-style panel title — uppercase micro label, optional provenance. */
export function PfCockpitPanelHeader({
  title,
  subtitle,
  provenance,
  trailing,
}: {
  title: ReactNode;
  subtitle?: string;
  provenance?: Provenance;
  trailing?: ReactNode;
}) {
  return (
    <header className="pf-cockpit-panel__header">
      <div className="min-w-0">
        {typeof title === "string" ? (
          <h3 className="pf-hero-rail-title">{title}</h3>
        ) : (
          title
        )}
        {subtitle ? (
          <p className="pf-cockpit-panel__subtitle body-xs ct-text-faint m-0 mt-0.5 mono">
            {subtitle}
          </p>
        ) : null}
      </div>
      {trailing || provenance ? (
        <div className="pf-cockpit-panel__header-trail flex items-center gap-1.5 shrink-0">
          {trailing}
          {provenance ? <ProvenanceBadge kind={provenance} compact /> : null}
        </div>
      ) : null}
    </header>
  );
}
