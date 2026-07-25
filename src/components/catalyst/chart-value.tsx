"use client";

/**
 * ChartValue — canonical value-over-time (NAV / accumulation) area+line
 * (HC-CHART-001).
 *
 * Recharts `AreaChart` replacement for the retired HIS `HcValueChart`. Keeps the
 * two load-bearing HIS contracts:
 *  - the y-axis is FRAMED on the data range (`valueYDomain`, padded, never
 *    baselined at 0) so a tight high-base band keeps its amplitude instead of
 *    flattening into a slab;
 *  - fewer than two points is NOT a trend → an honest empty surface, never a
 *    fabricated line.
 * The area is a fast-fading accent wash; per-sample dots show only for short
 * series (≤ 24 points), matching the HIS behaviour.
 */

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/catalyst/chart";
import { CHART_CURVE_COLOR } from "@/components/catalyst/chart-series";
import { valueYDomain } from "@/components/catalyst/chart-scale";
import type { ChartValuePoint } from "@/components/catalyst/chart-types";
import { cn } from "@/lib/cn";

export interface ChartValueProps {
  points: readonly ChartValuePoint[];
  /** Plot height in px. Default 220. */
  height?: number;
  /** Y-axis + tooltip value formatter. */
  valueFormat?: (n: number) => string;
  /** Render per-sample dots for short series (≤ 24 points). Default true. */
  showPointDots?: boolean;
  /** Honest empty-state message. */
  emptyMessage?: string;
  className?: string;
  "aria-label": string;
}

const DATE_TICK = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function toMs(at: ChartValuePoint["at"]): number {
  if (typeof at === "number") return Number.isFinite(at) ? at : 0;
  if (at instanceof Date) return at.getTime();
  const t = new Date(at).getTime();
  return Number.isFinite(t) ? t : 0;
}

const config: ChartConfig = {
  value: { label: "Value", color: CHART_CURVE_COLOR },
};

export function ChartValue({
  points,
  height = 220,
  valueFormat = (n) => n.toLocaleString(),
  showPointDots = true,
  emptyMessage = "No portfolio history yet",
  className,
  "aria-label": ariaLabel,
}: ChartValueProps) {
  // A single point (or none) is not a trend — honest empty surface.
  if (points.length < 2) {
    return (
      <div
        role="img"
        data-chart-empty="true"
        aria-label={ariaLabel}
        className={cn(
          "flex items-center justify-center rounded-(--ct-radius-xl) border border-dashed border-[var(--ct-border-soft)] bg-[var(--ct-surface-inset)]",
          className,
        )}
        style={{ height }}
      >
        <span className="text-[length:var(--ct-text-nano)] ct-text-muted">{emptyMessage}</span>
      </div>
    );
  }

  const data = points.map((p) => ({
    at: toMs(p.at),
    value: Number.isFinite(p.value) ? p.value : 0,
    label: DATE_TICK.format(new Date(toMs(p.at))),
  }));
  const yDomain = valueYDomain(data.map((d) => d.value));
  const showDots = showPointDots && data.length <= 24;

  return (
    <ChartContainer
      config={config}
      aria-label={ariaLabel}
      className={cn("aspect-auto w-full min-w-0", className)}
      style={{ height }}
    >
      <AreaChart data={data} margin={{ left: 4, right: 12, top: 12, bottom: 0 }}>
        <defs>
          <linearGradient id="fillChartValue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_CURVE_COLOR} stopOpacity={0.28} />
            <stop offset="55%" stopColor={CHART_CURVE_COLOR} stopOpacity={0.06} />
            <stop offset="100%" stopColor={CHART_CURVE_COLOR} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--ct-border-soft)" strokeDasharray="2 5" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tick={{ fill: "var(--ct-chart-axis)", fontSize: 11 }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={56}
          domain={yDomain}
          tickCount={5}
          tickFormatter={(v) => valueFormat(Number(v))}
          tick={{ fill: "var(--ct-chart-axis)", fontSize: 11 }}
        />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Area
          dataKey="value"
          stroke={CHART_CURVE_COLOR}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          fill="url(#fillChartValue)"
          type="linear"
          isAnimationActive={false}
          dot={
            showDots
              ? { r: 4, fill: CHART_CURVE_COLOR, stroke: "var(--ct-bg-deep)", strokeWidth: 2 }
              : false
          }
          activeDot={{ r: 5, fill: CHART_CURVE_COLOR, stroke: "var(--ct-bg-deep)", strokeWidth: 2 }}
        />
      </AreaChart>
    </ChartContainer>
  );
}
