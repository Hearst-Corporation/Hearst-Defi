"use client";

import { Bar, BarChart, CartesianGrid, XAxis, Cell } from "recharts";
import {
  buildTwelveMonthAxis,
  formatPeriod,
  type DistribEntry,
} from "@/components/portfolio/distrib-calendar";
import { formatUsdFull } from "@/lib/vaults/product-display";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

export interface DistributionChartProps {
  entries: DistribEntry[];
}

export function DistributionChart({ entries }: DistributionChartProps) {
  const now = new Date();
  const refYear = now.getUTCFullYear();
  const currentPeriod = `${refYear}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const data = buildTwelveMonthAxis(entries, now);

  const chartData = data.map((d) => {
    const isForecast = d.paidAt === null;
    const isCurrent = d.period === currentPeriod;

    return {
      periodRaw: d.period,
      month: formatPeriod(d.period, refYear),
      value: d.amountUsdc,
      isForecast,
      isCurrent,
    };
  });

  const config = {
    value: { label: "Distribution" },
  };

  const hasPayouts = entries.some((e) => e.amountUsdc > 0);

  return (
    <div className="relative mt-4 h-[180px] w-full">
      {!hasPayouts ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-4 bottom-12 z-10 flex flex-col items-center justify-center gap-1 px-4 text-center -translate-y-1"
          role="status"
          aria-label="No distributions recorded yet"
        >
          <span className="ct-bento-label">No distributions yet</span>
          <span className="ct-metric-caption max-w-[240px]">
            Monthly USDC payouts will appear on this axis once posted.
          </span>
        </div>
      ) : null}
      <ChartContainer config={config} className="h-full w-full">
      <BarChart data={chartData} margin={{ top: 10, right: 0, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--ct-border-soft)" strokeDasharray="3 3" />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={12}
          fontSize={11}
          stroke="var(--ct-text-muted)"
        />
        <ChartTooltip
          cursor={{ fill: "var(--ct-surface-inset)", radius: 4 }}
          content={
            <ChartTooltipContent
              hideLabel
              formatter={(value, name, item: any, index) => {
                const isForecast = item.payload.isForecast;
                const formatted = formatUsdFull(value as number);
                return (
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{ background: isForecast ? "var(--ct-text-muted)" : "var(--ct-accent)" }}
                    />
                    <span className="font-medium text-[var(--ct-text-strong)]">
                      {isForecast ? `~${formatted} (Est.)` : formatted}
                    </span>
                  </div>
                );
              }}
            />
          }
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40}>
          {chartData.map((entry, index) => {
            const isEmpty = entry.value <= 0 && !entry.isForecast;
            return (
            <Cell
              key={`cell-${index}`}
              fill={
                isEmpty
                  ? "transparent"
                  : entry.isForecast
                  ? "var(--ct-surface-inset)"
                  : "var(--ct-accent)"
              }
              fillOpacity={
                isEmpty ? 0 : entry.isForecast ? 0.3 : entry.isCurrent ? 1 : 0.8
              }
              stroke={
                isEmpty
                  ? "transparent"
                  : entry.isForecast
                  ? "var(--ct-text-muted)"
                  : "transparent"
              }
              strokeDasharray={entry.isForecast ? "4 4" : "none"}
              strokeWidth={entry.isForecast ? 1 : 0}
            />
            );
          })}
        </Bar>
      </BarChart>
    </ChartContainer>
    </div>
  );
}