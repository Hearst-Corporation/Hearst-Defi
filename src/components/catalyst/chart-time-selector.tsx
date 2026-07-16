// deferred: ValueChart uses a fixed 12-month server-derived series; no time-range data layer exists yet; wire when chart data supports multiple ranges
"use client";

import { cn } from "@/lib/cn";

export type TimeRange = "1M" | "3M" | "6M" | "1Y" | "ALL";

const ALL_OPTIONS: ReadonlyArray<TimeRange> = [
  "1M",
  "3M",
  "6M",
  "1Y",
  "ALL",
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
 * Active segment  : strong underline + var(--ct-text-primary).
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
        "flex h-6 items-center gap-[var(--ct-space-0_5)]",
        "stat-label mono",
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
              "h-6 rounded-sm px-[var(--ct-space-1_5)] transition-colors ease-[var(--ct-ease)]",
              // Keyboard focus — repo pattern (cockpit-button): suppress the
              // UA outline, show the accent ring. Never outline-hidden +
              // outline-2 (Tailwind v4 outline-style poisoning).
              "focus-visible:outline-none ct-focus-ring",
              isActive
                ? [
                    "ct-text-accent",
                    "font-bold",
                    "border-b border-b-[var(--ct-accent)]",
                  ]
                : [
                    "ct-text-muted",
                    "ct-text-body-hover",
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
