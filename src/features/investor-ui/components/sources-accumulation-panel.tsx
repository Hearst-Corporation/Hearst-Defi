"use client";

import { Card } from "@/components/catalyst/card";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { SOURCES_STACKED_CONFIG } from "@/features/investor-ui/charts/asset-chart-config";
import { AssetIcon } from "@/features/investor-ui/components/asset-icon";

interface SourcesAccumulationPanelProps {
  monthlyProduction: { period: string; mining: number; strategic: number }[];
}

export function SourcesAccumulationPanel({ monthlyProduction }: SourcesAccumulationPanelProps) {
  if (monthlyProduction.length === 0) return null;

  const data = monthlyProduction.map((p) => ({
    ...p,
    month: new Date(p.period + "-01").toLocaleDateString("en-US", { month: "short" }),
    total: p.mining + p.strategic,
  }));

  return (
    <Card className="w-full flex flex-col p-[var(--ct-space-5)] gap-[var(--ct-space-5)]">
      <div className="flex flex-col gap-[var(--ct-space-1)]">
        <div className="flex items-center gap-[var(--ct-space-2)]">
          <AssetIcon variant="btc" size="sm" />
          <span className="ct-bento-label">Sources of accumulation</span>
        </div>
        <span className="ct-metric-caption">Monthly breakdown of BTC acquired</span>
      </div>

      <ChartContainer
        config={SOURCES_STACKED_CONFIG}
        className="aspect-auto h-[var(--ct-chart-investor-compact)] w-full min-w-0 rounded-[var(--ct-radius-md)] bg-[var(--ct-surface-inset)] p-[var(--ct-space-4)]"
      >
        <BarChart data={data} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--ct-chart-grid)" strokeDasharray="3 3" />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tick={{ fill: "var(--ct-chart-axis)", fontSize: 11 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={52}
            tickFormatter={(v) => Number(v).toFixed(3)}
            tick={{ fill: "var(--ct-chart-axis)", fontSize: 11 }}
          />
          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar
            dataKey="mining"
            stackId="a"
            fill="var(--color-mining)"
            radius={[0, 0, 3, 3]}
            isAnimationActive={false}
          />
          <Bar
            dataKey="strategic"
            stackId="a"
            fill="var(--color-strategic)"
            radius={[3, 3, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ChartContainer>
    </Card>
  );
}
