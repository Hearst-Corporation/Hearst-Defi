import type { PortfolioTransaction } from "@/lib/data/portfolio";

import { ProvenanceBadge } from "./provenance-badge";

const usdFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const TYPE_LABELS: Record<string, string> = {
  deposit: "Deposit",
  claim: "Claim",
  withdraw: "Withdrawal",
  distribution: "Distribution",
};

function relativeTime(date: Date, asOf: Date): string {
  const diffMs = asOf.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 1) return "today";
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 30) return `${diffDays} days ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return "1 month ago";
  return `${diffMonths} months ago`;
}

function TxIcon({ type }: { type: string }) {
  const colorClass =
    type === "deposit"
      ? "bg-[var(--ct-accent)]"
      : type === "distribution"
        ? "bg-[var(--ct-accent-strong)]"
        : type === "withdraw"
          ? "bg-[var(--ct-status-danger)]"
          : "bg-[var(--ct-text-muted)]";

  return (
    <span
      aria-hidden="true"
      className={`inline-block w-3 h-3 rounded-xs shrink-0 ${colorClass}`}
    />
  );
}

interface RecentActivityProps {
  transactions: PortfolioTransaction[];
  source: "live" | "fallback";
}

export function RecentActivity({ transactions, source }: RecentActivityProps) {
  const provenance = source === "fallback" ? "stale" : "live";
  const asOf = new Date("2026-05-20T09:00:00Z");
  const displayed = transactions.slice(0, 5);

  return (
    <article 
      className="dash-cell dash-cell-premium flex flex-col h-full overflow-hidden" 
      aria-label="Recent account activity"
    >
      <div className="flex justify-between items-center stat-label mb-6 shrink-0 relative z-10">
        <span>Recent Activity</span>
        <ProvenanceBadge kind={provenance} />
      </div>

      <div className="overflow-y-auto flex-1 pr-2 -mr-2 relative z-10">
        {displayed.length === 0 ? (
          <p className="body-sm text-[var(--ct-text-muted)] mt-2 italic">No transactions yet.</p>
        ) : (
          <div className="flex flex-col gap-0.5 mt-1">
            {displayed.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center gap-3 py-2 border-b border-[var(--ct-border-soft)] last:border-0 hover:bg-[var(--ct-surface-2)] -mx-2 px-2 rounded-sm transition-colors"
              >
                <TxIcon type={tx.type} />

                <div className="flex-1 min-w-0 overflow-hidden">
                  <div className="body-sm text-[var(--ct-text-primary)] font-medium truncate">
                    {TYPE_LABELS[tx.type] ?? tx.type}
                    {tx.positionVaultName && (
                      <span className="text-[var(--ct-text-muted)] font-normal">
                        {" "}· {tx.positionVaultName}
                      </span>
                    )}
                  </div>
                  <div className="body-xs text-[var(--ct-text-muted)] mt-0.5 mono truncate uppercase tracking-wider">
                    {relativeTime(tx.occurredAt, asOf)}
                  </div>
                </div>

                <span className="tabular-nums body-sm text-[var(--ct-text-strong)] mono font-medium shrink-0">
                  {usdFmt.format(tx.amountUsdc)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
