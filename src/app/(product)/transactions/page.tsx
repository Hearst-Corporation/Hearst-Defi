// /transactions — account-wide transaction ledger.
//
// Part of the Bitcoin Strategic Reserve reposition (nav V2). Reuses the SAME
// `loadPortfolio()` feed already powering Portfolio › Activity (recentTransactions)
// — see docs on that loader for the honesty tradeoff: it is hard-capped (take: 5)
// server-side, there is no uncapped/paginated InvestorTransaction query yet. This
// page renders exactly what the loader gives it in a proper table, with an honest
// caption ("most recent") rather than claiming to be an exhaustive ledger — no
// fake pagination controls over a capped query.
//
// Type → label/icon/tone mapping reused verbatim from
// `@/components/portfolio/recent-activity` (RecentActivity) — do not invent a
// parallel mapping.
//
// Server Component — gated by the (product) layout (session required).

import {
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  Receipt,
  ArrowDownRight,
  CircleDollarSign,
} from "lucide-react";

import { PortfolioLeafHeader } from "@/components/portfolio/portfolio-leaf-header";
import { EmptySurface } from "@/components/catalyst/empty-surface";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { resolveProvenance } from "@/lib/portfolio/provenance";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/catalyst/table";
import { HcBarChart } from "@/components/dataviz/his/HcBarChart";
import { loadPortfolio, type PortfolioTransaction } from "@/lib/data/portfolio";
import {
  formatAdminDate,
  formatAdminMonthDay,
  formatUsdDetailed,
} from "@/lib/vaults/product-display";

export const dynamic = "force-dynamic";

export const metadata = { title: "Transactions — Hearst Connect" };

// Type → label/icon mapping — reused verbatim from recent-activity.tsx.
const TYPE_LABELS: Record<string, string> = {
  deposit: "Deposit",
  claim: "Claim",
  withdraw: "Withdrawal",
  distribution: "Payout",
};

function flowSign(type: string): "in" | "out" {
  return type === "withdraw" ? "out" : "in";
}

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

const TABLE_HEAD = "bg-transparent ct-bento-label";
const ROW =
  "border-transparent transition-colors hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_2%,transparent)]";

export default async function TransactionsPage() {
  const { recentTransactions, source, updatedAt } = await loadPortfolio();
  const hasTransactions = recentTransactions.length > 0;
  const provenance = hasTransactions
    ? resolveProvenance(source, updatedAt)
    : undefined;

  // Amount-trend context bar — chronological (oldest → newest) so the shape
  // reads as a trend rather than a "most recent first" reversal. Signed
  // in/out is preserved via each bar's tooltip; the visible set is the same
  // capped feed the table renders (no separate/uncapped query — RULE #0).
  const trendBars = hasTransactions
    ? [...recentTransactions]
        .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())
        .map((tx) => ({
          label: formatAdminMonthDay(tx.occurredAt),
          value: tx.amountUsdc,
          tooltip: `${flowSign(tx.type) === "out" ? "−" : "+"}${formatUsdDetailed(tx.amountUsdc)} · ${
            TYPE_LABELS[tx.type] ?? tx.type
          }`,
        }))
    : [];

  return (
    <div className="dark flex flex-col gap-y-8 p-5 lg:p-6">
      <PortfolioLeafHeader
        titleLead="Account"
        titleAccent="Transactions"
        kicker="LEDGER"
      />

      {hasTransactions ? (
        <section
          className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden p-5"
          aria-label="Transaction amount trend"
        >
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex min-w-0 flex-col gap-1">
              <h2 className="ct-section-title">Amount trend</h2>
              <p className="ct-metric-caption">
                Transaction size across your most recent activity
              </p>
            </div>
            {provenance ? (
              <ProvenanceBadge kind={provenance} variant="compact" />
            ) : null}
          </div>
          <HcBarChart
            aria-label="Transaction amounts across recent activity, oldest to newest"
            bars={trendBars}
            height={160}
            highlightLast
            yTicks={3}
          />
        </section>
      ) : null}

      <section
        className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col"
        aria-label="Transaction ledger"
      >
        <div className="p-5 border-b border-[var(--ct-border-soft)] flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="ct-section-title">Transaction ledger</h2>
            <p className="ct-metric-caption">
              {hasTransactions
                ? "Showing your most recent transactions"
                : "Deposits, payouts, claims, and withdrawals"}
            </p>
          </div>
          {provenance ? (
            <ProvenanceBadge kind={provenance} variant="compact" />
          ) : null}
        </div>

        {hasTransactions ? (
          <Table
            dense
            className="[--gutter:0px] max-w-full [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap"
          >
            <TableHead>
              <TableRow>
                <TableHeader className={`${TABLE_HEAD} pl-5`}>Date</TableHeader>
                <TableHeader className={`${TABLE_HEAD}`}>Type</TableHeader>
                <TableHeader className={`${TABLE_HEAD}`}>Vault</TableHeader>
                <TableHeader className={`${TABLE_HEAD} text-right`}>
                  Amount
                </TableHeader>
                <TableHeader className={`${TABLE_HEAD} pr-5 text-center`}>
                  Status
                </TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {recentTransactions.map((tx: PortfolioTransaction) => {
                const dir = flowSign(tx.type);
                return (
                  <TableRow key={tx.id} className={ROW}>
                    <TableCell className="ct-metric-caption pl-5">
                      {formatAdminDate(tx.occurredAt)}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--ct-border-soft)] bg-[var(--ct-surface-inset)] text-[var(--ct-text-muted)]"
                        >
                          <TransactionIcon type={tx.type} dir={dir} />
                        </span>
                        <span className="ct-metric-caption">
                          {TYPE_LABELS[tx.type] ?? tx.type}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="ct-metric-caption">
                      {tx.positionVaultName ?? "—"}
                    </TableCell>
                    <TableCell
                      className={`ct-metric-value text-right tabular-nums ${
                        dir === "in" ? "text-[var(--ct-accent)]" : ""
                      }`}
                    >
                      {dir === "out" ? "−" : "+"}
                      {formatUsdDetailed(tx.amountUsdc)}
                    </TableCell>
                    <TableCell className="pr-5">
                      <div className="flex justify-center">
                        <ProvenanceBadge
                          kind={tx.txHash ? "attested" : "manual"}
                          variant="compact"
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <EmptySurface
            message="No transactions yet"
            detail="Deposits, payouts, and withdrawals appear here once activity is posted."
          />
        )}
      </section>
    </div>
  );
}
