"use client";

// AccumulationChartSignature — the institutional hero chart for /dashboard.
// A dual-axis composition matching the design target:
//   • BTC accumulated       — filled accent area (left axis, "BTC")
//   • Illustrative pace     — dashed accent line (left axis)
//   • Market price (USD)     — muted grey area behind (right axis, "USD")
//
// The accumulation series is real (buildAccumulationSeries). The pace line
// and market-price backdrop are illustrative fixture derivations, covered by
// the page-level simulated provenance badge — never presented as a target, a
// promise, or a live quote. Left axis is BTC, right axis is USD.

import { Card } from "@/components/catalyst/card";
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import { Area, ComposedChart, CartesianGrid, Line, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { ChartConfig } from "@/components/ui/chart";
import { ChartTimeSelector, type TimeRange } from "@/components/catalyst/chart-time-selector";
import { AssetIcon } from "@/features/investor-ui/components/asset-icon";
import { useState } from "react";
import { formatPeriodMonth } from "@/features/investor-ui/format-btc";
import { withIllustrativePace } from "@/features/investor-ui/charts/accumulation-series";
import type { AccumulationPoint } from "@/features/investor-ui/charts/accumulation-series";

/** Tone switch: "accent" = product green (/dashboard), "btc" = asset orange
 *  (/btc). Drives every stroke/fill of the actual + pace series. */
export type SignatureTone = "accent" | "btc";

const TONE_COLOR: Record<SignatureTone, string> = {
  accent: "var(--ct-accent)",
  btc: "var(--ct-asset-btc)",
};

/** Per-tone chart config — the tooltip/legend swatches read --color-<key>. */
const SIGNATURE_CONFIGS: Record<SignatureTone, ChartConfig> = {
  accent: {
    actual: { label: "BTC accumulated", color: TONE_COLOR.accent },
    pace: { label: "Illustrative pace", color: TONE_COLOR.accent },
    price: { label: "Market price (USD)", color: "var(--ct-chart-neutral)" },
  },
  btc: {
    actual: { label: "BTC accumulated", color: TONE_COLOR.btc },
    pace: { label: "Illustrative pace", color: TONE_COLOR.btc },
    price: { label: "Market price (USD)", color: "var(--ct-chart-neutral)" },
  },
};

interface AccumulationChartSignatureProps {
  points: readonly AccumulationPoint[];
  currentMonth: number | null;
  totalMonths: number | null;
  provenance: Provenance;
  /** Illustrative fixture BTC/USD anchor for the market-price backdrop. */
  marketPriceUsd?: number;
  /** Colour direction — green on /dashboard (default), orange on /btc. */
  tone?: SignatureTone;
}

/**
 * Deterministic pseudo-market-price backdrop. Anchored on a spot value, it
 * walks a bounded, seedless sine+drift so the grey area reads as a plausible
 * price history without any randomness (engine-purity friendly: no
 * Math.random, no Date.now). Illustrative only.
 */
function marketPriceSeries(count: number, anchor: number): number[] {
  const start = anchor * 0.42;
  return Array.from({ length: count }, (_, i) => {
    const t = count > 1 ? i / (count - 1) : 0;
    const trend = start + (anchor - start) * t;
    const wobble = Math.sin(i * 0.9) * anchor * 0.045 + Math.sin(i * 0.37) * anchor * 0.028;
    return Math.max(0, trend + wobble);
  });
}

export function AccumulationChartSignature({
  points,
  currentMonth,
  totalMonths,
  provenance,
  marketPriceUsd = 100_000,
  tone = "accent",
}: AccumulationChartSignatureProps) {
  // Presentation-only range toggle. The data layer serves a single
  // server-derived series today, so ranges are illustrative slices of it —
  // never a refetch, never a fabricated series. "ALL" = since inception.
  const [range, setRange] = useState<TimeRange>("ALL");
  const toneColor = TONE_COLOR[tone];

  const termLabel =
    currentMonth != null && totalMonths != null ? `Month ${currentMonth} of ${totalMonths}` : null;

  if (points.length < 2) {
    return (
      <Card className="w-full flex flex-col p-[var(--ct-space-5)] gap-[var(--ct-space-4)]">
        <div className="flex items-center gap-[var(--ct-space-2)]">
          <AssetIcon variant="btc" size="sm" />
          <span className="ct-bento-label">BTC accumulation</span>
        </div>
        <p className="body-sm ct-text-muted m-0">
          Accumulation history will appear once mining credits are indexed.
        </p>
      </Card>
    );
  }

  // Illustrative range slice — tail N months of the real series. "ALL" keeps
  // the full since-inception series (design target default).
  const RANGE_MONTHS: Record<TimeRange, number | null> = {
    "1M": 1,
    "3M": 3,
    "6M": 6,
    "1Y": 12,
    ALL: null,
  };
  const window = RANGE_MONTHS[range];
  // Pace + market-price backdrop are derived ONCE from the FULL series, then
  // sliced alongside the visible window — neither the pace shape nor the USD
  // level may change form when the user switches time ranges.
  const pacedPoints = withIllustrativePace(points);
  const fullPrices = marketPriceSeries(points.length, marketPriceUsd);
  const visiblePoints =
    window != null && window < pacedPoints.length ? pacedPoints.slice(-window) : pacedPoints;
  const prices =
    window != null && window < fullPrices.length ? fullPrices.slice(-window) : fullPrices;
  const data = visiblePoints.map((p, i) => ({
    period: p.period,
    month: formatPeriodMonth(p.period),
    actual: p.cumulativeBtc,
    // Pace line trends clearly ABOVE actual toward term end. Illustrative
    // (fixture), computed on the full series in withIllustrativePace.
    pace: p.pace,
    price: prices[i],
    // Current dot = last point of the VISIBLE window (tail slice keeps the
    // latest month, so this is also the latest point of the full series).
    isCurrent: i === visiblePoints.length - 1,
  }));

  const maxBtc = Math.max(...data.map((d) => Math.max(d.actual, d.pace)), 0.001);
  const btcMax = maxBtc * 1.04;
  // Adaptive tick precision — sub-2 BTC programs need decimals or every tick
  // collapses to "0 BTC / 0 BTC / 1 BTC".
  const btcTickDecimals = maxBtc < 2 ? 2 : maxBtc < 10 ? 1 : 0;
  // Stretch the USD domain so the grey price backdrop stays in the LOWER
  // 40% of the frame — depth, never competition with the accent curve.
  // Anchored on the FULL series so the level reads stable between windows.
  const priceMax = Math.max(...fullPrices, 1) * 2.2;

  return (
    <Card
      className="w-full flex flex-col p-[var(--ct-space-5)]"
      contentClassName="flex h-full min-h-0 flex-col gap-[var(--ct-space-4)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-[var(--ct-space-3)]">
        <div className="flex items-center gap-[var(--ct-space-2)]">
          <AssetIcon variant="btc" size="sm" />
          <span className="ct-bento-label">BTC accumulation</span>
          {termLabel ? <span className="ct-metric-caption">· {termLabel}</span> : null}
        </div>
        <span className="flex items-center gap-[var(--ct-space-3)]">
          <ChartTimeSelector value={range} onChange={setRange} />
          <ProvenanceBadge kind={provenance} variant="compact" />
        </span>
      </div>

      {/* Legend row */}
      <div className="flex flex-wrap items-center gap-[var(--ct-space-4)] -mt-[var(--ct-space-2)]">
        <LegendItem swatch={<span className="h-0.5 w-4 rounded-full" style={{ background: toneColor }} />}>
          BTC accumulated
        </LegendItem>
        <LegendItem
          swatch={
            <span
              className="h-0.5 w-4 rounded-full"
              style={{ background: `repeating-linear-gradient(90deg, ${toneColor} 0 4px, transparent 4px 8px)` }}
            />
          }
        >
          Illustrative pace
        </LegendItem>
        <LegendItem swatch={<span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: "color-mix(in srgb, var(--ct-chart-neutral) 45%, transparent)" }} />}>
          Market price (USD)
        </LegendItem>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        <ChartContainer
          config={SIGNATURE_CONFIGS[tone]}
          className="aspect-auto h-[var(--ct-chart-investor-main)] w-full min-w-0 flex-1 rounded-[var(--ct-radius-md)] bg-[var(--ct-surface-inset)] p-[var(--ct-space-4)]"
        >
          <ComposedChart data={data} margin={{ left: 4, right: 4, top: 12, bottom: 0 }}>
            <defs>
              <linearGradient id={`sig-fill-${tone}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={toneColor} stopOpacity={0.42} />
                <stop offset="70%" stopColor={toneColor} stopOpacity={0.06} />
                <stop offset="100%" stopColor={toneColor} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="sig-fill-price" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--ct-chart-neutral)" stopOpacity={0.22} />
                <stop offset="100%" stopColor="var(--ct-chart-neutral)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--ct-chart-grid)" strokeDasharray="3 3" />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={28}
              tick={{ fill: "var(--ct-chart-axis)", fontSize: 11 }}
            />
            {/* Left axis — BTC */}
            <YAxis
              yAxisId="btc"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={48}
              domain={[0, btcMax]}
              tickCount={5}
              tickFormatter={(v) => `${Number(v).toFixed(btcTickDecimals)} BTC`}
              tick={{ fill: "var(--ct-chart-axis)", fontSize: 10 }}
            />
            {/* Right axis — USD */}
            <YAxis
              yAxisId="usd"
              orientation="right"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={52}
              domain={[0, priceMax]}
              tickCount={5}
              tickFormatter={(v) => `$${Math.round(Number(v) / 1000)}K`}
              tick={{ fill: "var(--ct-chart-axis)", fontSize: 10 }}
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />

            {/* Market price backdrop (drawn first → sits behind) */}
            <Area
              yAxisId="usd"
              dataKey="price"
              stroke="color-mix(in srgb, var(--ct-chart-neutral) 75%, transparent)"
              strokeWidth={1.25}
              fill="url(#sig-fill-price)"
              type="monotone"
              isAnimationActive={false}
              dot={false}
            />
            {/* Illustrative pace dashed line */}
            <Line
              yAxisId="btc"
              dataKey="pace"
              stroke={toneColor}
              strokeWidth={1.5}
              strokeDasharray="5 5"
              strokeOpacity={0.7}
              dot={false}
              type="monotone"
              isAnimationActive={false}
            />
            {/* Actual accumulation area */}
            <Area
              yAxisId="btc"
              dataKey="actual"
              stroke={toneColor}
              strokeWidth={2.5}
              fill={`url(#sig-fill-${tone})`}
              type="monotone"
              isAnimationActive={false}
              dot={(props) => {
                const { cx, cy, payload } = props as { cx?: number; cy?: number; payload?: { isCurrent?: boolean } };
                if (!payload?.isCurrent || cx == null || cy == null) return <g key={`${cx}-${cy}`} />;
                return (
                  <circle key="current-dot" cx={cx} cy={cy} r={4} fill={toneColor} stroke="var(--ct-bg-deep)" strokeWidth={2} />
                );
              }}
              activeDot={{ r: 5, fill: toneColor, stroke: "var(--ct-bg-deep)", strokeWidth: 2 }}
            />
          </ComposedChart>
        </ChartContainer>
      </div>

      <p className="ct-metric-caption m-0">
        Historical accumulation, illustrative pace, and market-price backdrop are illustrative — delivered in BTC at maturity, not guaranteed.
      </p>
    </Card>
  );
}

function LegendItem({ swatch, children }: { swatch: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-[var(--ct-space-2)] body-xs ct-text-muted">
      {/* Colour swatch is purely decorative — the adjacent text names the series. */}
      <span aria-hidden="true" className="inline-flex items-center">
        {swatch}
      </span>
      {children}
    </span>
  );
}
