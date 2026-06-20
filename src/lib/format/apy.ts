/** Canonical en-dash separator for APY ranges (non-negotiable #1). */
const APY_RANGE_SEP = "\u2013";

export interface FormatApyRangeOptions {
  /** Hearst Flow cockpit ticker — `9.4 – 12.8%` (spaced en-dash). */
  spaced?: boolean;
}

/**
 * Shared APY range formatter. Pure function — no server-only, no I/O.
 * Used by memo-data.ts (digits=1), investor-memo.ts (digits=2),
 * scenario-narrative.ts (digits=2), and portfolio cockpit widgets.
 */
export function formatApyRange(
  range: { low: number; high: number },
  digits = 1,
  options?: FormatApyRangeOptions,
): string {
  const [low, high] =
    range.low <= range.high ? [range.low, range.high] : [range.high, range.low];
  const sep = options?.spaced ? ` ${APY_RANGE_SEP} ` : APY_RANGE_SEP;
  return `${low.toFixed(digits)}${sep}${high.toFixed(digits)}%`;
}
