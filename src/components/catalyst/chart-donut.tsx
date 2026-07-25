"use client";

/**
 * ChartDonut — canonical allocation / composition donut (HC-CHART-001).
 *
 * Recharts `PieChart`/`Pie` replacement for the retired HIS `HcCompositionRing`.
 * Same two colour modes (accent luminance ramp vs the `--ct-cat-*` categorical
 * hues), same optional legend (label · %, optional gauge bar), same center
 * label/value. Normalises for DISPLAY only — it never invents a business total;
 * percentages are each segment's share of the provided sum. When the total is
 * zero it renders the neutral track only (an honest empty ring, never a
 * fabricated wedge).
 */

import { Cell, Label, Pie, PieChart } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/catalyst/chart";
import { chartColorAt, type ChartPalette } from "@/components/catalyst/chart-series";
import type { ChartLabeledValue } from "@/components/catalyst/chart-types";
import { cn } from "@/lib/cn";

export interface ChartDonutProps {
  segments: readonly ChartLabeledValue[];
  /** `accent` (default) = single-green ramp; `categorical` = per-class hues. */
  palette?: ChartPalette;
  /** Donut box size in px (square). Default 160. */
  size?: number;
  centerLabel?: string;
  centerValue?: string;
  /** Render a horizontal gauge on each legend row. Off by default. */
  bars?: boolean;
  /** Show the label · % legend. Default true. */
  showLegend?: boolean;
  className?: string;
  "aria-label": string;
}

const TRACK_FILL = "var(--ct-surface-inset)";

export function ChartDonut({
  segments,
  palette = "accent",
  size = 160,
  centerLabel,
  centerValue,
  bars = false,
  showLegend = true,
  className,
  "aria-label": ariaLabel,
}: ChartDonutProps) {
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  const hasData = total > 0;

  // Tokenised config so the tooltip resolves labels + colours by key.
  const config: ChartConfig = {};
  segments.forEach((s, i) => {
    config[`s${i}`] = { label: s.label, color: chartColorAt(palette, i) };
  });

  const rows = hasData
    ? segments.map((s, i) => ({
        key: `s${i}`,
        name: s.label,
        value: Math.max(0, s.value),
        fill: chartColorAt(palette, i),
      }))
    : [{ key: "__track__", name: "No data", value: 1, fill: TRACK_FILL }];

  return (
    <div
      className={cn(
        "flex w-full min-w-0 items-center gap-(--ct-space-4) max-sm:flex-col max-sm:items-stretch",
        !showLegend && "justify-center",
        className,
      )}
    >
      <ChartContainer
        config={config}
        aria-label={ariaLabel}
        className="aspect-square shrink-0"
        style={{ height: size, width: size }}
      >
        <PieChart>
          {hasData ? (
            <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
          ) : null}
          <Pie
            data={rows}
            dataKey="value"
            nameKey="name"
            innerRadius="62%"
            outerRadius="90%"
            stroke="var(--ct-bg-deep)"
            strokeWidth={2}
            isAnimationActive={false}
          >
            {rows.map((entry) => (
              <Cell key={entry.key} fill={entry.fill} />
            ))}
            {centerValue || centerLabel ? (
              <Label
                position="center"
                content={({ viewBox }) => {
                  if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) return null;
                  const cx = viewBox.cx ?? 0;
                  const cy = viewBox.cy ?? 0;
                  return (
                    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                      {centerValue ? (
                        <tspan
                          x={cx}
                          y={cy}
                          className="fill-[var(--ct-text-primary)] text-[length:var(--ct-text-lg)] font-bold tabular-nums"
                        >
                          {centerValue}
                        </tspan>
                      ) : null}
                      {centerLabel ? (
                        <tspan
                          x={cx}
                          y={cy + (centerValue ? 18 : 0)}
                          className="fill-[var(--ct-text-muted)] text-[length:var(--ct-text-nano)] uppercase [letter-spacing:0.12em]"
                        >
                          {centerLabel}
                        </tspan>
                      ) : null}
                    </text>
                  );
                }}
              />
            ) : null}
          </Pie>
        </PieChart>
      </ChartContainer>

      {showLegend ? (
        <ul className={cn("m-0 flex min-w-0 list-none flex-col gap-(--ct-space-2) p-0", bars && "w-full flex-1")}>
          {segments.map((s, i) => {
            const pct = hasData ? (Math.max(0, s.value) / total) * 100 : 0;
            const color = chartColorAt(palette, i);
            return (
              <li
                key={`${s.label}-${i}`}
                className="flex min-w-0 items-center gap-(--ct-space-2) text-[length:var(--ct-text-2xs)] text-[var(--ct-text-body)]"
              >
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0 rounded-(--ct-radius-xs)"
                  style={{ background: color }}
                />
                <span className="min-w-0 flex-1 truncate">{s.label}</span>
                {bars ? (
                  <span
                    aria-hidden="true"
                    className="min-w-0 flex-[2] basis-0 overflow-hidden rounded-(--ct-radius-full) bg-[var(--ct-surface-inset)]"
                    style={{ height: 4 }}
                  >
                    <span
                      className="block h-full rounded-(--ct-radius-full)"
                      style={{ width: `${pct.toFixed(1)}%`, background: color }}
                    />
                  </span>
                ) : null}
                <span
                  className={cn("shrink-0 tabular-nums text-[var(--ct-text-primary)]", !bars && "ml-auto")}
                  style={{ minWidth: bars ? 36 : undefined, textAlign: "right" }}
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
