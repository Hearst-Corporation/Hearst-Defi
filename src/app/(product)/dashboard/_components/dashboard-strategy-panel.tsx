"use client";

import { Card } from "@/components/catalyst/card";
import type { AllocationPocketViewModel } from "@/features/investor-ui/types/dashboard";
import type { MiningViewModel } from "@/features/investor-ui/types";
import { Pie, PieChart, Label, Cell } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

export function DashboardStrategyPanel({
  pockets,
  mining,
}: {
  pockets: readonly AllocationPocketViewModel[] | null;
  mining: MiningViewModel;
}) {
  const b1 = pockets?.find((p) => p.pocket === "B1")?.targetBps ?? 4000;
  const b2 = pockets?.find((p) => p.pocket === "B2")?.targetBps ?? 2700;
  const b3 = pockets?.find((p) => p.pocket === "B3")?.targetBps ?? 3300;

  const data = [
    { name: "Mining Power", value: b1 / 100, fill: "var(--color-mining)" },
    { name: "Bitcoin Reserve", value: b2 / 100, fill: "var(--color-btc)" },
    { name: "Operating Reserve", value: b3 / 100, fill: "var(--color-ops)" },
  ];

  const config = {
    value: { label: "Allocation" },
    mining: { label: "Mining Power", color: "var(--ct-text-strong)" },
    btc: { label: "Bitcoin Reserve", color: "var(--ct-accent)" },
    ops: { label: "Operating Reserve", color: "var(--ct-text-muted)" },
  } satisfies ChartConfig;

  return (
    <Card className="w-full flex flex-col p-[var(--ct-space-5)] gap-[var(--ct-space-5)] h-full">
      <div className="flex items-center justify-between">
        <span className="stat-label ct-text-muted">Strategy composition</span>
        <span className="body-xs ct-text-faint">Capital → BTC Accumulation</span>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-[var(--ct-space-6)] flex-1 min-h-[220px]">
        <div className="w-full md:w-1/2 max-w-[240px]">
          <ChartContainer config={config} className="aspect-square">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
              <Pie 
                data={data} 
                dataKey="value" 
                nameKey="name" 
                innerRadius="65%" 
                outerRadius="90%"
                stroke="none"
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
                            className="fill-[var(--ct-text-strong)] text-[length:var(--ct-text-xl)] font-semibold"
                          >
                            100%
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy || 0) + 24}
                            className="fill-[var(--ct-text-muted)] text-[length:var(--ct-text-nano)]"
                          >
                            Deployed
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

        <div className="flex flex-col gap-[var(--ct-space-4)] w-full md:w-1/2">
          {data.map((item, idx) => (
            <div key={idx} className="flex flex-col gap-[var(--ct-space-1)]">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-[var(--ct-space-2)] text-[length:var(--ct-text-sm)]">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: item.fill }} />
                  {item.name}
                </span>
                <span className="text-[length:var(--ct-text-sm)] font-medium tabular-nums">{item.value}%</span>
              </div>
            </div>
          ))}
          <div className="pt-[var(--ct-space-3)] border-t border-[var(--ct-border-soft)] mt-[var(--ct-space-2)] flex justify-between items-center">
             <span className="text-[length:var(--ct-text-sm)] ct-text-muted">Target</span>
             <span className="text-[length:var(--ct-text-sm)] font-medium text-[var(--ct-accent)] tabular-nums">Bitcoin Accumulation</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
