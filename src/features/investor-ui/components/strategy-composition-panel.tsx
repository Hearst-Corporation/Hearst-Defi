"use client";

// Shared Strategy Composition donut (D3) — promoted from
// `dashboard/_components/dashboard-strategy-panel.tsx` as the premium /btc
// exclusive. Upgrades vs the original:
//  - NO hard-coded 4000/2700/3300 fallbacks: pockets absent -> honest
//    DataUnavailable state;
//  - actual vs target rendered when actualBps is available (donut shows the
//    actual split; each pocket carries a discreet delta-vs-target in pp);
//  - unused `mining` prop dropped; provenance badge added.

import { Card } from "@/components/catalyst/card";
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import type { AllocationPocketViewModel, PocketId } from "@/features/investor-ui/types/dashboard";
import { Pie, PieChart, Label, Cell } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { STRATEGY_DONUT_CONFIG } from "@/features/investor-ui/charts/asset-chart-config";
import { AssetIcon } from "@/features/investor-ui/components/asset-icon";
import { DataUnavailable } from "@/features/investor-ui/components/states/data-states";

const POCKET_META: Record<
  PocketId,
  { key: "mining" | "btc" | "ops"; name: string; role: string; icon: "mining" | "btc" | "reserve" }
> = {
  B1: { key: "mining", name: "Mining Power", role: "Produces BTC", icon: "mining" },
  B2: { key: "btc", name: "Bitcoin Reserve", role: "Accumulates BTC", icon: "btc" },
  B3: { key: "ops", name: "Operating Reserve", role: "USDC · Electricity & liquidity", icon: "reserve" },
};

function formatPct(bps: number): string {
  const pct = bps / 100;
  return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(1)}%`;
}

function formatDeltaPp(actualBps: number, targetBps: number): string | null {
  const deltaPp = (actualBps - targetBps) / 100;
  if (deltaPp === 0) return "on target";
  const sign = deltaPp > 0 ? "+" : "−";
  return `${sign}${Math.abs(deltaPp).toFixed(1)} pp vs target`;
}

export interface StrategyCompositionPanelProps {
  pockets: readonly AllocationPocketViewModel[] | null;
  /** Honesty badge for the allocation block. Defaults to "simulated". */
  provenance?: Provenance;
}

export function StrategyCompositionPanel({
  pockets,
  provenance = "simulated",
}: StrategyCompositionPanelProps) {
  if (!pockets || pockets.length === 0) {
    return (
      <Card className="w-full p-[var(--ct-space-5)]">
        <DataUnavailable label="Strategy composition" />
      </Card>
    );
  }

  // Donut shows the ACTUAL split when every pocket reports one (on-chain
  // indexed); otherwise the product target. The center label says which.
  const hasActual = pockets.every((p) => p.actualBps != null);

  const rows = pockets.map((p) => {
    const meta = POCKET_META[p.pocket];
    const shownBps = hasActual && p.actualBps != null ? p.actualBps : p.targetBps;
    return {
      ...meta,
      pocket: p.pocket,
      shownBps,
      value: shownBps / 100,
      delta: hasActual && p.actualBps != null ? formatDeltaPp(p.actualBps, p.targetBps) : null,
      fill: `var(--color-${meta.key})`,
    };
  });

  return (
    <Card className="w-full flex flex-col p-[var(--ct-space-5)] gap-[var(--ct-space-5)]">
      <div className="flex flex-wrap items-center justify-between gap-[var(--ct-space-2)]">
        <div className="flex items-center gap-[var(--ct-space-2)]">
          <AssetIcon variant="btc" size="sm" />
          <span className="ct-bento-label">Strategy composition</span>
        </div>
        <span className="flex items-center gap-[var(--ct-space-3)]">
          <span className="ct-metric-caption">Capital → BTC accumulation</span>
          <ProvenanceBadge kind={provenance} variant="compact" />
        </span>
      </div>

      <div className="flex flex-col md:flex-row items-start gap-[var(--ct-space-6)]">
        <div className="w-full md:w-[220px] shrink-0 mx-auto md:mx-0">
          <ChartContainer
            config={STRATEGY_DONUT_CONFIG}
            className="aspect-square max-h-[220px] rounded-[var(--ct-radius-md)] p-[var(--ct-space-2)]"
          >
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
              <Pie
                data={rows}
                dataKey="value"
                nameKey="name"
                innerRadius="62%"
                outerRadius="88%"
                stroke="var(--ct-bg-deep)"
                strokeWidth={2}
              >
                {rows.map((entry) => (
                  <Cell key={entry.pocket} fill={entry.fill} />
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
                            {hasActual ? "Actual" : "Target"}
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
          {rows.map((item) => (
            <div key={item.pocket} className="flex flex-col gap-[var(--ct-space-1)]">
              <div className="flex items-center justify-between gap-[var(--ct-space-2)]">
                <span className="flex items-center gap-[var(--ct-space-2)] text-[length:var(--ct-text-sm)] min-w-0">
                  <AssetIcon variant={item.icon} size="sm" />
                  <span className="truncate">{item.name}</span>
                </span>
                <span className="flex items-baseline gap-[var(--ct-space-2)] shrink-0">
                  {item.delta ? (
                    <span className="ct-metric-caption text-[var(--ct-text-muted)]">{item.delta}</span>
                  ) : null}
                  <span className="text-[length:var(--ct-text-sm)] font-medium tabular-nums">
                    {formatPct(item.shownBps)}
                  </span>
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
