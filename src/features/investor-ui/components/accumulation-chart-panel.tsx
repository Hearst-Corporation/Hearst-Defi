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
import { ACCUMULATION_CHART_CONFIG } from "@/features/investor-ui/charts/asset-chart-config";
import { AssetIcon } from "@/features/investor-ui/components/asset-icon";
import type { AccumulationPoint } from "@/app/(product)/dashboard/_data/accumulation-series";
import Link from "next/link";

interface AccumulationChartPanelProps {
  points: readonly AccumulationPoint[];
  currentMonth: number | null;
  totalMonths: number | null;
  provenance: Provenance;
}

export function AccumulationChartPanel({
  points,
  currentMonth,
  totalMonths,
  provenance,
}: AccumulationChartPanelProps) {
  const termLabel =
    currentMonth != null && totalMonths != null
      ? `Month ${currentMonth} of ${totalMonths}`
      : null;

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
    const d = new Date(p.period + "-01");
    const month = d.toLocaleDateString("en-US", { month: "short" });
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
          <Link href="/btc" className="body-xs ct-link-accent whitespace-nowrap">
            View Bitcoin →
          </Link>
          <ProvenanceBadge kind={provenance} variant="compact" />
        </span>
      </div>

      <ChartContainer
        config={ACCUMULATION_CHART_CONFIG}
        className="aspect-auto h-[var(--ct-chart-investor-main)] w-full min-w-0 rounded-[var(--ct-radius-md)] bg-[var(--ct-surface-inset)] p-[var(--ct-space-4)]"
      >
        <AreaChart data={data} margin={{ left: 4, right: 8, top: 12, bottom: 0 }}>
          <defs>
            <linearGradient id="fillActualBtc" x1="0" y1="0" x2="0" y2="1">
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
          <Line
            dataKey="reference"
            stroke="var(--color-reference)"
            strokeWidth={1}
            strokeDasharray="4 4"
            dot={false}
            type="monotone"
            isAnimationActive={false}
          />
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
            fill="url(#fillActualBtc)"
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
        Historical accumulation only — maturity target is product-defined, not guaranteed.
      </p>
    </Card>
  );
}
