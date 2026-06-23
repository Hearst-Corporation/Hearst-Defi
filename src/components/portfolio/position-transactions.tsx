// PositionTransactions — transactions table for /portfolio/[positionId]
// Server Component.
// Shows up to 50 rows: Date · Type icon · Amount (signed) · Tx hash (BaseScan link).

import type { PositionDetailTransaction } from "@/lib/data/portfolio";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { explorerTxUrl, isPlaceholderTxHash } from "@/lib/chain/client";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";

const usdSigned = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
  hour12: false,
});

type TxType = PositionDetailTransaction["type"];

const TYPE_ICON: Record<TxType, string> = {
  deposit: "↓",
  claim: "↑",
  withdraw: "↑",
  distribution: "⊕",
};

const TYPE_LABEL: Record<TxType, string> = {
  deposit: "Deposit",
  claim: "Claim",
  withdraw: "Withdraw",
  distribution: "Distribution",
};

/** Returns true when the transaction represents money flowing in (positive). */
function isIncoming(type: TxType): boolean {
  return type === "deposit";
}

interface PositionTransactionsProps {
  transactions: PositionDetailTransaction[];
  source: "live" | "fallback";
}

/**
 * Transaction history table.
 * Filter chips are visual-only at MVP — interactivity can be added later.
 */
export function PositionTransactions({
  transactions,
  source,
}: PositionTransactionsProps) {
  const provenance = source === "live" ? "live" : "stale";

  // Filter chip categories (visual-only)
  const chips: TxType[] = ["deposit", "claim", "withdraw", "distribution"];

  return (
    <section
      aria-label="Transaction history"
      className="position-detail-transactions"
    >
      {/* Header */}
      <div className="position-detail-transactions__head">
        <span className="eyebrow ct-text-muted">
          Transaction history
        </span>
        <ProvenanceBadge kind={provenance} />
      </div>

      {/* Visual filter chips — decorative only, not interactive */}
      <div
        className="position-detail-transactions__chips"
        aria-hidden="true"
      >
        {chips.map((c) => (
          <Badge
            key={c}
            variant="default"
            className="body-xs select-none"
          >
            {TYPE_LABEL[c]}
          </Badge>
        ))}
      </div>

      {transactions.length === 0 ? (
        <p className="body-sm ct-text-muted position-detail-transactions__empty">
          No transactions recorded yet.
        </p>
      ) : (
        <div className="position-detail-transactions__scroll">
          <table className="body-sm position-detail-transactions__table">
            <thead>
              <tr className="stat-label ct-text-muted position-detail-transactions__headrow">
                <th className="position-detail-transactions__th position-detail-transactions__th--left">Date</th>
                <th className="position-detail-transactions__th position-detail-transactions__th--left">Type</th>
                <th className="position-detail-transactions__th position-detail-transactions__th--right">Amount</th>
                <th className="position-detail-transactions__th position-detail-transactions__th--right">Tx</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => {
                const incoming = isIncoming(tx.type);
                return (
                  <tr key={tx.id} className="position-detail-transactions__row">
                    {/* Date */}
                    <td className="tabular body-xs ct-text-muted mono whitespace-nowrap position-detail-transactions__cell position-detail-transactions__cell--pad">
                      {dateFmt.format(tx.occurredAt)}
                    </td>

                    {/* Type + icon */}
                    <td className="position-detail-transactions__cell position-detail-transactions__cell--pad">
                      <span className="body-xs ct-text-body pf-inline-row pf-inline-row--dense">
                        <span
                          aria-hidden="true"
                          className={incoming ? "ct-status-success body-xs" : "ct-text-muted body-xs"}
                        >
                          {TYPE_ICON[tx.type]}
                        </span>
                        {TYPE_LABEL[tx.type]}
                      </span>
                    </td>

                    {/* Amount — green for incoming (deposit), muted for outgoing */}
                    <td
                      className={cn(
                        "tabular body-md text-right mono font-semibold whitespace-nowrap position-detail-transactions__cell position-detail-transactions__cell--pad",
                        incoming ? "ct-status-success" : "ct-text-primary",
                      )}
                    >
                      {incoming ? "+" : ""}
                      {usdSigned.format(tx.amountUsdc)}
                    </td>

                    {/* Tx hash — never link a fabricated seed/demo hash (dead BaseScan). */}
                    <td className="whitespace-nowrap position-detail-transactions__cell position-detail-transactions__cell--right">
                      {tx.txHash && !isPlaceholderTxHash(tx.txHash) ? (
                        <a
                          href={explorerTxUrl(tx.txHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="tabular body-xs mono ct-text-accent-strong position-detail-transactions__tx"
                          title={tx.txHash}
                        >
                          {tx.txHash.slice(0, 6)}&hellip;{tx.txHash.slice(-4)} ↗
                        </a>
                      ) : (
                        <span className="body-xs ct-text-tertiary">
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
