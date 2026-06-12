import { cn } from "@/lib/cn";

/**
 * EmptyChartState — calm, institutional placeholder for a chart/visual that has
 * no data yet.
 *
 * Renders the `.pf-empty-chart` surface (portfolio.css): a quiet reserved zone
 * with a near-invisible fill and a hairline border — DS radius, no blur, no
 * shadow, no `ct-surface-1`, no dashed border, no `dash-cell-premium`. The
 * parent widget is already a surface; an empty chart should read as a
 * deliberate placeholder, not a wireframe dropzone or a hollow gap.
 *
 * - Preserves the chart's visual height to avoid layout shift between the empty
 *   and populated states (caller passes the same height the chart would take).
 * - Centers a single message — no second "no data" line elsewhere.
 * - `role="note"` (not `img`/`chart`) so assistive tech doesn't announce a chart
 *   that isn't there.
 */
export interface EmptyChartStateProps {
  /** Single calm sentence. Keep institutional, no marketing. */
  message: string;
  /**
   * Accessible label for the empty region. Only set when it adds information
   * beyond the visible message — otherwise the visible text already labels the
   * note and a duplicate `aria-label` is redundant.
   */
  ariaLabel?: string;
  /** Round the surface (donut slot, where the zone is square). */
  round?: boolean;
  /** Extra classes for height/spacing parity with the populated chart. */
  className?: string;
}

export function EmptyChartState({
  message,
  ariaLabel,
  round,
  className,
}: EmptyChartStateProps) {
  return (
    <div
      role="note"
      {...(ariaLabel ? { "aria-label": ariaLabel } : {})}
      className={cn(
        "pf-empty-chart relative z-10",
        round && "pf-empty-chart--round",
        className,
      )}
    >
      <span className="body-xs ct-text-faint">{message}</span>
    </div>
  );
}
