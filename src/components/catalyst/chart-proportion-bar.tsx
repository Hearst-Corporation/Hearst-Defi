"use client";

/**
 * ChartProportionBar — canonical 100%-stacked horizontal proportion bar
 * (HC-CHART-001).
 *
 * Recharts stacked `Bar` replacement for the retired HIS `HcStackedBar`: one
 * track split into segments sized to each value's share of the total (the
 * Strategy-Allocation "current regime" bar, capital-architecture split). Same
 * two colour modes as the donut. HONESTY: an empty / all-zero input renders the
 * neutral track only (no fabricated fill). Optional label · % legend.
 */

import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis } from "recharts";

import { chartColorAt, type ChartPalette } from "@/components/catalyst/chart-series";
import type { ChartLabeledValue } from "@/components/catalyst/chart-types";
import { cn } from "@/lib/cn";

export interface ChartProportionBarProps {
  segments: readonly ChartLabeledValue[];
  /** `accent` (default) = single-green ramp; `categorical` = per-class hues. */
  palette?: ChartPalette;
  /** Bar thickness in px. Default 12. */
  height?: number;
  /** Show a swatch · label · % legend under the bar. Default false. */
  showLegend?: boolean;
  className?: string;
  "aria-label": string;
}

export function ChartProportionBar({
  segments,
  palette = "accent",
  height = 12,
  showLegend = false,
  className,
  "aria-label": ariaLabel,
}: ChartProportionBarProps) {
  const positive = segments.map((s) => Math.max(0, s.value));
  const total = positive.reduce((sum, v) => sum + v, 0);
  const hasData = total > 0;

  // One stacked row keyed s0..sN so dynamic labels never collide as data keys.
  const row: Record<string, number | string> = { name: "allocation" };
  segments.forEach((s, i) => {
    row[`s${i}`] = positive[i]!;
  });
  const lastIdx = segments.length - 1;
  const r = height / 2;

  return (
    <div className={cn("flex flex-col gap-(--ct-space-3)", className)}>
      {hasData ? (
        <div style={{ height }} role="img" aria-label={ariaLabel}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={[row]}
              margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
              barCategoryGap={0}
            >
              <XAxis type="number" domain={[0, total]} hide />
              <YAxis type="category" dataKey="name" hide />
              {segments.map((s, i) => {
                // Round only the outermost corners so the whole bar reads as one
                // rounded track (left corners on the first segment, right on the last).
                const radius: [number, number, number, number] =
                  i === 0 && i === lastIdx
                    ? [r, r, r, r]
                    : i === 0
                      ? [r, 0, 0, r]
                      : i === lastIdx
                        ? [0, r, r, 0]
                        : [0, 0, 0, 0];
                return (
                  <Bar
                    key={`s${i}`}
                    dataKey={`s${i}`}
                    stackId="a"
                    fill={chartColorAt(palette, i)}
                    radius={radius}
                    isAnimationActive={false}
                    maxBarSize={height}
                  >
                    <Cell fill={chartColorAt(palette, i)} />
                  </Bar>
                );
              })}
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        // Honest empty: neutral track only, no fabricated fill.
        <div
          role="img"
          aria-label={ariaLabel}
          data-chart-empty="true"
          className="w-full rounded-(--ct-radius-full) bg-[var(--ct-surface-inset)]"
          style={{ height }}
        />
      )}

      {showLegend ? (
        <ul className="flex flex-wrap items-center gap-x-(--ct-space-5) gap-y-(--ct-space-2) p-0 m-0 list-none">
          {segments.map((s, i) => {
            const pct = hasData ? (positive[i]! / total) * 100 : 0;
            return (
              <li
                key={`${s.label}-${i}`}
                className="flex items-center gap-(--ct-space-2) text-[length:var(--ct-text-2xs)] text-[var(--ct-text-body)]"
              >
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0 rounded-(--ct-radius-xs)"
                  style={{ background: chartColorAt(palette, i) }}
                />
                <span className="text-[var(--ct-text-body)]">{s.label}</span>
                <span className="tabular-nums text-[var(--ct-text-primary)]">{pct.toFixed(0)}%</span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
