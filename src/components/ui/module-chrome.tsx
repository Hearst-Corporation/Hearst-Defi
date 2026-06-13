"use client";

import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { useSectionEmbed } from "@/components/ui/section-embed";
import { cn } from "@/lib/cn";

/**
 * Active module shell — Card + premium dot grid when standalone;
 * plain flex wrapper when embedded in ProductSection.
 *
 * @deprecated for portfolio widgets — use PfCockpitPanel (graphite) instead.
 * Retained for future non-portfolio ProductSection modules.
 */
export function ModuleChrome({
  "aria-label": ariaLabel,
  adornment,
  children,
  className,
  hoverOverlay = true,
}: {
  "aria-label": string;
  /** Optional chrome (e.g. chart provenance corner) hidden when embedded. */
  adornment?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Card hover wash — off for portfolio pf-value-chart (graphite surface). */
  hoverOverlay?: boolean;
}) {
  const embedded = useSectionEmbed();

  const content = (
    <>
      {!embedded && adornment ? adornment : null}
      {children}
    </>
  );

  if (embedded) {
    return (
      <div
        className={cn("flex h-full min-w-0 flex-col", className)}
        aria-label={ariaLabel}
      >
        {content}
      </div>
    );
  }

  return (
    <Card
      className={cn("card-premium flex h-full min-w-0 flex-col", className)}
      aria-label={ariaLabel}
      hoverOverlay={hoverOverlay}
    >
      {content}
    </Card>
  );
}
