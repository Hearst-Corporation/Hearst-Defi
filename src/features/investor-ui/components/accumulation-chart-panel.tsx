"use client";

import { Card } from "@/components/catalyst/card";
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { AccumulationPoint } from "@/app/(product)/dashboard/_data/accumulation-series";
import Link from "next/link";

interface AccumulationChartPanelProps {
  points: readonly AccumulationPoint[];
  currentMonth: number | null;
  totalMonths: number | null;
  provenance: Provenance;
}

const config = {
  actual: { label: "Actual BTC accumulated", color: "var(--ct-accent)" },
  mining: { label: "Mining-produced BTC", color: "var(--ct-text-muted)" },
} satisfies ChartConfig;

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
        <span className="stat-label ct-text-muted">BTC accumulation</span>
        <p className="body-sm ct-text-muted m-0">Accumulation history will appear once mining credits are indexed.</p>
      </Card>
    );
  }

  // Format month (e.g. "2026-05" -> "May")
  const data = points.map((p) => {
    const d = new Date(p.period + "-01");
    const month = d.toLocaleDateString("en-US", { month: "short" });
    return {
      period: p.period,
      month,
      actual: p.cumulativeBtc,
      mining: p.miningBtc,
    };
  });

  const maxBtc = Math.max(...data.map((d) => d.actual), 0.001);
  const domainMax = maxBtc * 1.1;

  return (
    <Card className="w-full flex flex-col p-[var(--ct-space-5)] gap-[var(--ct-space-5)]">
      <div className="flex flex-wrap items-center justify-between gap-[var(--ct-space-2)]">
        <div className="flex flex-col gap-[var(--ct-space-1)]">
          <span className="stat-label ct-text-muted">BTC accumulation</span>
          {termLabel ? <span className="body-xs ct-text-faint">{termLabel}</span> : null}
        </div>
        <span className="flex items-center gap-[var(--ct-space-3)]">
          <Link href="/btc" className="body-xs ct-link-accent whitespace-nowrap">
            View Bitcoin →
          </Link>
          <ProvenanceBadge kind={provenance} variant="compact" />
        </span>
      </div>

      <ChartContainer config={config} className="aspect-auto h-[240px] w-full min-w-0">
        <AreaChart data={data} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="fillActual" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-actual)" stopOpacity={0.2} />
              <stop offset="95%" stopColor="var(--color-actual)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--ct-border-soft)" strokeDasharray="3 3" />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={24}
            className="text-[length:var(--ct-text-nano)] ct-text-faint"
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={48}
            domain={[0, domainMax]}
            tickCount={5}
            tickFormatter={(v) => v.toFixed(3)}
            className="text-[length:var(--ct-text-nano)] ct-text-faint"
          />
          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
          
          <Area
            dataKey="mining"
            stroke="var(--color-mining)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            fill="none"
            type="monotone"
            isAnimationActive={false}
          />
          <Area
            dataKey="actual"
            stroke="var(--color-actual)"
            strokeWidth={2}
            fill="url(#fillActual)"
            type="monotone"
            isAnimationActive={false}
          />
        </AreaChart>
      </ChartContainer>

      <div className="flex flex-wrap items-center justify-between gap-[var(--ct-space-4)] pt-[var(--ct-space-3)] border-t border-[var(--ct-border-soft)]">
        <div className="flex flex-wrap gap-[var(--ct-space-4)] body-xs ct-text-muted">
          <span className="flex items-center gap-[var(--ct-space-2)]">
            <span className="inline-block h-2 w-2 rounded-full bg-[var(--ct-accent)]" />
            Actual BTC accumulated
          </span>
          <span className="flex items-center gap-[var(--ct-space-2)]">
            <span className="inline-block h-0.5 w-4 border-t border-dashed border-[var(--ct-text-muted)]" />
            Mining-produced BTC
          </span>
        </div>
        <p className="body-xs ct-text-faint m-0 text-right">
          Historical accumulation only — maturity target is product-defined, not guaranteed.
        </p>
      </div>
    </Card>
  );
}
