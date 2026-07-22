/**
 * YTD payout accounting for the portfolio cockpit.
 *
 * ── Why this file no longer returns one number ──────────────────────────────
 *
 * It used to compute `ytdPaid + accruedPending` and return the sum. Two
 * quantities of a completely different nature were collapsed into a single
 * figure that no consumer could take apart again:
 *
 *   • `ytdPaid` — dollars that actually left the vault and landed in the
 *     investor's ledger (`InvestorTransaction` rows). Measured, auditable.
 *   • `accruedPending` — `Position.accruedYieldUsdc`, a column NO process in
 *     this codebase ever computes. It holds its `@default(0)` in production
 *     and is only ever written by demo fixtures. Series 1 is a BTC-accumulation
 *     note that pays no yield at all, so there is nothing for it to hold.
 *
 * Adding them made a real number and an uncomputed one indistinguishable, and
 * that sum was surfaced on a tax page, in an investor PDF, and in the LLM chat
 * context — where it was restated to the user in prose. A figure that cannot
 * be traced back to its parts cannot be verified by the person reading it.
 *
 * So the split is the contract now: callers receive both legs and decide what
 * to show. Nothing here adds them back together.
 */

/** Realized payouts, split from anything merely accrued. */
export interface YtdPayoutBreakdown {
  /**
   * Distributions and claims actually paid since Jan 1 UTC, summed from
   * ledger rows. A `0` here is a real measurement: no payout happened.
   */
  readonly realizedUsdc: number;
  /**
   * `Position.accruedYieldUsdc` summed across positions.
   *
   * `null` whenever the product does not accrue (Series 1) or nothing computes
   * the column — which is every production path today. It is deliberately NOT
   * `0`: zero would assert "we measured the accrual and it is nil", when the
   * truth is that no accrual is calculated at all. Kept only so a legacy
   * caller can render it under its own label, never merged into `realizedUsdc`.
   */
  readonly accruedUsdc: number | null;
}

/**
 * Sum realized YTD payouts from ledger rows.
 *
 * Takes ONLY the payout rows. The accrued leg is not a parameter, because it
 * has no business being in the same arithmetic — that was the bug.
 */
export function computeYtdRealizedUsdc(
  ytdPayoutTxs: ReadonlyArray<{ amountUsdc: number }>,
): number {
  return ytdPayoutTxs.reduce((sum, t) => {
    // A non-finite amount is a corrupt ledger row, not a zero. Skipping it
    // keeps the sum of the rows we can actually read, rather than silently
    // treating a broken row as a $0 payout.
    return Number.isFinite(t.amountUsdc) ? sum + t.amountUsdc : sum;
  }, 0);
}

/**
 * Build the breakdown a caller renders.
 *
 * `accruedPendingUsdc` is passed through only when it is a usable number AND
 * the caller says the product actually accrues. Everything else yields `null`.
 */
export function buildYtdPayoutBreakdown(
  ytdPayoutTxs: ReadonlyArray<{ amountUsdc: number }>,
  accruedPendingUsdc: number | null,
  options: { readonly productAccrues: boolean },
): YtdPayoutBreakdown {
  const accruedUsdc =
    options.productAccrues &&
    accruedPendingUsdc !== null &&
    Number.isFinite(accruedPendingUsdc)
      ? accruedPendingUsdc
      : null;

  return {
    realizedUsdc: computeYtdRealizedUsdc(ytdPayoutTxs),
    accruedUsdc,
  };
}
