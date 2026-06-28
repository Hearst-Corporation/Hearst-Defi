import {
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  Receipt,
  ArrowDownRight,
  CircleDollarSign,
} from "lucide-react";

import type { PortfolioTransaction } from "@/lib/data/portfolio";
import { resolveProvenance } from "@/lib/portfolio/provenance";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { PortfolioLeafLink } from "@/components/portfolio/portfolio-leaf-link";
import { relativeTime } from "@/lib/format/time";

const usdFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const TYPE_LABELS: Record<string, string> = {
  deposit: "Deposit",
  claim: "Claim",
  withdraw: "Withdrawal",
  distribution: "Payout",
};

function TransactionIcon({ type, dir }: { type: string; dir: "in" | "out" }) {
  const className = "h-3.5 w-3.5";
  if (type === "deposit") return <Wallet className={className} />;
  if (type === "distribution") return <CircleDollarSign className={className} />;
  if (type === "withdraw") return <ArrowDownRight className={className} />;
  if (type === "claim") return <Receipt className={className} />;
  return dir === "in" ? (
    <ArrowUpRight className={className} />
  ) : (
    <ArrowDownLeft className={className} />
  );
}

function flowSign(type: string): "in" | "out" {
  return type === "withdraw" ? "out" : "in";
}

interface RecentActivityProps {
  transactions: PortfolioTransaction[];
  source: "live" | "fallback";
  updatedAt?: Date;
  leafHref?: string;
  embedded?: boolean;
}

export function RecentActivity({
  transactions,
  source,
  updatedAt,
  leafHref,
}: RecentActivityProps) {
  const displayed = transactions.slice(0, 5);
  const hasTransactions = displayed.length > 0;
  const provenance = hasTransactions
    ? resolveProvenance(source, updatedAt)
    : undefined;
  const asOf = updatedAt ?? new Date();

  return (
    <section
      className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-sm flex flex-col"
      aria-label="Recent account activity"
    >
      <header className="flex items-start justify-between gap-3 p-5 border-b border-[var(--ct-border-soft)]">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h2 className="ct-section-title">Recent activity</h2>
          <p className="ct-metric-caption">
            {hasTransactions
              ? "Last 5 transactions"
              : "Deposits, payouts, and withdrawals"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {provenance ? (
            <ProvenanceBadge kind={provenance} variant="compact" />
          ) : null}
          {leafHref ? <PortfolioLeafLink href={leafHref} /> : null}
        </div>
      </header>

      {hasTransactions ? (
        <ul role="list" className="flex flex-col p-2">
          {displayed.map((tx) => {
            const dir = flowSign(tx.type);
            return (
              <li
                key={tx.id}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_2%,transparent)]"
              >
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--ct-border-soft)] bg-[var(--ct-surface-inset)] text-[var(--ct-text-muted)]"
                >
                  <TransactionIcon type={tx.type} dir={dir} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="ct-metric-value min-w-0 truncate">
                    {TYPE_LABELS[tx.type] ?? tx.type}
                    {tx.positionVaultName ? (
                      <span className="ct-metric-caption ml-1">
                        · {tx.positionVaultName}
                      </span>
                    ) : null}
                  </span>
                  <span className="ct-metric-caption truncate">
                    {relativeTime(tx.occurredAt, asOf)}
                  </span>
                </span>
                <span
                  className={`ct-metric-value shrink-0 tabular-nums ${
                    dir === "in" ? "text-[var(--ct-accent)]" : ""
                  }`}
                >
                  {dir === "out" ? "−" : "+"}
                  {usdFmt.format(tx.amountUsdc)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
          <span className="ct-section-title">No transactions yet</span>
          <span className="ct-metric-caption max-w-xs">
            Deposits, payouts, and withdrawals appear here once activity is
            posted.
          </span>
        </div>
      )}
    </section>
  );
}
