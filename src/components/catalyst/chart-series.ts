/**
 * Canonical chart series colours + tokens (HC-CHART-001).
 *
 * The single source for the two sanctioned chart colour modes, ported from the
 * retired HIS ramps so migrated charts keep identical colours. Every value is a
 * `--ct-*` token reference — never a raw hex — so the single-green law and the
 * DS token contract hold.
 *
 *  - `accent`      — single-green luminance ramp (`--ct-chart-series-1..4`, then
 *                    neutral). Encodes by LUMINANCE; use when segments are tiers
 *                    of the SAME thing (yield-stack buckets, capacity mix).
 *  - `categorical` — distinguishable per-class hues via the sanctioned semantic
 *                    palette (`--ct-cat-*`, each an alias of an existing status
 *                    token — no new hex). Use for DIFFERENT asset classes
 *                    (order mining → usdc → btc → hedge).
 */

export type ChartPalette = "accent" | "categorical";

/** Single-green luminance ramp (tiers of the same thing). */
export const CHART_ACCENT_RAMP: readonly string[] = [
  "var(--ct-chart-series-1)",
  "var(--ct-chart-series-2)",
  "var(--ct-chart-series-3)",
  "var(--ct-chart-series-4)",
  "var(--ct-chart-neutral)",
];

/** Per-class semantic hues (distinct asset classes). Order: mining→usdc→btc→hedge. */
export const CHART_CATEGORICAL_RAMP: readonly string[] = [
  "var(--ct-cat-mining)",
  "var(--ct-cat-usdc)",
  "var(--ct-cat-btc)",
  "var(--ct-cat-hedge)",
  "var(--ct-chart-neutral)",
];

/** The ramp for a palette mode. */
export function chartRamp(palette: ChartPalette): readonly string[] {
  return palette === "categorical" ? CHART_CATEGORICAL_RAMP : CHART_ACCENT_RAMP;
}

/** Colour for the i-th segment (wraps the ramp). */
export function chartColorAt(palette: ChartPalette, index: number): string {
  const ramp = chartRamp(palette);
  return ramp[index % ramp.length]!;
}

// ── Shared single-series tokens (line / area / band / grid) ─────────────────────
/** Accent curve colour for value / accumulation lines. */
export const CHART_CURVE_COLOR = "var(--ct-chart-curve-color)";
/** Area wash gradient stops (top strong → bottom transparent). */
export const CHART_AREA_TOP = "var(--ct-chart-area-top)";
export const CHART_AREA_BOTTOM = "var(--ct-chart-area-bottom)";
/** Projection fan band — info-tinted, NEVER accent (a band is not a promise). */
export const CHART_BAND_FILL = "var(--ct-chart-band-fill)";
export const CHART_BAND_STROKE = "var(--ct-chart-band-stroke)";
/** Cartesian gridline stroke. */
export const CHART_GRID_STROKE = "var(--ct-chart-grid-stroke)";
/** Neutral "other / idle" segment. */
export const CHART_NEUTRAL = "var(--ct-chart-neutral)";
