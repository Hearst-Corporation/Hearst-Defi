/**
 * YTD yield for the portfolio cockpit.
 *
 * Realized YTD = distributions + claims paid since Jan 1 UTC.
 * Pending = accrued yield not yet distributed (Position.accruedYieldUsdc).
 *
 * These buckets must not overlap: after a distribution, accrued should be
 * reset so the same dollars are not counted in both sums.
 */

export function computeYtdYieldUsdc(
  ytdPayoutTxs: ReadonlyArray<{ amountUsdc: number }>,
  accruedPendingUsdc: number,
): number {
  const ytdPaid = ytdPayoutTxs.reduce((sum, t) => sum + t.amountUsdc, 0);
  const pending = Number.isFinite(accruedPendingUsdc) ? accruedPendingUsdc : 0;
  return ytdPaid + Math.max(0, pending);
}
