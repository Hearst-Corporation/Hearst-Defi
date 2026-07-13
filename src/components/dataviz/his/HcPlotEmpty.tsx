/**
 * HcPlotEmpty — canonical HIS plot empty state.
 *
 * Wraps `EmptySurface variant="chart"` with `data-hc-empty="true"` and a
 * compact height cap so empty charts never reserve a full hero-sized plot area.
 */

import { EmptySurface } from "@/components/catalyst/empty-surface";
import { cn } from "@/lib/cn";

/** Max plot height for an empty state — keeps cards compact. */
export const HC_PLOT_EMPTY_MAX_HEIGHT = 132;

export interface HcPlotEmptyProps {
  message: string;
  /** Requested plot height in px. Capped at {@link HC_PLOT_EMPTY_MAX_HEIGHT}. Ignored when `fill`. */
  height?: number;
  /** Stretch to the parent plot slot (e.g. inside `HcChartCard`). */
  fill?: boolean;
  "aria-label"?: string;
  className?: string;
}

export function HcPlotEmpty({
  message,
  height,
  fill = false,
  "aria-label": ariaLabel,
  className,
}: HcPlotEmptyProps) {
  const cappedHeight = fill
    ? undefined
    : Math.min(height ?? HC_PLOT_EMPTY_MAX_HEIGHT, HC_PLOT_EMPTY_MAX_HEIGHT);

  return (
    <div
      {...(ariaLabel ? { role: "img" as const, "aria-label": ariaLabel } : {})}
      data-hc-empty="true"
      className={cn(fill && "h-full w-full", className)}
      style={cappedHeight !== undefined ? { height: cappedHeight } : undefined}
    >
      <EmptySurface variant="chart" message={message} className="h-full min-h-0" />
    </div>
  );
}
