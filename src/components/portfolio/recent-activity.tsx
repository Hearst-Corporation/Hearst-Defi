import {
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  Receipt,
  ArrowDownRight,
  CircleDollarSign,
} from "lucide-react";

import Link from "next/link";

import type { PortfolioTransaction } from "@/lib/data/portfolio";
import { resolveProvenance } from "@/lib/portfolio/provenance";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
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
      className="rounded-2xl border border-[var(--ct-border)] bg-surface-card flex flex-col overflow-hidden"
      style={{ boxShadow: "var(--ct-shadow-soft), inset 0 1px 0 rgba(255, 255, 255, 0.04)" }}
      aria-label="Recent account activity"
    >
      <header className="flex items-start justify-between gap-4 p-5 border-b border-[var(--ct-border-soft)]">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h2 className="ct-section-title">Recent activity</h2>
          <p className="ct-metric-caption">
            {hasTransactions
              ? "Last 5 transactions"
              : "Deposits, payouts, and withdrawals"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {provenance ? (
            <ProvenanceBadge kind={provenance} variant="compact" />
          ) : null}
          {leafHref ? (
            <Link
              href={leafHref}
              className="ct-bento-label group inline-flex shrink-0 items-center gap-1 transition-colors hover:text-[var(--ct-accent)]"
            >
              See more <span aria-hidden="true" className="transition-transform ease-out group-hover:translate-x-0.5">→</span>
            </Link>
          ) : null}
        </div>
      </header>

      {hasTransactions ? (
        <ul role="list" className="flex flex-col p-2">
          {displayed.map((tx) => {
            const dir = flowSign(tx.type);
            return (
              <li
                key={tx.id}
                className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all hover:bg-[radial-gradient(circle_at_20%_50%,rgba(255,255,255,0.06)_0%,transparent_70%)]"
              >
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--ct-border-soft)] bg-[var(--ct-surface-inset)] text-[var(--ct-text-muted)] transition-all duration-300 group-hover:scale-110 group-hover:text-[var(--ct-text-primary)] group-hover:border-[var(--ct-border)]"
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
