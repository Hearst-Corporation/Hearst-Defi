"use client";

/**
 * ValueTrajectory — Position Overview hero.
 *
 * One instrument, one shared time axis. LEFT of the "Today" divider: the
 * REALIZED value path (solid accent, Attested). RIGHT: a graphite PROJECTION
 * cone bounded by the note's estimated BTC accumulation range (low ↔ high),
 * midline muted-dashed — never accent, never green-as-guaranteed. The y-axis is
 * scaled to the data extent (HcFanChart convention) so the cone is legible — every tick is labelled
 * with its real value and the footer stamps assumptions + "not guaranteed", so
 * the zoom never reads as hype. A summary line states Now → Projected-at-maturity
 * as an explicit RANGE. Numbers arrive pre-computed from `projectValueTrajectory`
 * (engine, clock-injected).
 *
 * Rendered on the canonical Recharts layer (HC-CHART-001): the realized path is
 * an accent area+line, the forward cone the proven "invisible baseline + shaded
 * span" stacked-Area band (same technique as the canonical <ChartFan />), both
 * on ONE ChartContainer/AreaChart sharing a numeric time axis. No raw-SVG
 * plotting; colours are --ct-* tokens only; every Area is isAnimationActive={false}.
 */

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartContainer,
  type ChartConfig,
} from "@/components/catalyst/chart";
import {
  CHART_AREA_BOTTOM,
  CHART_AREA_TOP,
  CHART_BAND_FILL,
  CHART_BAND_STROKE,
  CHART_CURVE_COLOR,
  CHART_GRID_STROKE,
} from "@/components/catalyst/chart-series";
import type { ValueProjection } from "@/lib/engine/value-projection";

function compactUsd(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return `$${Math.round(n)}`;
}

const config: ChartConfig = {
  realizedValue: { label: "To date", color: CHART_CURVE_COLOR },
};

/** One merged sample on the shared time axis (realized keys OR cone keys). */
interface TrajectoryRow {
  at: number;
  realizedValue: number | null;
  /** Invisible stack baseline = lo edge. */
  coneBase: number | null;
  /** Shaded span = hi − lo. */
  coneSpan: number | null;
  lo: number | null;
  mid: number | null;
  hi: number | null;
}

