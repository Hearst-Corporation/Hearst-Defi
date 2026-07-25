"use client";

/**
 * StrategyStudioChart — THE single Studio visualization.
 *
 * Multi-series line chart (one line per scenario, same axes) with an optional
 * p5–p95 confidence band for the active scenario and optional horizontal
 * reference lines (e.g. delever trigger / liquidation LTV). Rebuilt on the
 * canonical Recharts chart layer (HC-CHART-001) — the retired bespoke pure-SVG
 * engine (viewBox 1000×320, preserveAspectRatio="none") is gone. Colours resolve
 * to `--ct-*` tokens only; a scenario colour that is not already a token maps to
 * the sanctioned categorical ramp. Fewer than two months is NOT a trend → an
 * honest empty surface, never a fabricated line.
 */

import {
  Area,
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/catalyst/chart";
import { chartColorAt } from "@/components/catalyst/chart-series";

export interface StudioChartPoint {
  m: number;
  v: number;
}

export interface StudioChartSeries {
  key: string;
  label: string;
  color: string;
  points: readonly StudioChartPoint[];
  /** Active scenario — drawn thicker, full opacity. */
  active?: boolean;
}

export interface StudioChartBandPoint {
  m: number;
  lo: number;
  hi: number;
}

export interface StudioChartRefLine {
  value: number;
  label: string;
  /** danger = hard limit (liquidation); warning = policy trigger (delever/cap). */
  tone: "danger" | "warning";
}

export interface StrategyStudioChartProps {
  series: readonly StudioChartSeries[];
  /** Confidence band (p5–p95) behind the lines — active scenario only. */
  band?: readonly StudioChartBandPoint[];
  /** Formats a y-axis tick value (already in display units). */
  format: (v: number) => string;
  /** Horizontal reference lines, e.g. delever LTV / buy-back cap / liquidation. */
  refLines?: readonly StudioChartRefLine[];
  "aria-label": string;
}

/**
 * Frame the y-axis on the data range with 4% headroom (never baselined at 0) so
 * lines never kiss the frame and a tight high-base band keeps its amplitude.
 * Kept from the retired SVG engine so the axis framing is unchanged; unlike the
 * canonical `valueYDomain` it does NOT clamp at 0, so metrics that can go
 * negative (drawdown) stay honest.
 */
function extent(values: readonly number[]): readonly [number, number] {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min === max) return [min - 1, max + 1];
  const pad = (max - min) * 0.04;
  return [min - pad, max + pad];
}

/** Use the scenario colour as-is when it is already a `--ct-*` token; else map to the sanctioned categorical ramp. */
function resolveSeriesColor(color: string, index: number): string {
  return color.startsWith("var(--ct-") ? color : chartColorAt("categorical", index);
}

type ChartRow = {
  m: number;
  bandLow?: number;
  bandSpan?: number;
} & Record<string, number | undefined>;

