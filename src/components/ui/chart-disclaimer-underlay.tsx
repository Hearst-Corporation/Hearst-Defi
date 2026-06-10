import { cn } from "@/lib/cn";

const DEFAULT_TEXT =
  "projections · not guaranteed · methodology v1.0" as const;

export interface ChartDisclaimerUnderlayProps {
  text?: string;
  className?: string;
}

/**
 * Decorative disclaimer watermark rendered behind chart content.
 *
 * Absolutely fills its positioned ancestor, pointer-events disabled.
 * Typography via `.ct-chart-disclaimer-text` in cockpit.css.
 *
 * aria-hidden="true" — content is announced through the chart's own
 * provenance badge and methodology disclosure elsewhere in the page.
 */
export function ChartDisclaimerUnderlay({
  text = DEFAULT_TEXT,
  className,
}: ChartDisclaimerUnderlayProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden",
        className,
      )}
    >
      <span className="ct-chart-disclaimer-text">{text}</span>
    </div>
  );
}
