/**
 * project — map a value series to SVG coordinates inside a given viewBox.
 *
 * Extracted verbatim from value-chart.tsx (drop-in). A single point is
 * centered; a flat series stays in the mid-band. Pure function.
 */
import type { Pt, ViewBox } from "./types";

/** Map values → SVG coords. Single point is centered; flat series stay mid-band. */
export function project(values: number[], box: ViewBox): Pt[] {
  const n = values.length;
  if (n === 0) return [];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const yLo = lo === hi ? lo - 1 : lo;
  const yHi = lo === hi ? hi + 1 : hi;
  const span = yHi - yLo || 1;
  const innerH = box.h - box.padY * 2;
  return values.map((v, i) => ({
    x: n === 1 ? box.w / 2 : (i / (n - 1)) * box.w,
    y: box.padY + innerH - ((v - yLo) / span) * innerH,
  }));
}

/**
 * Pin a flat baseline to the bottom axis (one point per item), used by the
 * zero-state skeleton so the line reads as an empty baseline rather than the
 * mid-band that {@link project} uses for a flat series.
 */
export function baseline(count: number, box: ViewBox): Pt[] {
  return Array.from({ length: count }, (_, i) => ({
    x: count === 1 ? box.w / 2 : (i / (count - 1)) * box.w,
    y: box.h - box.padY,
  }));
}
