import type { ValueSeriesPoint } from "../value-series";

export interface PlotCoord {
  /** 0–1 horizontal position inside the drawable plot band */
  x: number;
  /** 0–1 vertical position (0 = top / max value, 1 = bottom / min value) */
  y: number;
  valueUsdc: number;
  at: Date;
  isDistribution?: boolean;
}

export interface PlotXLabel {
  x: number;
  label: string;
}

export interface PlotGeometry {
  coords: PlotCoord[];
  xLabels: PlotXLabel[];
  minValue: number;
  maxValue: number;
  isFlat: boolean;
}

function formatXLabel(date: Date, spanMs: number): string {
  if (spanMs <= 2 * 24 * 60 * 60 * 1000) {
    return new Intl.DateTimeFormat("en-US", { hour: "numeric" }).format(date);
  }
  if (spanMs <= 35 * 24 * 60 * 60 * 1000) {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
  }
  return new Intl.DateTimeFormat("en-US", { month: "short" }).format(date);
}

/**
 * Normalize a value series into stable 0–1 plot coordinates for canvas rendering.
 * Always uses smooth interpolation — no step/staircase geometry.
 */
export function buildPlotGeometry(
  seriesPoints: ValueSeriesPoint[],
  windowStart: Date,
  windowEnd: Date,
): PlotGeometry {
  if (seriesPoints.length === 0) {
    return { coords: [], xLabels: [], minValue: 0, maxValue: 0, isFlat: true };
  }

  const spanMs = Math.max(windowEnd.getTime() - windowStart.getTime(), 1);
  const values = seriesPoints.map((p) => p.valueUsdc);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const rawSpan = rawMax - rawMin;

  // Flat detection MUST use the raw span. A previous version applied a
  // `minValue + 0.01` floor to maxValue *before* this check, which forced the
  // span to ≥ 0.01 and permanently defeated the `< 0.005` threshold — the flat
  // branch became dead code and a stable NAV series was squashed to the very
  // bottom of the plot (y ≈ 0.93). "Flat" now means variation below an absolute
  // (half-cent) OR relative (0.05% of value) floor, so a stable institutional
  // NAV renders as a centred band instead of amplified sub-dollar noise.
  const flatThreshold = Math.max(0.005, rawMax * 0.0005);
  const isFlat = rawSpan < flatThreshold;

  let minValue: number;
  let maxValue: number;
  if (isFlat) {
    const centre = rawMin;
    const pad = Math.max(Math.abs(centre) * 0.02, 0.5);
    // Flat / stable series: seat the line in the upper third (more room below it)
    // so the area fill reads as a full, healthy balance instead of a thin line
    // stranded in an empty plot. Asymmetric band = ~30% from the top.
    minValue = Math.max(0, centre - pad * 2.3);
    maxValue = centre + pad;
  } else {
    const pad = rawSpan * 0.08;
    minValue = Math.max(0, rawMin - pad);
    maxValue = rawMax + pad;
  }

  const valueSpan = maxValue - minValue || 1;

  const coords: PlotCoord[] = seriesPoints.map((p) => {
    const x = (p.at.getTime() - windowStart.getTime()) / spanMs;
    const y = 1 - (p.valueUsdc - minValue) / valueSpan;
    return {
      x: Math.min(1, Math.max(0, x)),
      y: Math.min(1, Math.max(0, y)),
      valueUsdc: p.valueUsdc,
      at: p.at,
      isDistribution: p.isDistribution,
    };
  });

  const tickCount = 4;
  const xLabels: PlotXLabel[] = Array.from({ length: tickCount }, (_, i) => {
    const frac = i / (tickCount - 1);
    const at = new Date(windowStart.getTime() + frac * spanMs);
    return { x: frac, label: formatXLabel(at, spanMs) };
  });

  return { coords, xLabels, minValue, maxValue, isFlat };
}

/** Pad single-point series so the plot always has a readable flat band. */
export function ensureMinimumPlotPoints(
  points: ValueSeriesPoint[],
  windowStart: Date,
  windowEnd: Date,
): ValueSeriesPoint[] {
  if (points.length >= 2) return points;
  if (points.length === 0) return points;
  const anchor = points[0]!;
  return [
    { ...anchor, at: windowStart },
    { ...anchor, at: windowEnd },
  ];
}
