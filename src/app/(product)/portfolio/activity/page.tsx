import "../portfolio.css";

import { loadPortfolioView } from "@/lib/data/portfolio-view";
import { PortfolioLeafShell } from "@/components/portfolio/portfolio-leaf-shell";
import { TrustProofCompact } from "@/components/portfolio/trust-panel";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { formatUsdCompact } from "@/lib/vaults/product-display";
import { resolveProvenance } from "@/lib/portfolio/provenance";
import { cn } from "@/lib/cn";
import Link from "next/link";
import {
  ArrowLeft,
  Wallet,
  CircleDollarSign,
  ArrowDownRight,
  Receipt,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";
import type { PortfolioTransaction } from "@/lib/data/portfolio";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Activity",
  description: "Your full transaction history",
};

const usdFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const timeFmt = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
  hour12: true,
});

const TYPE_LABELS: Record<string, string> = {
  deposit: "Deposit",
  claim: "Claim",
  withdraw: "Withdrawal",
  distribution: "Payout",
};

function TxIcon({ type, dir }: { type: string; dir: "in" | "out" }) {
  const cls = "pf-leaf-tx-icon__svg";
  if (type === "deposit") return <Wallet className={cls} />;
  if (type === "distribution") return <CircleDollarSign className={cls} />;
  if (type === "withdraw") return <ArrowDownRight className={cls} />;
  if (type === "claim") return <Receipt className={cls} />;
  return dir === "in" ? <ArrowUpRight className={cls} /> : <ArrowDownLeft className={cls} />;
}

function flowSign(type: string): "in" | "out" {
  return type === "withdraw" ? "out" : "in";
}

/** Group transactions by calendar date (UTC). Returns sorted descending. */
function groupByDate(txs: PortfolioTransaction[]): { dateKey: string; date: Date; txs: PortfolioTransaction[] }[] {
  const map = new Map<string, { date: Date; txs: PortfolioTransaction[] }>();
  for (const tx of txs) {
    const d = tx.occurredAt;
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    if (!map.has(key)) {
      map.set(key, { date: d, txs: [] });
    }
    map.get(key)!.txs.push(tx);
  }
  return Array.from(map.entries())
    .map(([k, v]) => ({ dateKey: k, ...v }))
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}

