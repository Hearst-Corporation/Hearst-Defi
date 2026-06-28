/**
 * Hearst Instrument System (HIS) — shared data-viz types.
 *
 * Pure type layer for the P0 visual primitives (HC-9268). No runtime logic
 * beyond two readonly status sets used to enforce the honesty invariant:
 * non-production data (mock / demo / unaudited) is never styled as verified.
 */

/**
 * Source / truth status for any data series surfaced by a HIS primitive.
 *
 * - verified  : `live` | `oracle` | `attested`            — accent tone
 * - caution   : `estimated` | `manual` | `configured`
 *               | `fallback` | `stale` | `mixed`          — muted/neutral tone
 * - nonprod   : `mock` | `demo` | `unaudited`             — warning tone (explicit)
 */
export type HcSourceStatus =
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

export interface HcPoint {
  x: number;
  y: number;
}

export interface HcSeries {
  id: string;
  label: string;
  points: readonly HcPoint[];
}

export interface HcLabeledValue {
  label: string;
  value: number;
}

/** Provenance sources accepted by an assumption ledger row (display only). */
export type HcAssumptionSource =
  | "live"
  | "attested"
  | "estimated"
  | "manual"
  | "configured";

export interface HcAssumption {
  key: string;
  /** Already formatted server-side — never recomputed inside a primitive. */
  value: string;
  source: HcAssumptionSource;
  /** Optional display rule, e.g. "shown as range, never single point". */
  displayRule?: string;
}

/** Statuses that are allowed to read as "verified" (accent tone). */
export const HC_VERIFIED: ReadonlySet<HcSourceStatus> = new Set<HcSourceStatus>([
  "live",
  "oracle",
  "attested",
]);

/** Statuses that must read as non-production (warning tone), never as live. */
export const HC_NON_PRODUCTION: ReadonlySet<HcSourceStatus> =
  new Set<HcSourceStatus>(["mock", "demo", "unaudited"]);
