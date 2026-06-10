"use client";

import { cn } from "@/lib/cn";

export type TimeRange = "1D" | "7D" | "30D" | "90D" | "YTD" | "All";

const ALL_OPTIONS: ReadonlyArray<TimeRange> = [
  "1D",
  "7D",
  "30D",
  "90D",
  "YTD",
  "All",
];
const CHART_TIME_RANGE_ARIA_LABEL = "Chart time range";

export interface ChartTimeSelectorProps {
  value: TimeRange;
  options?: ReadonlyArray<TimeRange>;
  onChange: (next: TimeRange) => void;
  className?: string;
}

/**
 * Segmented time-range control for charts.
 *
 * Height: 24 px · Mono font · Accessible radiogroup.
 *
 * Active segment  : var(--ct-accent) underline + var(--ct-text-primary).
 * Inactive segment: var(--ct-text-muted), hover → var(--ct-text-body).
 */
export function ChartTimeSelector({
  value,
  options = ALL_OPTIONS,
  onChange,
  className,
}: ChartTimeSelectorProps) {
  return (
    <div
      role="radiogroup"
      aria-label={CHART_TIME_RANGE_ARIA_LABEL}
      className={cn(
        "flex h-6 items-center gap-0.5",
        "mono text-micro leading-none tracking-wide uppercase",
        className,
      )}
    >
      {options.map((opt) => {
        const isActive = opt === value;
        return (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(opt)}
            className={cn(
              "h-6 rounded-sm px-1.5 transition-colors",
              isActive
                ? [
                    "ct-text-primary",
                    "border-b border-b-(--ct-accent)",
                  ]
                : [
                    "ct-text-muted",
                    "hover:ct-text-body",
                    "border-b border-b-transparent",
                  ],
            )}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
