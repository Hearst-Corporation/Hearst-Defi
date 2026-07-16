"use client";

import { Card } from "@/components/catalyst/card";
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { SOURCES_STACKED_CONFIG } from "@/features/investor-ui/charts/asset-chart-config";
import { toMonthlyDeltas } from "@/features/investor-ui/charts/accumulation-series";
import { formatPeriodMonth } from "@/features/investor-ui/format-btc";
import { AssetIcon } from "@/features/investor-ui/components/asset-icon";
import Link from "next/link";

interface SourcesAccumulationPanelProps {
  /**
   * CUMULATIVE per-source series (as derived from `buildAccumulationSeries`:
   * each month carries the running total per source). The panel converts it
   * to real monthly deltas before rendering — bars labelled "monthly" must
   * never show cumulative values.
   */
  monthlyProduction: { period: string; mining: number; strategic: number }[];
  /** Honesty badge for the series. Defaults to "simulated" (fixture seam). */
  provenance?: Provenance;
  /** Section title. PROMPT 236 renames this to "Sources of Bitcoin" on /btc. */
  title?: string;
  /** Optional caption under the title. */
  caption?: string;
  /** Optional header link (e.g. "View mining contribution →"). Mining Pulse
   *  is not a standalone card on /btc — it collapses to this contextual link. */
  action?: { label: string; href: string };
}

export function SourcesAccumulationPanel({
  monthlyProduction,
  provenance = "simulated",
  title = "Sources of accumulation",
  caption = "Monthly accumulation by source",
  action,
}: SourcesAccumulationPanelProps) {
  if (monthlyProduction.length === 0) return null;

  const deltas = toMonthlyDeltas(
    monthlyProduction.map((p) => ({
      period: p.period,
      miningBtc: p.mining,
      cumulativeBtc: p.mining + p.strategic,
    })),
  );

  const data = deltas.map((p) => ({
    period: p.period,
    mining: p.miningBtc,
    strategic: p.strategicBtc,
    month: formatPeriodMonth(p.period),
    total: p.totalBtc,
  }));

  return (
    <Card className="w-full flex flex-col p-[var(--ct-space-5)] gap-[var(--ct-space-5)]">
      <div className="flex flex-wrap items-center justify-between gap-[var(--ct-space-2)]">
        <div className="flex flex-col gap-[var(--ct-space-1)]">
          <div className="flex items-center gap-[var(--ct-space-2)]">
            <AssetIcon variant="btc" size="sm" />
            <span className="ct-bento-label">{title}</span>
          </div>
          <span className="ct-metric-caption">{caption}</span>
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
