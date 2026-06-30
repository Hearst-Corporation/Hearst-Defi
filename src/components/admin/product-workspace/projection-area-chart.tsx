"use client";

/**
 * Projection area chart — the p5/p50/p95 fan from the real construction draft,
 * rendered as a shaded p5→p95 band with a crisp p50 median line. Recharts on the
 * DS (tokenised). Replaces the bespoke HcFanChart in the Report Product.
 *
 * Pure presentation: it only plots the pre-computed fanBands; no business math.
 */

import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  computeFanYDomain,
  fanBandsArePercentPoints,
  formatFanMonthLabel,
  formatFanValue,
} from "./report-format";

export interface FanBand {
  m: number;
  p5: number;
  p50: number;
  p95: number;
}

const config = {
  p95: { label: "p95", color: "var(--ct-chart-series-2)" },
  p50: { label: "p50", color: "var(--ct-accent)" },
  p5: { label: "p5", color: "var(--ct-chart-series-2)" },
} satisfies ChartConfig;

interface ProjectionTooltipProps {
  active?: boolean;
  label?: number | string;
  payload?: Array<{
    payload?: {
      p5: number;
      p50: number;
      p95: number;
    };
  }>;
  percentPoints: boolean;
}

function ProjectionTooltip({
  active,
  label,
  payload,
  percentPoints,
}: ProjectionTooltipProps) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="min-w-[11rem] rounded-(--ct-radius-lg) border border-[var(--ct-border)] bg-[var(--ct-surface-card)] p-(--ct-space-3) shadow-[var(--ct-shadow-depth)]">
      <p className="ct-metric-caption ct-text-muted">{formatFanMonthLabel(label)}</p>
      <div className="mt-(--ct-space-2) flex flex-col gap-(--ct-space-1_5)">
        {(
          [
            ["p5", row.p5],
            ["p50", row.p50],
            ["p95", row.p95],
          ] as const
        ).map(([name, value]) => (
          <div key={name} className="flex items-center justify-between gap-(--ct-space-4)">
            <span className="ct-metric-caption ct-text-muted">{name}</span>
            <span className="mono text-[length:var(--ct-text-xs)] tabular-nums ct-text-strong">
              {formatFanValue(value, percentPoints)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProjectionAreaChart({
  bands,
  unit = "%",
}: {
  bands: FanBand[];
  unit?: string;
}) {
  // Plot the band as p5 (baseline) + the p95−p5 thickness stacked on top, so the
  // shaded area sits exactly between p5 and p95; p50 is an overlaid line.
  const data = bands.map((b) => ({
    m: b.m,
    p5: b.p5,
    p50: b.p50,
    p95: b.p95,
    bandLow: b.p5,
    bandSpan: Math.max(0, b.p95 - b.p5),
  }));
  const percentPoints = unit === "%" ? fanBandsArePercentPoints(bands) : false;
  const fmt = (v: number) =>
    unit === "%" ? formatFanValue(v, percentPoints) : `${v}`;
  const yDomain = computeFanYDomain(bands, percentPoints);

  return (
    <ChartContainer config={config} className="aspect-auto h-[220px] w-full min-w-0">
      <AreaChart data={data} margin={{ left: 4, right: 12, top: 8 }}>
        <defs>
          <linearGradient id="fillBand" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--ct-accent)" stopOpacity={0.22} />
            <stop offset="95%" stopColor="var(--ct-accent)" stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="m"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tickFormatter={(m) => `M${m}`}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={58}
          domain={yDomain}
          tickCount={6}
          allowDataOverflow={false}
          tickFormatter={fmt}
        />
        <ChartTooltip
          cursor={false}
          content={<ProjectionTooltip percentPoints={percentPoints} />}
        />
        {/* Invisible baseline (p5) then the shaded span up to p95. */}
        <Area
          dataKey="bandLow"
          stackId="band"
          stroke="none"
          fill="transparent"
          isAnimationActive={false}
        />
        <Area
          dataKey="bandSpan"
          stackId="band"
          stroke="none"
          fill="url(#fillBand)"
          isAnimationActive={false}
        />
        <Area
          dataKey="p5"
          stroke="var(--ct-chart-series-2)"
          strokeWidth={1}
          strokeDasharray="3 3"
          fill="none"
          type="natural"
          isAnimationActive={false}
        />
        <Area
          dataKey="p95"
          stroke="var(--ct-chart-series-2)"
          strokeWidth={1}
          strokeDasharray="3 3"
          fill="none"
          type="natural"
          isAnimationActive={false}
        />
        {/* p50 median line on top. */}
        <Area
          dataKey="p50"
          stroke="var(--ct-accent)"
          strokeWidth={2.2}
          fill="none"
          type="natural"
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}
