import { cn } from "@/lib/cn";

/**
 * EmptyChartState — calm, institutional placeholder for a chart/visual that has
 * no data yet.
 *
 * Design contract (`docs/DESIGN_SYSTEM.md` §9.3):
 * **Empty states replace active module surfaces; they are not rendered inside
 * active module surfaces.**
 *
 * Callers must early-return this component when primary chart data is missing —
 * never wrap it in `dash-cell-premium`, headers, or provenance badges.
 *
 * Renders `.pf-empty-chart` (portfolio.css): quiet reserved zone, hairline
 * border, DS radius — no blur, shadow, `ct-surface-1`, dashed border, or ghost
 * SVG. Preserves chart height (caller passes parity classes). Single message
 * only. `role="note"` so assistive tech does not announce a chart that is not
 * there.
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
