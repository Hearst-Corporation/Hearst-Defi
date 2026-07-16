// src/app/(product)/btc/_data/btc-ledger-rows.ts
//
// P2.4 — the FULL ledger register's view-model fold, extracted into its own
// module so it stays independent of `get-btc-page-data.ts` (whose data-source
// wiring is a separate, concurrently-evolving seam). Pure function, no I/O.

import type { BtcEventViewModel } from "./btc-page-types";

/** One row of the FULL ledger register (/btc/ledger drill-down): the raw
 *  event plus its pre-computed running balance. The fold lives HERE, in the
 *  view-model layer — the table component only formats (P2.4). */
export interface BtcLedgerRowViewModel extends BtcEventViewModel {
  /** Vault BTC balance (sats, decimal string) AFTER this movement settled.
   *  `null` for attestation rows (no balance change) and for every row when
   *  no closing-balance anchor is available — "—" honest, never fabricated. */
  readonly balanceAfterSats: string | null;
}

/**
 * Fold the signed deltas into a per-row running balance, anchored on the
 * vault reserve's CLOSING balance (the most recent attested figure) and
 * walked backwards through the register. Pure function, newest-first output
 * (register convention — same ordering the table renders).
 *
 * No anchor (`closingBalanceSats` null / non-finite) → every `balanceAfterSats`
 * is `null`: the column renders "—" instead of a balance folded from a
 * fabricated zero base.
 */
export function buildBtcLedgerRows(
  events: readonly BtcEventViewModel[],
  closingBalanceSats: string | null,
): readonly BtcLedgerRowViewModel[] {
  // Newest first; Array.prototype.sort is stable, so same-day rows keep
  // their source order (settlement before its same-day attestation).
  const sorted = [...events].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  const closing = closingBalanceSats != null ? Number(closingBalanceSats) : null;
  if (closing == null || !Number.isFinite(closing)) {
    return sorted.map((ev) => ({ ...ev, balanceAfterSats: null }));
  }

  let running = closing;
  return sorted.map((ev) => {
    if (ev.deltaSats == null) {
      // Attestations never move the balance — no figure to show.
      return { ...ev, balanceAfterSats: null };
    }
    const delta = Number(ev.deltaSats);
    const balanceAfter = running;
    running -= Number.isFinite(delta) ? delta : 0;
    return { ...ev, balanceAfterSats: String(balanceAfter) };
  });
}
