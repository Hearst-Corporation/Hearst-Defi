/**
 * Canonical BTC / sats / hashrate formatters (SSR + client must match).
 *
 * Deterministic, locale-pinned ("en-US"), no Date, no Intl compact notation,
 * no Math.random — same style as usd-compact.ts. Every function guards
 * NaN / Infinity / -0 and returns a clean "—" (or "0"-string / 0) rather than
 * emitting the literal "NaN". Numbers are tabular-safe (thousands grouped,
 * fixed decimals) so they line up in KPI columns.
 *
 * Money conversions (usdToBtc / btcToUsd) NEVER fabricate a price: the caller
 * passes both the amount AND the btcUsd rate (plus its provenance) so the UI can
 * badge any derived BTC/USD value as Estimated. btcUsd <= 0 → 0 (never NaN/∞).
 */

/** Em-dash placeholder for a value we cannot render honestly. */
const DASH = "—";

/** True for a real, finite number we can format. */
function isRenderable(n: number): boolean {
  return typeof n === "number" && Number.isFinite(n);
}

/** Normalize -0 → 0 so we never print "-0". */
function noNegZero(n: number): number {
  return n === 0 ? 0 : n;
}

/**
 * Trim trailing zeros (and a dangling decimal point) from a fixed-decimal
 * string while keeping the thousands grouping intact. "1.20000000" → "1.2",
 * "0.31000000" → "0.31", "3.00" → "3".
 */
function trimTrailingZeros(s: string): string {
  if (!s.includes(".")) return s;
  return s.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

/** Fixed-decimal, thousands-grouped, en-US. */
function grouped(value: number, dp: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });
}

export interface FormatBtcOptions {
  /** Append " BTC" to the result. */
  unit?: boolean;
  /**
   * Hard cap on decimals. When set, overrides the adaptive precision ceiling
   * (used to preserve a call-site's legacy precision during consolidation).
   */
  maxDp?: number;
}

/**
 * Adaptive-precision BTC amount.
 *   ≥ 100 BTC → 2 dp
 *   1 – 100   → 4 dp
 *   < 1       → up to 8 dp, trailing zeros trimmed
 * `maxDp` caps the ceiling. `unit` appends " BTC". Tabular-safe.
 */
export function formatBtc(btc: number, opts?: FormatBtcOptions): string {
  if (!isRenderable(btc)) return DASH;
  const value = noNegZero(btc);
  const abs = Math.abs(value);

  let dp: number;
  if (abs >= 100) dp = 2;
  else if (abs >= 1) dp = 4;
  else dp = 8;

  if (typeof opts?.maxDp === "number") {
    dp = Math.min(dp, Math.max(0, Math.trunc(opts.maxDp)));
  }

  const text = trimTrailingZeros(grouped(value, dp));
  return opts?.unit ? `${text} BTC` : text;
}

/**
 * Hero-KPI BTC amount: large holdings read as thousands-grouped + 2 dp
 * (e.g. 12,480.00), smaller amounts fall back to adaptive precision.
 */
export function formatBtcCompact(btc: number): string {
  if (!isRenderable(btc)) return DASH;
  const value = noNegZero(btc);
  if (Math.abs(value) >= 1_000) {
    return grouped(value, 2);
  }
  return formatBtc(value);
}

export interface FormatSatsOptions {
  /** Append " sats" to the result. */
  unit?: boolean;
}

/** Integer satoshis, thousands-grouped, optional " sats". */
export function formatSats(sats: number, opts?: FormatSatsOptions): string {
  if (!isRenderable(sats)) return opts?.unit ? `${DASH} sats` : DASH;
  const value = noNegZero(Math.round(sats));
  const text = value.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return opts?.unit ? `${text} sats` : text;
}

/** BTC → integer satoshis (×1e8, rounded). Non-finite → 0. */
export function btcToSats(btc: number): number {
  if (!isRenderable(btc)) return 0;
  return noNegZero(Math.round(btc * 1e8));
}

/** Satoshis → BTC (÷1e8). Non-finite → 0. */
export function satsToBtc(sats: number): number {
  if (!isRenderable(sats)) return 0;
  return noNegZero(sats / 1e8);
}

/**
 * Auto-scaled hashrate. Input is TH/s; output scales the mantissa into
 * [1, 1000) across TH/s → PH/s → EH/s with 1–2 dp.
 *   e.g. 13 000 TH/s → "13.0 PH/s".
 * Below 1 TH/s (but > 0) stays in TH/s. Non-finite / negative → "—".
 */
export function formatHashrate(hs: number): string {
  if (!isRenderable(hs) || hs < 0) return DASH;
  const value = noNegZero(hs);
  if (value === 0) return "0 TH/s";

  const units = ["TH/s", "PH/s", "EH/s"] as const;
  let mantissa = value;
  let idx = 0;
  while (mantissa >= 1000 && idx < units.length - 1) {
    mantissa /= 1000;
    idx += 1;
  }
  // 1–2 dp: two decimals under 10, one at/above 10 — keeps ~3 sig figs.
  const dp = mantissa < 10 ? 2 : 1;
  return `${mantissa.toFixed(dp)} ${units[idx]}`;
}

/**
 * Hashprice in USD per TH per day → "$X.XXX/TH·d" (3 dp).
 * Matches the construction-report / construction-steps canonical display.
 * Non-finite or ≤ 0 → "Unavailable" (honest guard, never "$0/TH·d").
 */
export function formatHashprice(usdPerThDay: number): string {
  if (!isRenderable(usdPerThDay) || usdPerThDay <= 0) return "Unavailable";
  return `$${usdPerThDay.toFixed(3)}/TH·d`;
}

/**
 * USD → BTC at an externally-supplied rate. Guards btcUsd <= 0 → 0 so the
 * result is never NaN/Infinity. Does NOT source a price — caller owns btcUsd
 * and its provenance (derived value must be badged Estimated in the UI).
 */
export function usdToBtc(usd: number, btcUsd: number): number {
  if (!isRenderable(usd) || !isRenderable(btcUsd) || btcUsd <= 0) return 0;
  return noNegZero(usd / btcUsd);
}

/**
 * BTC → USD at an externally-supplied rate. Guards btcUsd <= 0 → 0.
 * Caller owns btcUsd + provenance; derived USD must be badged Estimated.
 */
export function btcToUsd(btc: number, btcUsd: number): number {
  if (!isRenderable(btc) || !isRenderable(btcUsd) || btcUsd <= 0) return 0;
  return noNegZero(btc * btcUsd);
}
