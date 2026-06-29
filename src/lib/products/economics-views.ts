/**
 * economics-views.ts — two HONEST economics views, never one hidden number.
 *
 * The construction must never silently swallow a negative APY. It shows TWO
 * views side by side (doc / PROMPT §12.D):
 *
 *   1. Raw economics            — the unconstrained blended yield at the raw
 *                                 mining weight. May legitimately be negative
 *                                 (mining underwater).
 *   2. Allocator-adjusted       — the blended yield at the canonical (floor-
 *                                 enforced) mining weight + stable funding.
 *
 * A BUG CANDIDATE is flagged when the allocator-adjusted APY is negative even
 * though the stable (USDC) fallback is positive — because in that case the
 * allocator should have leaned on the stable sleeve and the adjusted number
 * should not be underwater. The flag lists the contributing factors so a human
 * can see WHERE the negative came from, rather than the UI masking it.
 *
 * PURE: no I/O, no Date.now(), no Math.random(), no server imports.
 */

export interface EconomicsView {
  /** Mining leg net yield (%). */
  miningYieldPct: number;
  /** Stable (USDC) leg yield (%). */
  usdcYieldPct: number;
  /** BTC scenario contribution proxy (%, the base scenario tilt). */
  btcContributionPct: number;
  /** Borrow drag on the stable funding (%). */
  borrowDragPct: number;
  /** Fee drag (%). */
  feePct: number;
  /** Mining weight used for this view (fraction 0..1). */
  miningWeight: number;
  /** Blended APY for this view (%). */
  blendedApyPct: number;
}

export interface EconomicsViews {
  raw: EconomicsView;
  adjusted: EconomicsView;
  /** True when adjusted APY is negative despite a positive stable fallback. */
  bugCandidate: boolean;
  /** Human-readable factors that produced the adjusted figure. */
  factors: string[];
}

export interface EconomicsInput {
  miningYieldPct: number;
  usdcYieldPct: number;
  /** Base-scenario BTC tilt (%, e.g. 40 = +40%). Contribution is a small proxy. */
  btcBaseReturnPct: number;
  borrowAprPct: number;
  feePct: number;
  /** Raw (pre-floor) mining weight, fraction 0..1. */
  rawMiningWeight: number;
  /** Canonical (floor-enforced) mining weight, fraction 0..1. */
  adjustedMiningWeight: number;
}

function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/**
 * Blended APY = miningWeight·mining + (1−miningWeight)·usdc + btcContribution
 *               − borrowDrag − fees.
 *
 * The BTC contribution is a deliberately small proxy: 5% of the base tilt,
 * reflecting that BTC sits mostly as collateral, not as a yield leg. This keeps
 * the two views comparable without over-claiming a BTC return.
 */
function blend(
  input: EconomicsInput,
  miningWeight: number,
): EconomicsView {
  const btcContributionPct = round2(input.btcBaseReturnPct * 0.05);
  const stableWeight = 1 - miningWeight;
  const blendedApyPct = round2(
    miningWeight * input.miningYieldPct +
      stableWeight * input.usdcYieldPct +
      btcContributionPct -
      input.borrowAprPct -
      input.feePct,
  );
  return {
    miningYieldPct: round2(input.miningYieldPct),
    usdcYieldPct: round2(input.usdcYieldPct),
    btcContributionPct,
    borrowDragPct: round2(input.borrowAprPct),
    feePct: round2(input.feePct),
    miningWeight: round2(miningWeight),
    blendedApyPct,
  };
}

/**
 * Build the raw + allocator-adjusted economics views and decide whether the
 * adjusted figure is a bug candidate. Pure, deterministic.
 */
export function buildEconomicsViews(input: EconomicsInput): EconomicsViews {
  const raw = blend(input, input.rawMiningWeight);
  const adjusted = blend(input, input.adjustedMiningWeight);

  const bugCandidate =
    adjusted.blendedApyPct < 0 && input.usdcYieldPct > 0;

  const factors: string[] = [
    `mining yield ${raw.miningYieldPct}% @ weight ${adjusted.miningWeight}`,
    `USDC yield ${raw.usdcYieldPct}% @ weight ${round2(1 - input.adjustedMiningWeight)}`,
    `BTC contribution ${adjusted.btcContributionPct}%`,
    `borrow drag −${adjusted.borrowDragPct}%`,
    `fees −${adjusted.feePct}%`,
  ];
  if (bugCandidate) {
    factors.push(
      "BUG CANDIDATE — adjusted APY negative despite positive stable fallback.",
    );
  }

  return { raw, adjusted, bugCandidate, factors };
}
