"use client";

/**
 * ChartFan — canonical projection fan (p5 / p50 / p95, optional p25 / p75)
 * (HC-CHART-001).
 *
 * Recharts `AreaChart` replacement for the retired HIS `HcFanChart` and the
 * bespoke honest-fan SVG. Uses the proven "invisible baseline + shaded span"
 * stacked-Area technique (same as the admin ProjectionAreaChart). The band is
 * NEVER accent green by default — a projection is not a promise; the median tone
 * is configurable so the honest research fan can render it muted+dashed. Bands
 * are pre-computed by the caller; this component plots them and adds no business
 * math. Fewer than two bands → honest empty surface.
 */

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/catalyst/chart";
import { extent } from "@/components/catalyst/chart-scale";
import { cn } from "@/lib/cn";

export interface ChartFanBand {
  /** Horizon position (e.g. month index). */
  m: number;
  p5: number;
  p50: number;
  p95: number;
  /** Optional inner (p25–p75) band for graded density. */
  p25?: number;
  p75?: number;
}

export interface ChartFanProps {
  bands: readonly ChartFanBand[];
  height?: number;
  unit?: string;
  valueFormat?: (n: number) => string;
  /** `accent` solid (default) or `muted` dashed (honest research fan). */
  medianTone?: "accent" | "muted";
  /** Band fill tint. `info` (default) never reads as accent/guaranteed. */
  bandTone?: "accent" | "info" | "graphite";
  seedLabel?: string;
  /** Footer disclaimer (rendered as chrome under the plot). */
  footerNote?: string;
  className?: string;
  "aria-label": string;
}

const BAND_FILL: Record<NonNullable<ChartFanProps["bandTone"]>, string> = {
  accent: "var(--ct-accent)",
  info: "var(--ct-status-info)",
  graphite: "var(--ct-chart-neutral)",
};

const config: ChartConfig = {
  p95: { label: "p95", color: "var(--ct-chart-band-stroke)" },
  p50: { label: "p50", color: "var(--ct-accent)" },
  p5: { label: "p5", color: "var(--ct-chart-band-stroke)" },
};

export function ChartFan({
  bands,
  height,
  unit = "%",
  valueFormat,
  medianTone = "accent",
  bandTone = "info",
  seedLabel,
  footerNote = "not guaranteed",
  className,
  "aria-label": ariaLabel,
}: ChartFanProps) {
  const plotHeight = height ?? undefined;

  if (bands.length < 2) {
    return (
      <div
        role="img"
        data-chart-empty="true"
        aria-label={ariaLabel}
        className={cn(
          "rounded-(--ct-radius-md) border border-dashed border-[var(--ct-border)]",
          className,
        )}
        style={{ height: plotHeight ?? "var(--ct-chart-h)" }}
      />
    );
  }

  const hasInner = bands.every((b) => b.p25 != null && b.p75 != null);
  const data = bands.map((b) => ({
    m: b.m,
    p5: b.p5,
    p50: b.p50,
    p95: b.p95,
    outerLow: b.p5,
    outerSpan: Math.max(0, b.p95 - b.p5),
    innerLow: b.p25 ?? b.p50,
    innerSpan: hasInner ? Math.max(0, (b.p75 ?? 0) - (b.p25 ?? 0)) : 0,
  }));

  const [lo, hi] = extent(bands.flatMap((b) => [b.p5, b.p95]));
  const pad = (hi - lo) * 0.08 || 1;
  const yDomain: [number, number] = [lo - pad, hi + pad];

  const fmt = (v: number) =>
    valueFormat ? valueFormat(v) : `${v.toFixed(1)}${unit === "%" ? "%" : ""}`;
  const bandColor = BAND_FILL[bandTone];
  const edgeColor = bandTone === "graphite" ? "var(--ct-border)" : "var(--ct-chart-band-stroke)";
  const medianColor = medianTone === "muted" ? "var(--ct-text-muted)" : "var(--ct-accent)";

  return (
    <div className={cn("flex w-full min-w-0 flex-col gap-(--ct-space-2)", className)}>
      <ChartContainer
        config={config}
        aria-label={ariaLabel}
        className="aspect-auto w-full min-w-0"
        style={{ height: plotHeight ?? "var(--ct-chart-h)" }}
      >
        <AreaChart data={data} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="fillFanOuter" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={bandColor} stopOpacity={0.18} />
              <stop offset="95%" stopColor={bandColor} stopOpacity={0.03} />
            </linearGradient>
            <linearGradient id="fillFanInner" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={bandColor} stopOpacity={0.28} />
              <stop offset="95%" stopColor={bandColor} stopOpacity={0.08} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--ct-chart-grid)" />
          <XAxis
            dataKey="m"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={24}
            tickFormatter={(m) => `M${m}`}
            tick={{ fill: "var(--ct-chart-axis)", fontSize: 11 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={56}
            domain={yDomain}
            tickCount={4}
            tickFormatter={fmt}
            tick={{ fill: "var(--ct-chart-axis)", fontSize: 11 }}
          />
          <ChartTooltip cursor={false} content={() => null} />
          {/* Outer p5–p95 band. */}
          <Area dataKey="outerLow" stackId="outer" stroke="none" fill="transparent" isAnimationActive={false} />
          <Area dataKey="outerSpan" stackId="outer" stroke="none" fill="url(#fillFanOuter)" isAnimationActive={false} />
          {/* Inner p25–p75 band (graded density) when supplied. */}
          {hasInner ? (
            <>
              <Area dataKey="innerLow" stackId="inner" stroke="none" fill="transparent" isAnimationActive={false} />
              <Area dataKey="innerSpan" stackId="inner" stroke="none" fill="url(#fillFanInner)" isAnimationActive={false} />
            </>
          ) : null}
          {/* Dashed p5 / p95 edges. */}
          <Area dataKey="p5" stroke={edgeColor} strokeWidth={1} strokeDasharray="3 3" fill="none" type="natural" isAnimationActive={false} />
          <Area dataKey="p95" stroke={edgeColor} strokeWidth={1} strokeDasharray="3 3" fill="none" type="natural" isAnimationActive={false} />
          {/* Median p50. */}
          <Area
            dataKey="p50"
            stroke={medianColor}
            strokeWidth={2.2}
            strokeDasharray={medianTone === "muted" ? "5 4" : undefined}
            fill="none"
            type="natural"
            isAnimationActive={false}
          />
        </AreaChart>
      </ChartContainer>
      <p className="ct-metric-caption m-0 text-right text-[var(--ct-text-faint)]">
        {seedLabel ? `seed: ${seedLabel} · ` : ""}
        {hasInner ? "p5/p25/p50/p75/p95" : "p5/p50/p95"} · {footerNote}
      </p>
    </div>
  );
}
