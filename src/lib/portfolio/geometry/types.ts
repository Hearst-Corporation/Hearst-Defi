/**
 * Portfolio chart geometry — shared pure math for SVG line/area/bar charts.
 *
 * Pure functions only: no React, no DOM, no I/O. The viewBox dimensions are
 * INJECTED (not module constants) so the same helpers serve charts with
 * different coordinate systems — value-chart (200×62) and distrib-calendar
 * (560×180) — without any of them hardcoding the other's box.
 *
 * "svg-geometry": viewBox coordinate values are the documented escape hatch
 * from the --ct-* token rule (they are a coordinate system, not CSS spacing).
 */

/** A point in viewBox coordinate space. */
export interface Pt {
  x: number;
  y: number;
}

/** A line/area chart's viewBox box + vertical padding. */
export interface ViewBox {
  /** viewBox width (coordinate units). */
  w: number;
  /** viewBox height (coordinate units). */
  h: number;
  /** Vertical inset kept clear at top and bottom (coordinate units). */
  padY: number;
}
