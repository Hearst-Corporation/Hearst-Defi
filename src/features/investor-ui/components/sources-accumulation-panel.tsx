"use client";

import { Card } from "@/components/catalyst/card";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

interface SourcesAccumulationPanelProps {
  monthlyProduction: { period: string; mining: number; strategic: number }[];
}

const config = {
  mining: { label: "Mining Production", color: "var(--color-mining)" },
  strategic: { label: "Strategic Exposure", color: "var(--color-actual)" },
} satisfies ChartConfig;

export function SourcesAccumulationPanel({ monthlyProduction }: SourcesAccumulationPanelProps) {
  if (monthlyProduction.length === 0) return null;

  const data = monthlyProduction.map(p => ({
    ...p,
    month: new Date(p.period + "-01").toLocaleDateString("en-US", { month: "short" })
  }));

  return (
    <Card className="w-full flex flex-col p-[var(--ct-space-5)] gap-[var(--ct-space-5)]">
      <div className="flex flex-col gap-[var(--ct-space-1)]">
        <span className="stat-label ct-text-muted">Sources of accumulation</span>
        <span className="body-xs ct-text-faint">Monthly breakdown of BTC acquired</span>
      </div>

      <ChartContainer config={config} className="aspect-auto h-[240px] w-full min-w-0">
        <BarChart data={data} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--ct-border-soft)" strokeDasharray="3 3" />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            className="text-[length:var(--ct-text-nano)] ct-text-faint"
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={48}
            tickFormatter={(v) => v.toFixed(3)}
            className="text-[length:var(--ct-text-nano)] ct-text-faint"
          />
          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
          <Bar dataKey="mining" stackId="a" fill="var(--ct-text-strong)" radius={[0, 0, 4, 4]} isAnimationActive={false} />
          <Bar dataKey="strategic" stackId="a" fill="var(--ct-accent)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ChartContainer>
    </Card>
  );
}
