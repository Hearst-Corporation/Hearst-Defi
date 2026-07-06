/**
 * HcStackedBar — HIS horizontal stacked proportion bar.
 *
 * One rounded track split into segments sized to each value's share of the total
 * (the Strategy-Allocation "current regime" bar, scenario mini-bars). Pure server
 * render, token-only. Two colour modes mirror `HcCompositionRing`:
 *  - `accent` (default) — single-green luminance ramp;
 *  - `categorical` — per-class hues via the sanctioned `--ct-cat-*` palette (order
 *    segments mining → usdc → btc → hedge).
 *
 * HONESTY: an empty / all-zero input renders just the neutral track (no fabricated
 * fill). Optional legend lists label · %.
 */

import { cn } from "@/lib/cn";
import type { HcLabeledValue } from "./types";

export interface HcStackedBarProps {
  segments: readonly HcLabeledValue[];
  palette?: "accent" | "categorical";
  /** Bar thickness in px. Default 10. */
  height?: number;
  /** Show a "swatch · label · %" legend under the bar. Default false. */
  showLegend?: boolean;
  className?: string;
  "aria-label": string;
}

const ACCENT_RAMP: readonly string[] = [
  "var(--ct-chart-series-1)",
  "var(--ct-chart-series-2)",
  "var(--ct-chart-series-3)",
  "var(--ct-chart-series-4)",
  "var(--ct-chart-neutral)",
];

const CATEGORICAL_RAMP: readonly string[] = [
  "var(--ct-cat-mining)",
  "var(--ct-cat-usdc)",
  "var(--ct-cat-btc)",
  "var(--ct-cat-hedge)",
  "var(--ct-chart-neutral)",
];

export function HcStackedBar({
  segments,
  palette = "accent",
  height = 10,
  showLegend = false,
  className,
  ...rest
}: HcStackedBarProps) {
  const ariaLabel = rest["aria-label"];
  const ramp = palette === "categorical" ? CATEGORICAL_RAMP : ACCENT_RAMP;
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);

  return (
    <div className={cn("flex flex-col gap-(--ct-space-3)", className)}>
      <div
        role="img"
        aria-label={ariaLabel}
        className="flex w-full overflow-hidden rounded-(--ct-radius-full) bg-surface-inset"
        style={{ height }}
      >
        {total > 0 &&
          segments.map((s, i) => {
            const pct = (Math.max(0, s.value) / total) * 100;
            if (pct <= 0) return null;
            return (
              <span
                key={s.label}
                title={`${s.label}: ${pct.toFixed(1)}%`}
                data-hc-bar="segment"
                style={{ width: `${pct}%`, background: ramp[i % ramp.length] }}
              />
            );
          })}
      </div>

      {showLegend ? (
        <ul className="flex flex-wrap items-center gap-x-(--ct-space-5) gap-y-(--ct-space-2)">
          {segments.map((s, i) => {
            const pct = total > 0 ? (Math.max(0, s.value) / total) * 100 : 0;
            return (
              <li
                key={s.label}
                className="flex items-center gap-(--ct-space-2)"
                style={{ fontSize: "var(--ct-text-2xs)", color: "var(--ct-text-body)" }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "var(--ct-radius-xs)",
                    background: ramp[i % ramp.length],
                  }}
                />
                <span className="ct-text-body">{s.label}</span>
                <span
                  style={{
                    color: "var(--ct-text-primary)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {pct.toFixed(0)}%
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
