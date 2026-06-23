/**
 * bars — histogram bar geometry for the distribution calendar.
 *
 * Extracted verbatim from distrib-calendar.tsx (drop-in). Pure functions:
 * given a viewBox width + bar/gap widths, compute each bar's left edge and a
 * normalised height. No React, no DOM.
 */

/** Compute x-position of a bar's left edge (0-indexed), centered in the box. */
export function barX(
  index: number,
  total: number,
  barW: number,
  gapW: number,
  boxW: number,
): number {
  const totalUsed = total * barW + (total - 1) * gapW;
  const offset = (boxW - totalUsed) / 2;
  return offset + index * (barW + gapW);
}

/**
 * Compute a bar height normalised to the available bar area. Returns 0 for an
 * empty series; clamps to a 4-unit minimum so even tiny amounts stay visible.
 */
export function barHeight(amount: number, maxAmount: number, barAreaH: number): number {
  if (maxAmount === 0) return 0;
  return Math.max(4, (amount / maxAmount) * barAreaH);
}
