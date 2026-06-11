import "server-only";

/**
 * Centralised freshness logic for data loaders.
 *
 * Background: prior to this module each upstream loader redefined its own
 * `STALE_THRESHOLD_MS` constant (btc-price = 5min, hashprice = 10min,
 * fear-greed = 60min). The thresholds are *intentionally different per
 * source* — BTC price moves second-by-second, network difficulty barely
 * moves over a day — but the *evaluation* should live in one place so the
 * audit trail is unambiguous (cf. audit `docs/audit/coherence-2026-05-26/
 * 05-provenance-badges.md` §"Freshness centralisée").
 *
 * Convention:
 *   - `STALE_THRESHOLD_MS` is the **default** SLO (5 minutes) — sources
 *     without a specific need inherit this.
 *   - Sources that legitimately tolerate a longer freshness window
 *     (network difficulty, sentiment index) declare their own value via
 *     the `STALE_THRESHOLDS` registry below and read it back here.
 *   - `evaluateFreshness(asOf, threshold)` is the single decision point.
 *     A `null`/missing `asOf` is treated as stale (no data ⇒ no claim).
 */

/** Default freshness SLO. Five minutes — matches BTC price feed cadence. */
export const STALE_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * Per-source thresholds. Add a new entry here when a loader needs a
 * different SLO; do *not* redefine `STALE_THRESHOLD_MS` locally inside a
 * loader.
 */
export const STALE_THRESHOLDS = {
  /** BTC spot price (Coingecko). Moves second-by-second. */
  btc_price: STALE_THRESHOLD_MS,
  /** Network hashprice (BTC × difficulty). Difficulty retargets ~weekly. */
  hashprice: 10 * 60 * 1000,
  /** Crypto Fear & Greed Index. Recomputed ~daily. */
  fear_greed: 60 * 60 * 1000,
  /** Portfolio / Vault snapshots. Recomputed ~daily. */
  portfolio_snapshot: 24 * 60 * 60 * 1000,
} as const;

export type FreshnessKind = "live" | "stale";

/**
 * Decides whether a timestamp is fresh enough relative to `Date.now()`.
 *
 * @param asOf      When the data was produced (null / missing ⇒ stale).
 * @param threshold Max acceptable age in ms. Defaults to `STALE_THRESHOLD_MS`.
 * @returns         `"live"` when `now - asOf <= threshold`, else `"stale"`.
 */
export function evaluateFreshness(
  asOf: Date | null | undefined,
  threshold: number = STALE_THRESHOLD_MS,
): FreshnessKind {
  if (!asOf) return "stale";
  const ageMs = Date.now() - asOf.getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0) return "stale";
  return ageMs > threshold ? "stale" : "live";
}