export default async function ActivityPage() {
  const { data, riskPulseProps, proofPulseProps, hasPositions } = await loadPortfolioView();
  const { recentTransactions: transactions, source, updatedAt } = data;

  const hasTransactions = transactions.length > 0;
  const provenance = hasTransactions ? resolveProvenance(source, updatedAt) : undefined;
  const grouped = groupByDate(transactions);

  // Aggregate stats
  const deposits = transactions.filter((t) => t.type === "deposit");
  const payouts = transactions.filter((t) => t.type === "distribution");
  const totalDeposited = deposits.reduce((s, t) => s + t.amountUsdc, 0);
  const totalReceived = payouts.reduce((s, t) => s + t.amountUsdc, 0);

  return (
    <PortfolioLeafShell testId="portfolio-activity-page">
      <div className="pf-leaf-page">
        {/* ── Back nav ── */}
        <div className="pf-leaf-back-nav">
          <Link href="/portfolio" className="pf-leaf-back-link">
            <ArrowLeft size={14} aria-hidden />
            Portfolio
          </Link>
          <span className="pf-leaf-back-sep" aria-hidden>/</span>
          <span className="pf-leaf-back-current">Activity</span>
        </div>

        {/* ── Page header ── */}
        <div className="pf-leaf-header">
          <div className="pf-leaf-header__left">
            <p className="pf-leaf-eyebrow">Portfolio</p>
            <h1 className="pf-leaf-title">Activity</h1>
            <p className="pf-leaf-desc">
              {hasTransactions
                ? `${transactions.length} transaction${transactions.length !== 1 ? "s" : ""} — deposits, payouts, and withdrawals.`
                : "Deposits, payouts, and withdrawals appear here once your account is active."}
            </p>
          </div>
          {provenance && (
            <div className="pf-leaf-header__badge">
              <ProvenanceBadge kind={provenance} />
            </div>
          )}
        </div>

        {/* ── Summary KPIs ── */}
        {hasPositions && (
          <div className="pf-leaf-hero-row">
            <div className="pf-leaf-kpi-card">
              <span className="pf-leaf-kpi-label">
                <Wallet size={12} aria-hidden />
                Total deposited
              </span>
              <span className="pf-leaf-kpi-value tabular">
                {deposits.length > 0 ? formatUsdCompact(totalDeposited) : "—"}
              </span>
              <span className="pf-leaf-kpi-sub">
                {deposits.length > 0 ? `${deposits.length} deposit${deposits.length !== 1 ? "s" : ""}` : "No deposits yet"}
              </span>
            </div>

            <div className="pf-leaf-kpi-card">
              <span className="pf-leaf-kpi-label">
                <CircleDollarSign size={12} aria-hidden />
                Distributions received
              </span>
              <span className={cn(
                "pf-leaf-kpi-value tabular",
                totalReceived > 0 && "pf-leaf-kpi-value--accent",
              )}>
                {payouts.length > 0 ? formatUsdCompact(totalReceived) : "—"}
              </span>
              <span className="pf-leaf-kpi-sub">
                {payouts.length > 0 ? `${payouts.length} payout${payouts.length !== 1 ? "s" : ""}` : "None yet"}
              </span>
            </div>

            <div className="pf-leaf-kpi-card">
              <span className="pf-leaf-kpi-label">
                Transactions
              </span>
              <span className="pf-leaf-kpi-value tabular">
                {transactions.length > 0 ? String(transactions.length) : "—"}
              </span>
              <span className="pf-leaf-kpi-sub">All time</span>
            </div>
          </div>
        )}

        {/* ── Transaction ledger ── */}
        <div className="pf-leaf-section">
          <div className="pf-leaf-section__card">
            <div className="pf-leaf-section__head">
              <h2 className="pf-leaf-section-title">Transaction history</h2>
              {provenance && (
                <ProvenanceBadge kind={provenance} compact />
              )}
            </div>

            {hasTransactions ? (
              <div className="pf-leaf-tx-ledger">
                {grouped.map(({ dateKey, date, txs: dayTxs }) => (
                  <div key={dateKey} className="pf-leaf-tx-group">
                    <div className="pf-leaf-tx-date-header">
                      <span className="pf-leaf-tx-date-label">{dateFmt.format(date)}</span>
                      <span className="pf-leaf-tx-date-line" aria-hidden />
                    </div>
                    {dayTxs.map((tx) => {
                      const dir = flowSign(tx.type);
                      return (
                        <div key={tx.id} className="pf-leaf-tx-row">
                          <span
                            className={cn(
                              "pf-leaf-tx-icon",
                              dir === "in" ? "pf-leaf-tx-icon--in" : "pf-leaf-tx-icon--out",
                            )}
                            aria-hidden
                          >
                            <TxIcon type={tx.type} dir={dir} />
                          </span>
                          <span className="pf-leaf-tx-main">
                            <span className="pf-leaf-tx-type">
                              {TYPE_LABELS[tx.type] ?? tx.type}
                              {tx.positionVaultName && (
                                <span className="pf-leaf-tx-vault">· {tx.positionVaultName}</span>
                              )}
                            </span>
                            <span className="pf-leaf-tx-time">{timeFmt.format(tx.occurredAt)} UTC</span>
                          </span>
                          <span
                            className={cn(
                              "pf-leaf-tx-amount tabular",
                              dir === "in" ? "pf-leaf-tx-amount--in" : "pf-leaf-tx-amount--out",
                            )}
                          >
                            {dir === "out" ? "−" : "+"}
                            {usdFmt.format(tx.amountUsdc)}
                          </span>
                          {tx.txHash && (
                            <span
                              className="pf-leaf-tx-hash mono"
                              title={tx.txHash}
                            >
                              {tx.txHash.slice(0, 8)}…
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ) : (
              <div className="pf-leaf-empty-state">
                <div className="pf-leaf-empty-icon" aria-hidden>
                  {[80, 62, 74, 55, 68].map((w, i) => (
                    <div key={i} className="pf-leaf-empty-ghost-row">
                      <span className="pf-leaf-empty-ghost-icon" />
                      <span className="pf-leaf-empty-ghost-bar" style={{ width: `${w}%` }} />
                      <span className="pf-leaf-empty-ghost-amt" />
                    </div>
                  ))}
                </div>
                <p className="pf-leaf-empty-title">No transactions yet</p>
                <p className="pf-leaf-empty-text">
                  Deposits, payouts, and withdrawals appear here once your account is active.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Trust & Risk — owns its own panel chrome ── */}
        <div className="pf-leaf-section">
          <TrustProofCompact
            risk={riskPulseProps}
            proof={proofPulseProps}
          />
        </div>

        <p className="pf-leaf-disclaimer">
          Transaction history reflects data available in Hearst Connect. On-chain verification
          available via BaseScan for confirmed transactions.
        </p>
      </div>
    </PortfolioLeafShell>
  );
}