export function StrategyStudioChart({
  series,
  band,
  format,
  refLines,
  ...rest
}: StrategyStudioChartProps) {
  const ariaLabel = rest["aria-label"];

  const months = series[0]?.points.map((p) => p.m) ?? [];

  if (series.length === 0 || months.length < 2) {
    return (
      <div
        role="img"
        aria-label={ariaLabel}
        data-hc-empty="true"
        className="h-full w-full"
        style={{
          borderRadius: "var(--ct-radius-md)",
          border: "1px dashed var(--ct-border)",
        }}
      />
    );
  }

  // Resolve each candidate's colour from its ORIGINAL index (stable regardless
  // of the later draw-order sort).
  const resolved = series.map((s, i) => ({
    ...s,
    resolvedColor: resolveSeriesColor(s.color, i),
  }));

  // Merge every series (+ the optional band) into one month-keyed row set.
  const rowByMonth = new Map<number, ChartRow>();
  const ensureRow = (m: number): ChartRow => {
    let row = rowByMonth.get(m);
    if (!row) {
      row = { m };
      rowByMonth.set(m, row);
    }
    return row;
  };
  for (const s of resolved) {
    for (const p of s.points) ensureRow(p.m)[s.key] = p.v;
  }
  if (band) {
    for (const b of band) {
      const row = ensureRow(b.m);
      row.bandLow = b.lo;
      row.bandSpan = Math.max(0, b.hi - b.lo);
    }
  }
  const data = [...rowByMonth.values()].sort((a, b) => a.m - b.m);
  const hasBand = Boolean(band && band.length >= 2);

  const allValues: number[] = [];
  for (const s of series) for (const p of s.points) allValues.push(p.v);
  if (band) for (const b of band) allValues.push(b.lo, b.hi);
  if (refLines) for (const r of refLines) allValues.push(r.value);
  const yDomain = extent(allValues);

  const config: ChartConfig = Object.fromEntries(
    resolved.map((s) => [s.key, { label: s.label, color: s.resolvedColor }]),
  );

  // Active scenario drawn last (on top of the others).
  const drawOrder = [...resolved].sort(
    (a, b) => Number(a.active ?? false) - Number(b.active ?? false),
  );

  return (
    <ChartContainer
      config={config}
      aria-label={ariaLabel}
      className="aspect-auto h-full w-full min-w-0"
    >
      <ComposedChart data={data} margin={{ left: 4, right: 12, top: 14, bottom: 4 }}>
        <defs>
          <linearGradient id="fillStudioBand" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--ct-status-info)" stopOpacity={0.18} />
            <stop offset="95%" stopColor="var(--ct-status-info)" stopOpacity={0.04} />
          </linearGradient>
        </defs>

        <CartesianGrid vertical={false} stroke="var(--ct-border-soft)" strokeDasharray="2 5" />

        <XAxis
          dataKey="m"
          type="number"
          domain={["dataMin", "dataMax"]}
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tickFormatter={(m) => `M${m}`}
          tick={{ fill: "var(--ct-text-muted)", fontSize: 10 }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={52}
          domain={yDomain}
          tickCount={3}
          tickFormatter={(v) => format(Number(v))}
          tick={{ fill: "var(--ct-text-muted)", fontSize: 10 }}
        />

        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent labelFormatter={(m) => `Month ${m}`} />}
        />

        {/* p5–p95 band — invisible baseline + shaded span, behind the lines. */}
        {hasBand ? (
          <>
            <Area
              dataKey="bandLow"
              stackId="band"
              stroke="none"
              fill="transparent"
              connectNulls
              isAnimationActive={false}
              tooltipType="none"
            />
            <Area
              dataKey="bandSpan"
              stackId="band"
              stroke="none"
              fill="url(#fillStudioBand)"
              connectNulls
              isAnimationActive={false}
              tooltipType="none"
            />
          </>
        ) : null}

        {/* Reference lines (delever trigger / buy-back cap / hard liquidation). */}
        {(refLines ?? []).map((r) => {
          const stroke =
            r.tone === "danger" ? "var(--ct-status-danger)" : "var(--ct-status-warning)";
          return (
            <ReferenceLine
              key={`${r.label}-${r.value}`}
              y={r.value}
              stroke={stroke}
              strokeWidth={1}
              strokeDasharray="5 4"
              label={{
                value: r.label,
                position: "insideTopRight",
                fill: stroke,
                fontSize: 10,
              }}
            />
          );
        })}

        {/* Scenario lines — active drawn last (on top), thicker + full opacity. */}
        {drawOrder.map((s) => (
          <Line
            key={s.key}
            dataKey={s.key}
            name={s.label}
            type="linear"
            stroke={s.resolvedColor}
            strokeWidth={s.active ? 2.4 : 1.4}
            strokeOpacity={s.active ? 1 : 0.75}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls
            isAnimationActive={false}
          />
        ))}
      </ComposedChart>
    </ChartContainer>
  );
}
