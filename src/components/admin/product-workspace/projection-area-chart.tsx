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
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/catalyst/chart";

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

/** Percent tick: the engine emits fractions (0.063) → "6.3%". */
function pctTick(v: number): string {
  return `${(v * 100).toFixed(0)}%`;
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

  const fmt = (v: number) => (unit === "%" ? pctTick(v) : `${v}`);

  return (
    <ChartContainer config={config} className="aspect-auto h-[300px] w-full">
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
          width={44}
          tickFormatter={fmt}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              labelFormatter={(m) => `Month ${m}`}
              formatter={(value, name) =>
                name === "bandLow" || name === "bandSpan" ? null : (
                  <span className="flex w-full justify-between gap-(--ct-space-3)">
                    <span className="ct-text-muted">{String(name)}</span>
                    <span className="mono tabular-nums ct-text-strong">
                      {fmt(Number(value))}
                    </span>
                  </span>
                )
              }
            />
          }
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
          stroke="var(--ct-chart-series-2)"
          strokeWidth={1}
          strokeDasharray="3 3"
          fill="url(#fillBand)"
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
