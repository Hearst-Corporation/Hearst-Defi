/**
 * Shared SVG point-serialisation helpers for Scenario Lab charts.
 *
 * Pure display formatting — no business logic, no I/O. Extracted from the
 * three chart components (backtest-chart, monte-carlo-panel, nav-sparkline)
 * that each re-implemented the same point→string conversion.
 */

export interface Point {
  x: number;
  y: number;
}

/** SVG `polygon`/`polyline` `points` attribute: "x,y x,y …" (2-dp). */
export function ptsToPolyline(pts: Point[]): string {
  return pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}

/** SVG `path` `d` attribute: "Mx,y Lx,y …" (2-dp), first point is the move. */
export function ptsToPathD(pts: Point[]): string {
  return pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ");
}
