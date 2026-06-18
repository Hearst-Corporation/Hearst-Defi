import React, { type ReactNode } from "react";

import {
  PfCockpitPanel,
  PfCockpitPanelHeader,
} from "@/components/portfolio/pf-cockpit-panel";
import { cn } from "@/lib/cn";
import type { WidgetView } from "@/lib/portfolio/view-state";

/**
 * WidgetShell — thin layout wrapper for portfolio widgets.
 *
 * Callers are responsible for resolving `view` (mode + provenance) via
 * `resolveWidgetView` before passing it in. This component NEVER recomputes
 * provenance — it trusts `view` verbatim (honesty contract, CLAUDE.md §2).
 *
 * Renders:
 *   PfCockpitPanel > PfCockpitPanelHeader > (zeroSlot | children) > footnote?
 *
 * Server Component — no "use client".
 */
export interface WidgetShellProps {
  ariaLabel: string;
  variant?: "wide" | "compact" | "table";
  title: ReactNode;
  subtitle?: string;
  titleVariant?: "rail" | "primary";
  trailing?: ReactNode;
  /** Authoritative resolved view — { mode, provenance }. Never recomputed here. */
  view: WidgetView;
  /** Rendered when view.mode === "zero". */
  zeroSlot: ReactNode;
  /** Rendered when view.mode === "live". */
  children: ReactNode;
  /** Rendered after content, in live mode only. */
  footnote?: ReactNode;
  className?: string;
}

export function WidgetShell({
  ariaLabel,
  variant = "wide",
  title,
  subtitle,
  titleVariant,
  trailing,
  view,
  zeroSlot,
  children,
  footnote,
  className,
}: WidgetShellProps): React.ReactElement {
  return (
    <PfCockpitPanel
      variant={variant}
      aria-label={ariaLabel}
      className={cn(className)}
    >
      <PfCockpitPanelHeader
        title={title}
        subtitle={subtitle}
        titleVariant={titleVariant}
        provenance={view.provenance}
        trailing={trailing}
      />
      {view.mode === "zero" ? zeroSlot : children}
      {view.mode === "live" && footnote ? footnote : null}
    </PfCockpitPanel>
  );
}
