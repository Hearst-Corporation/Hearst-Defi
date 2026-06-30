/**
 * Report Product — presentation-only formatters (no business math).
 * Shared by the report body and projection chart so ticks/tooltips stay aligned.
 */

import type { FanBand } from "@/components/admin/product-workspace/projection-area-chart";

/** Fan bands from the swarm pipeline are already in percent points (e.g. 9.4 = 9.4%). */
export function formatFanPercentPoint(value: number): string {
  const sign = value >= 0 ? "" : "−";
  return `${sign}${Math.abs(value).toFixed(1)}%`;
}

/** Legacy fraction series (0.094) — multiply once for display. */
export function formatFanFraction(value: number): string {
  return formatFanPercentPoint(value * 100);
}

export function formatFanValue(value: number, percentPoints: boolean): string {
  return percentPoints ? formatFanPercentPoint(value) : formatFanFraction(value);
}

/** Heuristic: pipeline fan bands sit in roughly −50..+50 % points, not fractions. */
export function fanBandsArePercentPoints(bands: readonly FanBand[]): boolean {
  if (bands.length === 0) return true;
  const vals = bands.flatMap((b) => [b.p5, b.p50, b.p95]);
  const maxAbs = Math.max(...vals.map((v) => Math.abs(v)));
  return maxAbs > 1.5;
}

export function computeFanYDomain(
  bands: readonly FanBand[],
  percentPoints: boolean,
): [number, number] {
  if (bands.length === 0) return percentPoints ? [-10, 20] : [-0.1, 0.2];
  const raw = bands.flatMap((b) => [b.p5, b.p95]);
  const lo = Math.min(...raw);
  const hi = Math.max(...raw);
  const span = hi - lo || (percentPoints ? 10 : 0.1);
  const pad = span * 0.08;
  return [lo - pad, hi + pad];
}

export function formatBtcUsd(btcUsd: number): string {
  if (!Number.isFinite(btcUsd) || btcUsd <= 0) return "Unavailable";
  return `$${Math.round(btcUsd).toLocaleString("en-US")}`;
}

/** Matches construction-report / construction-steps canonical hashprice display. */
export function formatHashpriceUsd(hashpriceUsdPerThDay: number): string {
  if (!Number.isFinite(hashpriceUsdPerThDay) || hashpriceUsdPerThDay <= 0) {
    return "Unavailable";
  }
  return `$${hashpriceUsdPerThDay.toFixed(3)}/TH·d`;
}

export function formatApyFraction(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`;
}
