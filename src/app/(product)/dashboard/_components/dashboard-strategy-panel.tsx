"use client";

import { Card } from "@/components/catalyst/card";
import type { AllocationPocketViewModel } from "@/features/investor-ui/types/dashboard";
import type { MiningViewModel } from "@/features/investor-ui/types";
import { Pie, PieChart, Label, Cell } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { STRATEGY_DONUT_CONFIG } from "@/features/investor-ui/charts/asset-chart-config";
import { AssetIcon } from "@/features/investor-ui/components/asset-icon";

const POCKET_META = [
  {
    key: "mining" as const,
    name: "Mining Power",
    role: "Produces BTC",
    icon: "mining" as const,
  },
  {
    key: "btc" as const,
    name: "Bitcoin Reserve",
    role: "Accumulates BTC",
    icon: "btc" as const,
  },
  {
    key: "ops" as const,
    name: "Operating Reserve",
    role: "USDC · Electricity & liquidity",
    icon: "reserve" as const,
  },
];

export function DashboardStrategyPanel({
  pockets,
  mining: _mining,
}: {
  pockets: readonly AllocationPocketViewModel[] | null;
  mining: MiningViewModel;
}) {
  const b1 = pockets?.find((p) => p.pocket === "B1")?.targetBps ?? 4000;
  const b2 = pockets?.find((p) => p.pocket === "B2")?.targetBps ?? 2700;
  const b3 = pockets?.find((p) => p.pocket === "B3")?.targetBps ?? 3300;
  const values = [b1 / 100, b2 / 100, b3 / 100];

  const data = POCKET_META.map((meta, i) => ({
    ...meta,
    value: values[i] ?? 0,
    fill: `var(--color-${meta.key})`,
  }));

  return (
    <Card className="w-full flex flex-col p-[var(--ct-space-5)] gap-[var(--ct-space-5)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[var(--ct-space-2)]">
          <AssetIcon variant="btc" size="sm" />
          <span className="ct-bento-label">Strategy composition</span>
        </div>
        <span className="ct-metric-caption">Capital → BTC accumulation</span>
      </div>

      <div className="flex flex-col md:flex-row items-start gap-[var(--ct-space-6)]">
        <div className="w-full md:w-[220px] shrink-0 mx-auto md:mx-0">
          <ChartContainer
            config={STRATEGY_DONUT_CONFIG}
            className="aspect-square max-h-[220px] rounded-[var(--ct-radius-md)] bg-[var(--ct-surface-inset)] p-[var(--ct-space-2)]"
          >
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius="62%"
                outerRadius="88%"
                stroke="var(--ct-bg-deep)"
                strokeWidth={2}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
                <Label
                  position="center"
                  content={({ viewBox }) => {
                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                      return (
                        <text
                          x={viewBox.cx}
                          y={viewBox.cy}
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          <tspan
                            x={viewBox.cx}
                            y={viewBox.cy}
                            className="fill-[var(--ct-asset-btc)] text-[length:var(--ct-text-lg)] font-semibold"
                          >
                            BTC
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy || 0) + 18}
                            className="fill-[var(--ct-text-muted)] text-[length:var(--ct-text-nano)]"
                          >
                            Target
                          </tspan>
                        </text>
                      );
                    }
                  }}
                />
              </Pie>
            </PieChart>
          </ChartContainer>
        </div>

        <div className="flex flex-col gap-[var(--ct-space-4)] w-full min-w-0">
          {data.map((item) => (
            <div key={item.key} className="flex flex-col gap-[var(--ct-space-1)]">
              <div className="flex items-center justify-between gap-[var(--ct-space-2)]">
                <span className="flex items-center gap-[var(--ct-space-2)] text-[length:var(--ct-text-sm)] min-w-0">
                  <AssetIcon variant={item.icon} size="sm" />
                  <span className="truncate">{item.name}</span>
                </span>
                <span className="text-[length:var(--ct-text-sm)] font-medium tabular-nums shrink-0">
                  {item.value}%
                </span>
              </div>
              <span className="ct-metric-caption pl-[calc(16px+var(--ct-space-2))]">{item.role}</span>
            </div>
          ))}
          <div className="pt-[var(--ct-space-3)] border-t border-[var(--ct-border-soft)] flex justify-between items-center">
            <span className="body-sm ct-text-muted">Destination</span>
            <span className="text-[length:var(--ct-text-sm)] font-medium text-[var(--ct-asset-btc)] tabular-nums">
              Bitcoin accumulation
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
