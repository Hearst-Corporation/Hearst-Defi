/**
 * Canonical chart data types (HC-CHART-001).
 *
 * Re-homes the small set of HIS data types that data/consumer modules still
 * reference (value points, labelled values, source status) onto the Catalyst
 * chart layer. `ChartSourceStatus` is rendered by `ChartSourceBadge`.
 */

/** A value-over-time sample (NAV, accumulation…). (was HIS `HcValuePoint`.) */
export interface ChartValuePoint {
  at: Date | number | string;
  value: number;
}

/** A labelled scalar used by donuts / proportion bars. (was HIS `HcLabeledValue`.) */
export interface ChartLabeledValue {
  label: string;
  value: number;
}

/** A raw plot point. (was HIS `HcPoint`.) */
export interface ChartPoint {
  x: number;
  y: number;
}

/**
 * Source / truth status for a data series. Superset of the Catalyst
 * `Provenance` kinds kept for backward compatibility with existing callers.
 * (was HIS `HcSourceStatus`.)
 *
 * - verified : live | oracle | attested             — accent / brand tone
 * - caution  : estimated | manual | configured
 *              | fallback | stale | mixed            — muted / neutral tone
 * - nonprod  : mock | demo | unaudited               — simulated (neutral) tone
 */
export type ChartSourceStatus =
  | "live"
  | "oracle"
  | "attested"
  | "estimated"
  | "manual"
  | "configured"
  | "fallback"
  | "stale"
  | "mixed"
  | "mock"
  | "demo"
  | "unaudited";
