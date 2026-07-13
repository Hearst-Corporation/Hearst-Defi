// Portfolio › Distributions — USDC payout history + next-distribution summary,
// bound to real data (loadPortfolio) on the DS canon.

import { Badge } from "@/components/catalyst/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/catalyst/table";
import { PortfolioLeafHeader } from "@/components/portfolio/portfolio-leaf-header";
import { loadPortfolio } from "@/lib/data/portfolio";
import { formatAdminDate, formatUsdFull } from "@/lib/vaults/product-display";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Distributions",
  description: "Your USDC distribution history",
};

const TABLE_HEAD = "bg-transparent ct-bento-label";
const ROW =
  "border-transparent transition-colors hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_2%,transparent)]";

export default async function DistributionsPage() {
  const { recentTransactions, nextDistributionAt } = await loadPortfolio();
  const payouts = recentTransactions.filter(
    (t) => t.type === "distribution" || t.type === "claim",
  );

  return (
    <div className="dark flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page [--gutter:theme(spacing.8)] mb-8">
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        <PortfolioLeafHeader
          titleLead="USDC"
          titleAccent="Distributions"
          kicker="MONTHLY USDC · T+5 SETTLEMENT"
        />

        {/* Next distribution summary */}
        <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] p-6 flex flex-col items-center justify-center">
          <div className="ct-bento-label mb-3">Next distribution</div>
          <div className="ct-metric-value text-[length:var(--ct-text-2xl)] mb-2">
            {nextDistributionAt.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </div>
          <div className="ct-metric-caption">Monthly USDC · T+5 settlement</div>
        </section>

        {/* Payout history */}
        <section
          className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col"
          aria-label="Distribution history"
        >
          <div className="p-5 border-b border-[var(--ct-border-soft)]">
            <h2 className="ct-section-title">Payout history</h2>
            <p className="ct-metric-caption">Distributions received</p>
          </div>
          {payouts.length > 0 ? (
            <Table
              dense
              className="[--gutter:0px] max-w-full [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap"
            >
              <TableHead>
                <TableRow>
                  <TableHeader className={`${TABLE_HEAD} pl-5`}>Date</TableHeader>
                  <TableHeader className={`${TABLE_HEAD}`}>Vault</TableHeader>
                  <TableHeader className={`${TABLE_HEAD} text-center`}>
                    Type
                  </TableHeader>
                  <TableHeader className={`${TABLE_HEAD} pr-5 text-right`}>
                    Amount
                  </TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {payouts.map((t) => (
                  <TableRow key={t.id} className={ROW}>
                    <TableCell className="ct-metric-caption pl-5">
                      {formatAdminDate(t.occurredAt)}
                    </TableCell>
                    <TableCell className="ct-metric-caption">
                      {t.positionVaultName ?? "Hearst Yield Vault"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge color="zinc" className="uppercase">
                        {t.type === "claim" ? "Claim" : "Payout"}
                      </Badge>
                    </TableCell>
                    <TableCell className="ct-metric-value pr-5 text-right text-[var(--ct-accent)]">
                      +{formatUsdFull(t.amountUsdc)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-10 text-center">
              <p className="ct-metric-caption">
                No distributions yet. Monthly USDC payouts appear here once your
                first cycle settles.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
