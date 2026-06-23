import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export { PanelStatus } from "@/components/ui/panel-status";


export type PfCockpitPanelVariant = "wide" | "compact" | "table";
export type PfCockpitPanelChrome = "panel" | "embedded";

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
        <span className="pf-cockpit-panel__subhead-meta tabular body-xs ct-text-tertiary font-normal">
          {meta}
        </span>
      ) : null}
    </div>
  );
}
