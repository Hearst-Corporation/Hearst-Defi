// PositionTransactions — transactions table for /portfolio/[positionId]
// Server Component.
// Shows up to 50 rows: Date · Type icon · Amount (signed) · Tx hash (BaseScan link).

import type { PositionDetailTransaction } from "@/lib/data/portfolio";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { explorerTxUrl } from "@/lib/chain/client";

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
      className="flex flex-col gap-4 rounded-xl border border-[var(--ct-border-soft)] ct-surface-1 px-6 py-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <span className="eyebrow ct-text-muted">
          Transaction history
        </span>
        <ProvenanceBadge kind={provenance} />
      </div>

      {/* Visual filter chips — decorative only, not interactive */}
      <div
        className="flex gap-2 flex-wrap"
        aria-hidden="true"
      >
        {chips.map((c) => (
          <span
            key={c}
            className="ct-pill body-xs cursor-default select-none"
          >
            {TYPE_LABEL[c]}
          </span>
        ))}
      </div>

      {transactions.length === 0 ? (
        <p className="body-sm ct-text-muted mt-2">
          No transactions recorded yet.
        </p>
      ) : (
        <div
          className="overflow-x-auto overflow-y-hidden"
        >
          <table className="w-full min-w-max border-collapse text-[length:var(--ct-text-sm)]">
            <thead>
              <tr className="stat-label ct-text-muted border-b border-[var(--ct-border-soft)]">
                <th className="text-left pb-[var(--ct-space-2)] font-[inherit]">Date</th>
                <th className="text-left pb-[var(--ct-space-2)] font-[inherit]">Type</th>
                <th className="text-right pb-[var(--ct-space-2)] font-[inherit]">Amount</th>
                <th className="text-right pb-[var(--ct-space-2)] font-[inherit]">Tx</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => {
                const incoming = isIncoming(tx.type);
                return (
                  <tr
                    key={tx.id}
                    className="border-b border-[var(--ct-border-soft)]"
                  >
                    {/* Date */}
                    <td className="tabular body-xs ct-text-muted py-2 pr-4 mono whitespace-nowrap">
                      {dateFmt.format(tx.occurredAt)}
                    </td>

                    {/* Type + icon */}
                    <td className="py-2 pr-4">
                      <span className="body-xs ct-text-body inline-flex items-center gap-1.5">
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
                      className={`tabular body-md py-2 pr-4 text-right mono font-semibold whitespace-nowrap ${incoming ? "ct-status-success" : "ct-text-primary"}`}
                    >
                      {incoming ? "+" : ""}
                      {usdSigned.format(tx.amountUsdc)}
                    </td>

                    {/* Tx hash */}
                    <td className="py-2 text-right whitespace-nowrap">
                      {tx.txHash ? (
                        <a
                          href={explorerTxUrl(tx.txHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="tabular body-xs mono text-[var(--ct-accent-strong)] no-underline transition-opacity duration-[var(--ct-dur-fast)] hover:opacity-80"
                          title={tx.txHash}
                        >
                          {tx.txHash.slice(0, 6)}&hellip;{tx.txHash.slice(-4)} ↗
                        </a>
                      ) : (
                        <span className="body-xs ct-text-faint">
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
