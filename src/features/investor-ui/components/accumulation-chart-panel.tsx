"use client";

import { Card } from "@/components/catalyst/card";
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import { Area, AreaChart, CartesianGrid, Line, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  ACCUMULATION_CHART_CONFIGS,
  ACCUMULATION_CHART_CONFIG,
  type AccumulationChartTone,
} from "@/features/investor-ui/charts/asset-chart-config";
import { AssetIcon } from "@/features/investor-ui/components/asset-icon";
import { formatPeriodMonth } from "@/features/investor-ui/format-btc";
import type { AccumulationPoint } from "@/features/investor-ui/charts/accumulation-series";
import Link from "next/link";

export interface AccumulationChartAction {
  label: string;
  href: string;
}

/** Default keeps the historical behaviour (Dashboard linked to /btc). Pass
 *  `action={null}` to render no link (e.g. on /btc itself — no self-link). */
const DEFAULT_ACTION: AccumulationChartAction = { label: "View Bitcoin →", href: "/btc" };

interface AccumulationChartPanelProps {
  points: readonly AccumulationPoint[];
  currentMonth: number | null;
  totalMonths: number | null;
  provenance: Provenance;
  /** Colour direction (D1/D2): "btc" = asset orange (default, /btc),
   *  "accent" = product green (Dashboard). */
  tone?: AccumulationChartTone;
  /** Header link. Omit for the historical "View Bitcoin →"; null for none. */
  action?: AccumulationChartAction | null;
  /** Illustrative dashed "Reference path" baseline. Default true (Dashboard
   *  keeps it). PROMPT 236: /btc passes `false` — the investor surface shows
   *  historical accumulation only, no planned/reference projection line. */
  showReference?: boolean;
}

export function AccumulationChartPanel({
  points,
  currentMonth,
  totalMonths,
  provenance,
  tone = "btc",
  action = DEFAULT_ACTION,
  showReference = true,
}: AccumulationChartPanelProps) {
  const termLabel =
    currentMonth != null && totalMonths != null
      ? `Month ${currentMonth} of ${totalMonths}`
      : null;

  const chartConfig = ACCUMULATION_CHART_CONFIGS[tone] ?? ACCUMULATION_CHART_CONFIG;
  const gradientId = `fillActualBtc-${tone}`;

  if (points.length < 2) {
    return (
      <Card className="w-full flex flex-col p-[var(--ct-space-5)] gap-[var(--ct-space-4)]">
        <div className="flex items-center gap-[var(--ct-space-2)]">
          <AssetIcon variant="btc" size="sm" />
          <span className="ct-bento-label">BTC accumulation</span>
        </div>
        <p className="body-sm ct-text-muted m-0">Accumulation history will appear once mining credits are indexed.</p>
      </Card>
    );
  }

  const data = points.map((p, i) => {
    const month = formatPeriodMonth(p.period);
    // Fixture-only illustrative baseline (85% of actual) — labelled
    // "Reference path" in the chart config; covered by the page-level
    // simulated provenance, never presented as a target or a promise.
    const reference = p.cumulativeBtc * 0.85;
    return {
      period: p.period,
      month,
      actual: p.cumulativeBtc,
      mining: p.miningBtc,
      reference,
      isCurrent: i === points.length - 1,
    };
  });

  const maxBtc = Math.max(...data.map((d) => d.actual), 0.001);
  const domainMax = maxBtc * 1.1;

  return (
    <Card className="w-full flex flex-col p-[var(--ct-space-5)] gap-[var(--ct-space-5)]">
      <div className="flex flex-wrap items-center justify-between gap-[var(--ct-space-2)]">
        <div className="flex flex-col gap-[var(--ct-space-1)]">
          <div className="flex items-center gap-[var(--ct-space-2)]">
            <AssetIcon variant="btc" size="sm" />
            <span className="ct-bento-label">BTC accumulation</span>
          </div>
          {termLabel ? <span className="ct-metric-caption">{termLabel}</span> : null}
        </div>
        <span className="flex items-center gap-[var(--ct-space-3)]">
          {action ? (
            <Link href={action.href} className="body-xs ct-link-accent whitespace-nowrap">
              {action.label}
            </Link>
          ) : null}
          <ProvenanceBadge kind={provenance} variant="compact" />
        </span>
      </div>

      <ChartContainer
        config={chartConfig}
        className="aspect-auto h-[var(--ct-chart-investor-main)] w-full min-w-0 rounded-[var(--ct-radius-md)] bg-[var(--ct-surface-inset)] p-[var(--ct-space-4)]"
      >
        <AreaChart data={data} margin={{ left: 4, right: 8, top: 12, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-actual)" stopOpacity={0.35} />
              <stop offset="95%" stopColor="var(--color-actual)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--ct-chart-grid)" strokeDasharray="3 3" />
          <XAxis
            dataKey="month"
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
            width={52}
            domain={[0, domainMax]}
            tickCount={5}
            tickFormatter={(v) => `${Number(v).toFixed(3)}`}
            tick={{ fill: "var(--ct-chart-axis)", fontSize: 11 }}
          />
          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          {showReference ? (
            <Line
              dataKey="reference"
              stroke="var(--color-reference)"
              strokeWidth={1}
              strokeDasharray="4 4"
              dot={false}
              type="monotone"
              isAnimationActive={false}
            />
          ) : null}
          <Area
            dataKey="mining"
            stroke="var(--color-mining)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            fill="none"
            type="monotone"
            isAnimationActive={false}
            dot={false}
          />
          <Area
            dataKey="actual"
            stroke="var(--color-actual)"
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            type="monotone"
            isAnimationActive={false}
            dot={(props) => {
              const { cx, cy, payload } = props as { cx?: number; cy?: number; payload?: { isCurrent?: boolean } };
              if (!payload?.isCurrent || cx == null || cy == null) return null;
              return (
                <circle
                  cx={cx}
                  cy={cy}
                  r={5}
                  fill="var(--color-actual)"
                  stroke="var(--ct-bg-deep)"
                  strokeWidth={2}
                />
              );
            }}
            activeDot={{
              r: 5,
              fill: "var(--color-actual)",
              stroke: "var(--ct-bg-deep)",
              strokeWidth: 2,
            }}
          />
        </AreaChart>
      </ChartContainer>

      <p className="ct-metric-caption m-0">
        Historical accumulation only — delivered in BTC at maturity, not guaranteed.
      </p>
    </Card>
  );
}
