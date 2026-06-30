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
import { cn } from "@/lib/cn";
import {
  computeFanYDomain,
  fanBandsArePercentPoints,
  formatFanValue,
} from "@/components/admin/product-workspace/report-format";

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

type FanRow = FanBand & { bandLow: number; bandSpan: number };

function ProjectionTooltip({
  active,
  payload,
  percentPoints,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: FanRow }>;
  percentPoints: boolean;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row || typeof row.m !== "number") return null;

  return (
    <div
      className={cn(
        "grid min-w-[9rem] gap-(--ct-space-1_5) rounded-(--ct-radius-lg) border border-[var(--ct-border)]",
        "bg-surface-card px-(--ct-space-3) py-(--ct-space-2) text-[length:var(--ct-text-xs)] shadow-[var(--ct-shadow-elevated)]",
      )}
    >
      <span className="font-medium ct-text-strong">Month {row.m}</span>
      <div className="grid gap-(--ct-space-1)">
        {(
          [
            ["p5", row.p5],
            ["p50", row.p50],
            ["p95", row.p95],
          ] as const
        ).map(([name, value]) => (
          <span key={name} className="flex justify-between gap-(--ct-space-4)">
            <span className="ct-text-muted">{name}</span>
            <span className="mono tabular-nums ct-text-strong">
              {formatFanValue(value, percentPoints)}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function ProjectionAreaChart({
  bands,
  unit = "%",
  compact = false,
  /** When true, values are already percent points (pipeline fan bands). Auto-detected when omitted. */
  percentPoints,
}: {
  bands: FanBand[];
  unit?: string;
  compact?: boolean;
  percentPoints?: boolean;
}) {
  const isPercentPoints = percentPoints ?? (unit === "%" && fanBandsArePercentPoints(bands));
  const yDomain = unit === "%" ? computeFanYDomain(bands, isPercentPoints) : undefined;

  const data = bands.map((b) => ({
    m: b.m,
    p5: b.p5,
    p50: b.p50,
    p95: b.p95,
    bandLow: b.p5,
    bandSpan: Math.max(0, b.p95 - b.p5),
  }));

  const fmt = (v: number) =>
    unit === "%" ? formatFanValue(v, isPercentPoints) : `${v}`;

  return (
    <ChartContainer
      config={config}
      className={cn(
        "aspect-auto w-full min-w-0",
        compact ? "h-[240px] min-h-[220px] max-h-[280px]" : "h-[min(300px,42vh)] min-h-[220px]",
      )}
    >
      <AreaChart data={data} margin={{ left: 4, right: 12, top: 8, bottom: 4 }}>
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
          minTickGap={28}
          tickFormatter={(m) => (typeof m === "number" ? `M${m}` : "")}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={48}
          tickFormatter={fmt}
          {...(yDomain ? { domain: yDomain } : {})}
        />
        <ChartTooltip
          cursor={false}
          content={<ProjectionTooltip percentPoints={isPercentPoints} />}
        />
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
