/**
 * Yield stack — types + pure helpers shared by CapitalYield and loaders.
 * The standalone YieldStack panel was merged into CapitalYield.
 */

export interface YieldSource {
  bucket: "mining" | "usdc_base" | "btc_tactical" | "stable_reserve";
  label: string;
  contributionPct: number;
  isVolatile?: boolean;
}

export interface YieldStackProps {
  sources: YieldSource[];
  blendedLow: number;
  blendedHigh: number;
  stressedBearRange: { low: number; high: number };
  methodologyVersion?: string;
  source?: "live" | "estimated" | "stale";
  updatedAt?: Date;
}

/** CSS custom property for each bucket's bar colour (token-only). */
export const BUCKET_COLOR: Record<YieldSource["bucket"], string> = {
  mining: "var(--ct-status-success)",
  usdc_base: "var(--ct-status-info)",
  btc_tactical: "var(--ct-status-warning)",
  stable_reserve: "var(--ct-text-neutral)",
};

/** Compute bar width as a percentage of the maximum absolute contribution. */
export function barWidthPct(
  contributionPct: number,
  maxAbsPct: number,
): number {
  if (maxAbsPct <= 0) return 0;
  return Math.min(100, (Math.abs(contributionPct) / maxAbsPct) * 100);
}

/** Format a contribution value with sign. */
export function formatContribution(
  contributionPct: number,
  isVolatile: boolean,
): string {
  const abs = Math.abs(contributionPct).toFixed(1);
  if (isVolatile) return `±${abs}%`;
  if (contributionPct < 0) return `−${abs}%`;
  return `+${abs}%`;
}
