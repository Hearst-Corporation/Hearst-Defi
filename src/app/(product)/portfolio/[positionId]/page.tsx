// Portfolio › Position detail (/portfolio/[positionId]) — single position bound
// to real data (loadPosition) on the DS canon. Next.js 16 async params.

import { notFound } from "next/navigation";

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
import { loadPosition, POSITION_STATUS_CONFIG } from "@/lib/data/portfolio";
import { formatApyRange } from "@/lib/format/apy";
import { formatAdminDate, formatUsdFull } from "@/lib/vaults/product-display";

export const dynamic = "force-dynamic";

export const metadata = { title: "Position" };

interface PageProps {
  params: Promise<{ positionId: string }>;
}

const TABLE_HEAD = "bg-transparent ct-bento-label";
const ROW =
  "border-transparent transition-colors hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_2%,transparent)]";
const KPI_TILE = "flex flex-col gap-1.5 bg-surface-card p-5 min-w-0";
const KPI_VALUE = "ct-metric-value text-[length:var(--ct-text-2xl)]";

const TX_LABEL: Record<string, string> = {
  deposit: "Deposit",
  claim: "Claim",
  withdraw: "Withdrawal",
  distribution: "Payout",
};

export default async function PositionDetailPage({ params }: PageProps) {
  const { positionId } = await params;
  const position = await loadPosition(positionId);
  if (!position) notFound();

  const apy =
    position.realizedApyLow !== null && position.realizedApyHigh !== null
      ? formatApyRange({
          low: position.realizedApyLow,
          high: position.realizedApyHigh,
        })
      : "—";
  const value = position.principalUsdc + position.accruedYieldUsdc;

  return (
    <div className="dark flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page [--gutter:theme(spacing.8)] mb-8">
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        <PortfolioLeafHeader
          titleLead={position.vaultName ?? "Hearst Yield Vault"}
          kicker={`${position.vaultTicker} · SUBSCRIBED ${formatAdminDate(position.subscribedAt).toUpperCase()}`}
          trailing={
            <Badge
              color={
                position.status === "active"
                  ? "green"
                  : position.status === "matured"
                    ? "amber"
                    : "zinc"
              }
              className="uppercase"
            >
              {POSITION_STATUS_CONFIG[position.status].label}
            </Badge>
          }
        />

        {/* KPIs */}
        <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 border-b border-[var(--ct-border-soft)]">
            <h2 className="ct-section-title">Position</h2>
            <p className="ct-metric-caption">Principal, value &amp; yield</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-[var(--ct-border-soft)]">
            <div className={KPI_TILE}>
              <div className="ct-bento-label">Principal</div>
              <div className={KPI_VALUE}>
                {formatUsdFull(position.principalUsdc)}
              </div>
              <div className="ct-metric-caption">Net deposits</div>
            </div>
            <div className={KPI_TILE}>
              <div className="ct-bento-label">Current value</div>
              <div className={KPI_VALUE}>{formatUsdFull(value)}</div>
              <div className="ct-metric-caption">Principal + accrued</div>
            </div>
            <div className={KPI_TILE}>
              <div className="ct-bento-label">Accrued yield</div>
              <div className={`${KPI_VALUE} text-[var(--ct-accent)]`}>
                {position.accruedYieldUsdc > 0
                  ? `+${formatUsdFull(position.accruedYieldUsdc)}`
                  : formatUsdFull(position.accruedYieldUsdc)}
              </div>
              <div className="ct-metric-caption">Pending</div>
            </div>
            <div className={KPI_TILE}>
              <div className="ct-bento-label">Target APY</div>
              <div className={`${KPI_VALUE} text-[var(--ct-accent)]`}>{apy}</div>
              <div className="ct-metric-caption">Conditional, not guaranteed</div>
            </div>
          </div>
        </section>

        {/* Transactions */}
        <section
          className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-sm overflow-hidden flex flex-col"
          aria-label="Position transactions"
        >
          <div className="p-5 border-b border-[var(--ct-border-soft)]">
            <h2 className="ct-section-title">Transactions</h2>
            <p className="ct-metric-caption">Deposits &amp; payouts on this position</p>
          </div>
          {position.transactions.length > 0 ? (
            <Table
              dense
              className="[--gutter:0px] max-w-full [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap"
            >
              <TableHead>
                <TableRow>
                  <TableHeader className={`${TABLE_HEAD} pl-5`}>Date</TableHeader>
                  <TableHeader className={`${TABLE_HEAD} text-center`}>
                    Type
                  </TableHeader>
                  <TableHeader className={`${TABLE_HEAD} pr-5 text-right`}>
                    Amount
                  </TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {position.transactions.map((t) => {
                  const out = t.type === "withdraw";
                  return (
                    <TableRow key={t.id} className={ROW}>
                      <TableCell className="ct-metric-caption pl-5">
                        {formatAdminDate(t.occurredAt)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge color="zinc" className="uppercase">
                          {TX_LABEL[t.type] ?? t.type}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={`ct-metric-value pr-5 text-right ${
                          out ? "" : "text-[var(--ct-accent)]"
                        }`}
                      >
                        {out ? "−" : "+"}
                        {formatUsdFull(t.amountUsdc)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="p-10 text-center">
              <p className="ct-metric-caption">No transactions on this position yet.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
