import { cn } from "@/lib/cn";

/**
 * EmptyChartState — calm, institutional placeholder for a chart/visual that has
 * no data yet.
 *
 * Deliberately minimal: it does NOT render a ghost chart, a dashed border, or a
 * nested mini-surface (`ct-surface-1`). The parent widget is already a surface;
 * an empty chart should read as quiet absence, not a wireframe dropzone.
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
  /** Accessible label for the empty region (defaults to the message). */
  ariaLabel?: string;
  /** Extra classes for height/spacing parity with the populated chart. */
  className?: string;
}

export function EmptyChartState({
  message,
  ariaLabel,
  className,
}: EmptyChartStateProps) {
  return (
    <div
      role="note"
      aria-label={ariaLabel ?? message}
      className={cn(
        "flex w-full items-center justify-center text-center relative z-10",
        className,
      )}
    >
      <span className="body-xs ct-text-faint">{message}</span>
    </div>
  );
}