export function ValueTrajectory({
  projection,
  nowValueLabel,
  startLabel,
  endLabel,
  "aria-label": ariaLabel,
  height = 240,
}: {
  projection: ValueProjection;
  /** Precise "now" value string for the summary (e.g. $998,010). */
  nowValueLabel: string;
  /** X-axis start label (subscription date). */
  startLabel: string;
  /** X-axis end label (maturity date / latest). */
  endLabel: string;
  "aria-label": string;
  height?: number;
}) {
  const { realized, forward, nowMs, nowValue, horizonMs, maturityLo, maturityHi, matured } =
    projection;

  const x0 = realized[0]?.at ?? nowMs;
  const x1 = matured ? (realized[realized.length - 1]?.at ?? nowMs) : horizonMs;

  // Y scaled to the data extent (not baselined at 0) so the cone reads.
  const allVals = [
    ...realized.map((p) => p.value),
    ...forward.map((p) => p.lo),
    ...forward.map((p) => p.hi),
    nowValue,
  ].filter(Number.isFinite);
  const dataMin = allVals.length ? Math.min(...allVals) : 0;
  const dataMax = allVals.length ? Math.max(...allVals) : 1;
  const range = dataMax - dataMin || Math.max(1, dataMax * 0.1);
  const yMin = Math.max(0, dataMin - range * 0.35);
  const yMax = dataMax + range * 0.25;
  const yTicks = [yMin, (yMin + yMax) / 2, yMax];

  // Merge realized + forward onto ONE numeric time axis. The realized path and
  // the forward cone live on disjoint keys, so a row carries whichever segment
  // it belongs to (both at the "now" boundary, where they meet at nowValue).
  const rowByAt = new Map<number, TrajectoryRow>();
  const rowAt = (at: number): TrajectoryRow => {
    let r = rowByAt.get(at);
    if (!r) {
      r = {
        at,
        realizedValue: null,
        coneBase: null,
        coneSpan: null,
        lo: null,
        mid: null,
        hi: null,
      };
      rowByAt.set(at, r);
    }
    return r;
  };
  for (const p of realized) rowAt(p.at).realizedValue = p.value;
  for (const p of forward) {
    const r = rowAt(p.at);
    r.lo = p.lo;
    r.mid = p.mid;
    r.hi = p.hi;
    r.coneBase = p.lo;
    r.coneSpan = Math.max(0, p.hi - p.lo);
  }
  const data = [...rowByAt.values()].sort((a, b) => a.at - b.at);

  const hasRealized = realized.length >= 2;
  const hasCone = forward.length >= 2;

  return (
    <div className="flex flex-col gap-3 p-5">
      {/* Legend */}
      <div className="flex items-center justify-between gap-3">
        <span className="ct-bento-label">Reserve trajectory</span>
        <div className="flex items-center gap-4">
          <span className="ct-metric-caption inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2 rounded-full bg-[var(--ct-accent)]" />
            To date
          </span>
          <span className="ct-metric-caption inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-2 rounded-full"
              style={{ background: "var(--ct-chart-band-stroke)" }}
            />
            Projected
          </span>
        </div>
      </div>

      <ChartContainer
        config={config}
        role="img"
        aria-label={ariaLabel}
        className="aspect-auto w-full min-w-0"
        style={{ height }}
      >
        <AreaChart data={data} margin={{ left: 4, right: 12, top: 12, bottom: 0 }}>
          <defs>
            <linearGradient id="vt-value-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_AREA_TOP} />
              <stop offset="100%" stopColor={CHART_AREA_BOTTOM} />
            </linearGradient>
          </defs>

          <CartesianGrid vertical={false} stroke={CHART_GRID_STROKE} />
          <XAxis dataKey="at" type="number" domain={[x0, x1]} hide />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={56}
            domain={[yMin, yMax]}
            ticks={yTicks}
            tickFormatter={(v) => compactUsd(Number(v))}
            tick={{ fill: "var(--ct-text-muted)", fontSize: 11 }}
          />

          {/* Forward cone — graphite band (invisible baseline + shaded span). */}
          {hasCone ? (
            <>
              <Area
                dataKey="coneBase"
                stackId="cone"
                stroke="none"
                fill="transparent"
                type="linear"
                connectNulls={false}
                isAnimationActive={false}
              />
              <Area
                dataKey="coneSpan"
                stackId="cone"
                stroke="none"
                fill={CHART_BAND_FILL}
                type="linear"
                connectNulls={false}
                isAnimationActive={false}
              />
              {/* Dashed lo / hi edges + muted-dashed midline — never accent. */}
              <Area
                dataKey="hi"
                stroke={CHART_BAND_STROKE}
                strokeWidth={1}
                strokeDasharray="4 4"
                fill="none"
                type="linear"
                connectNulls={false}
                isAnimationActive={false}
              />
              <Area
                dataKey="lo"
                stroke={CHART_BAND_STROKE}
                strokeWidth={1}
                strokeDasharray="4 4"
                fill="none"
                type="linear"
                connectNulls={false}
                isAnimationActive={false}
              />
              <Area
                dataKey="mid"
                stroke={CHART_BAND_STROKE}
                strokeWidth={1.4}
                strokeDasharray="5 4"
                fill="none"
                type="linear"
                connectNulls={false}
                isAnimationActive={false}
              />
            </>
          ) : null}

          {/* Realized — accent area + line. */}
          {hasRealized ? (
            <Area
              dataKey="realizedValue"
              stroke={CHART_CURVE_COLOR}
              strokeWidth={2.2}
              strokeLinejoin="round"
              strokeLinecap="round"
              fill="url(#vt-value-fill)"
              type="linear"
              connectNulls={false}
              isAnimationActive={false}
              dot={false}
              activeDot={false}
            />
          ) : null}

          {/* Today divider */}
          {!matured ? (
            <ReferenceLine
              x={nowMs}
              stroke="var(--ct-border)"
              strokeWidth={1}
              strokeDasharray="2 3"
            />
          ) : null}

          {/* Now endpoint dot */}
          <ReferenceDot
            x={nowMs}
            y={nowValue}
            r={4}
            fill={CHART_CURVE_COLOR}
            stroke={CHART_CURVE_COLOR}
          />
        </AreaChart>
      </ChartContainer>

      {/* X-axis date labels */}
      <div className="flex items-center justify-between">
        <span
          aria-hidden="true"
          className="text-[length:var(--ct-text-nano)]"
          style={{ color: "var(--ct-text-muted)" }}
        >
          {startLabel}
        </span>
        <span
          aria-hidden="true"
          className="text-[length:var(--ct-text-nano)]"
          style={{ color: "var(--ct-text-muted)" }}
        >
          {endLabel}
        </span>
      </div>

      {/* Summary line — Now → Projected-at-maturity (range) */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <span className="ct-metric-caption inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2 rounded-full bg-[var(--ct-accent)]" />
          Now{" "}
          <span
            style={{
              fontWeight: 700,
              color: "var(--ct-text-primary)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {nowValueLabel}
          </span>
        </span>
        {!matured && (
          <span className="ct-metric-caption inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-2 rounded-full"
              style={{ background: "var(--ct-chart-band-stroke)" }}
            />
            Projected at delivery{" "}
            <span
              style={{
                fontWeight: 700,
                color: "var(--ct-text-secondary)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {compactUsd(maturityLo)}–{compactUsd(maturityHi)}
            </span>
          </span>
        )}
      </div>

      {/* Assumptions footer */}
      <p className="ct-metric-caption">
        Projection assumes an estimated BTC accumulation range of{" "}
        {compactUsd(maturityLo)}–{compactUsd(maturityHi)} at maturity, net of fees.{" "}
        <span style={{ color: "var(--ct-text-muted)" }}>Not guaranteed.</span>
      </p>
    </div>
  );
}
