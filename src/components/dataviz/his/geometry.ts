/**
 * Hearst Instrument System (HIS) — pure SVG geometry helpers.
 *
 * No DOM, no dependency, safe on empty arrays and compatible with
 * `noUncheckedIndexedAccess`. The `polyline` / `pathD` conventions mirror
 * `src/lib/scenario/chart-helpers.ts` so HIS and legacy charts serialize the
 * same way.
 */

import type { HcPoint } from "./types";

/**
 * Min/max of a numeric field. Returns `[0, 1]` on empty input and widens a
 * zero-width domain to `[min, min + 1]` so downstream scaling never divides
 * by zero.
 */
export function extent(values: readonly number[]): readonly [number, number] {
  if (values.length === 0) return [0, 1];
  let min = values[0]!;
  let max = values[0]!;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return min === max ? [min, min + 1] : [min, max];
}

export interface PlotBox {
  width: number;
  height: number;
  padX: number;
  padY: number;
}

/**
 * Map a data point into SVG pixel space for the given domains and plot box.
 * Y is flipped (SVG origin is top-left) so larger data values sit higher.
 */
export function project(
  p: HcPoint,
  xDomain: readonly [number, number],
  yDomain: readonly [number, number],
  box: PlotBox,
): HcPoint {
  const innerW = box.width - box.padX * 2;
  const innerH = box.height - box.padY * 2;
  const xSpan = xDomain[1] - xDomain[0] || 1;
  const ySpan = yDomain[1] - yDomain[0] || 1;
  const tx = (p.x - xDomain[0]) / xSpan;
  const ty = (p.y - yDomain[0]) / ySpan;
  return { x: box.padX + tx * innerW, y: box.padY + (1 - ty) * innerH };
}

/** Serialize points to an SVG `points` attribute: `"x,y x,y …"`. */
export function polyline(pts: readonly HcPoint[]): string {
  return pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}

/** Serialize points to an SVG path `d`: `"Mx y Lx y …"`. */
export function pathD(pts: readonly HcPoint[]): string {
  return pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
}

/**
 * Round a positive value up to a "nice" axis maximum (1 / 1.5 / 2 / 3 / 4 / 5 /
 * 6 / 8 / 10 × a power of ten). Shared so bar/line charts pick identical gridline
 * ceilings instead of each re-deriving the same table. Non-positive / non-finite
 * input → `1` (a safe unit axis for empty data).
 */
export function niceCeil(v: number): number {
  if (!Number.isFinite(v) || v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const norm = v / mag;
  const steps = [1, 1.5, 2, 3, 4, 5, 6, 8, 10];
  return (steps.find((s) => norm <= s) ?? 10) * mag;
}
