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

/** CSS custom property for each bucket's bar colour (monochrome green scale). */
export const BUCKET_COLOR: Record<YieldSource["bucket"], string> = {
  mining: "var(--ct-bucket-mining)",
  usdc_base: "var(--ct-bucket-usdc)",
  btc_tactical: "var(--ct-bucket-btc)",
  stable_reserve: "var(--ct-bucket-reserve)",
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
