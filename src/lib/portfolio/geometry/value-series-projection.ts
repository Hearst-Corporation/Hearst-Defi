import {
  buildPortfolioValueSeries,
  type ValueSeriesPoint,
  type ValueSeriesTx,
} from "../value-series";
import { PAD_X, PAD_Y_TOP, DRAW_W, DRAW_H, CHART_BASELINE_Y } from "./svgConstants";

export interface ChartPoint {
  x: number;
  y: number;
  value: number;
  date: Date;
  isDistribution?: boolean;
  source?: ValueSeriesPoint["source"];
}

export interface ChartAxisTick {
  x: number;
  label: string;
}

export interface ChartValueTick {
  y: number;
  label: string;
  value: number;
}

export interface ChartProjection {
  points: ChartPoint[];
  xTicks: ChartAxisTick[];
  yTicks: ChartValueTick[];
  isFlat: boolean;
}

function formatValueTick(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${Math.round(value / 1_000)}k`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toFixed(value < 100 ? 2 : 0);
}

function formatXTick(date: Date, spanMs: number): string {
  if (spanMs <= 2 * 24 * 60 * 60 * 1000) {
    return new Intl.DateTimeFormat("en-US", { hour: "numeric" }).format(date);
  }
  if (spanMs <= 35 * 24 * 60 * 60 * 1000) {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
  }
  return new Intl.DateTimeFormat("en-US", { month: "short" }).format(date);
}

/**
 * Project a built value series into SVG coordinates with axis ticks.
 */
export function projectChartSeries(
  seriesPoints: ValueSeriesPoint[],
  windowStart: Date,
  windowEnd: Date,
): ChartProjection {
  if (seriesPoints.length === 0) {
    return { points: [], xTicks: [], yTicks: [], isFlat: true };
  }

  const totalDuration = Math.max(windowEnd.getTime() - windowStart.getTime(), 1);

  const values = seriesPoints.map((p) => p.valueUsdc);
  let minVal = Math.min(...values);
  let maxVal = Math.max(...values, minVal + 0.01);

  const isFlat = maxVal - minVal < 0.005;
  if (isFlat) {
    const centre = minVal;
    const pad = Math.max(centre * 0.02, 0.5);
    minVal = centre - pad;
    maxVal = centre + pad;
  } else {
    const pad = (maxVal - minVal) * 0.05;
    minVal -= pad;
    maxVal += pad;
  }

  const valSpan = maxVal - minVal || 1;

  const points: ChartPoint[] = seriesPoints.map((p) => {
    const timeFrac = (p.at.getTime() - windowStart.getTime()) / totalDuration;
    const valFrac = (p.valueUsdc - minVal) / valSpan;

    return {
      x: PAD_X + timeFrac * DRAW_W,
      y: PAD_Y_TOP + DRAW_H - valFrac * DRAW_H,
      value: p.valueUsdc,
      date: p.at,
      isDistribution: p.isDistribution,
      source: p.source,
    };
  });

  const xTickCount = 5;
  const xTicks: ChartAxisTick[] = Array.from({ length: xTickCount }, (_, i) => {
    const frac = i / (xTickCount - 1);
    const at = new Date(windowStart.getTime() + frac * totalDuration);
    return {
      x: PAD_X + frac * DRAW_W,
      label: formatXTick(at, totalDuration),
    };
  });

  const yFracs = [0, 1];
  const yTicks: ChartValueTick[] = yFracs.map((frac) => {
    const value = minVal + (1 - frac) * valSpan;
    const y = PAD_Y_TOP + frac * DRAW_H;
    return { y, label: formatValueTick(value), value };
  });

  return { points, xTicks, yTicks, isFlat };
}

/**
 * @deprecated Use buildPortfolioValueSeries + projectChartSeries.
 * Kept as thin alias for existing tests during squad migration.
 */
export function projectValueSeries(
  transactions: ValueSeriesTx[],
  totalValueUsdc: number,
  now: Date = new Date(),
): ChartPoint[] {
  const built = buildPortfolioValueSeries({
    transactions,
    totalValueUsdc,
    now,
    range: "all",
  });
  return projectChartSeries(built.points, built.windowStart, built.windowEnd).points;
}

export interface PathOptions {
  /** Step-after interpolation for ledger event anchors (avoids diagonal artifacts). */
  step?: boolean;
}

function buildPolyline(points: ChartPoint[], step: boolean): string {
  if (points.length < 2) return "";

  const first = points[0]!;
  let d = `M${first.x.toFixed(2)},${first.y.toFixed(2)}`;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    if (step) {
      d += ` L${curr.x.toFixed(2)},${prev.y.toFixed(2)} L${curr.x.toFixed(2)},${curr.y.toFixed(2)}`;
    } else {
      d += ` L${curr.x.toFixed(2)},${curr.y.toFixed(2)}`;
    }
  }

  return d;
}

export function generateAreaPath(points: ChartPoint[], options?: PathOptions): string {
  if (points.length < 2) return "";

  const line = buildPolyline(points, options?.step ?? false);
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const baseline = CHART_BASELINE_Y;

  return `${line} L${last.x.toFixed(2)},${baseline.toFixed(2)} L${first.x.toFixed(2)},${baseline.toFixed(2)} Z`;
}

export function generateLinePath(points: ChartPoint[], options?: PathOptions): string {
  if (points.length < 2) return "";
  return buildPolyline(points, options?.step ?? false);
}
