// /rewards — BTC Rewards (Bitcoin Strategic Reserve reposition, Phase P2).
//
// Read-only operational page. Zero migration: the schema stores every
// distribution as USDC only (`Distribution.amountUsdc` / InvestorTransaction
// type "distribution", both — no `amountBtc` column anywhere). This page
// DERIVES the BTC-equivalent at read-time (amountUsdc ÷ btcPriceUsd) and
// badges every derived BTC figure "Estimated" — the USD figure keeps
// whatever real provenance the row carries (Attested when tx-hashed, Manual
// when book-entry), mirroring /portfolio's distribution-history table
// verbatim (`dist.txHash ? "attested" : "manual"`).
//
// Reused verbatim (RULE #0 — no reimport, no mini design system):
//   - `loadDistribCalendarProps()` + `<DistribCalendar>` — the existing 12m
//     payout calendar, passed its props unchanged.
//   - `loadInvestorDistributions()` — the investor's full distribution ledger.
//   - `loadPortfolio()` — accruedYieldUsdc (Pending Rewards) + source data.
//   - `loadBitcoinReserveView()` — btcPrice for the USD→BTC conversion.
//   - `StatBand` / `EmptySurface` / `ProvenanceBadge` / Catalyst `Table` — the
//     same DS primitives already used on /portfolio and /bitcoin-reserve.
//
// Server Component — gated by the (product) layout (session required).

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/catalyst/table";
import { EmptySurface } from "@/components/catalyst/empty-surface";
import { DistribCalendar } from "@/components/portfolio/distrib-calendar";
import { PortfolioLeafHeader } from "@/components/portfolio/portfolio-leaf-header";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import {
  loadDistribCalendarProps,
  loadInvestorDistributions,
  loadPortfolio,
} from "@/lib/data/portfolio";
import { loadBitcoinReserveView } from "@/lib/data/bitcoin-reserve-view";
import { formatBtc, usdToBtc } from "@/lib/format/btc";
import { formatUsdDetailed, formatUsdFull } from "@/lib/vaults/product-display";
import { explorerTxUrl, isPlaceholderTxHash } from "@/lib/chain/explorer";

import type { StatCell } from "../portfolio/preview/_charts/stat-band";
import { StatBand } from "../portfolio/preview/_charts/stat-band";

export const dynamic = "force-dynamic";

export const metadata = { title: "Rewards — Hearst Connect" };

/** Bare-hairline support surface (matches /portfolio + /bitcoin-reserve SUPPORT recipe). */
const SUPPORT =
  "rounded-2xl border border-[var(--ct-border)] bg-surface-card overflow-hidden";

const DISTRIB_DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export default async function RewardsPage() {
  const [portfolio, calendarProps, distributions, btcView] = await Promise.all([
    loadPortfolio(),
    loadDistribCalendarProps(),
    loadInvestorDistributions(),
    loadBitcoinReserveView(),
  ]);

  const { btcPrice } = btcView;

  const hasDistributions = distributions.length > 0;

  // Lifetime + current-month USD aggregates from the real per-investor ledger
  // (loadInvestorDistributions — up to 24 rows, all "distribution"-type
  // InvestorTransaction rows for this investor). BTC figures are always a
  // derived conversion at TODAY's spot price, never a historical payout.
  const lifetimeDistributedUsdc = distributions.reduce((sum, d) => sum + d.amountUsdc, 0);
  const lifetimeDistributedBtc = usdToBtc(lifetimeDistributedUsdc, btcPrice.value);

  const now = new Date();
  const currentMonthUsdc = distributions
    .filter(
      (d) =>
        d.occurredAt.getUTCFullYear() === now.getUTCFullYear() &&
        d.occurredAt.getUTCMonth() === now.getUTCMonth(),
    )
    .reduce((sum, d) => sum + d.amountUsdc, 0);
  const currentMonthBtc = usdToBtc(currentMonthUsdc, btcPrice.value);

  // Pending Rewards — accrued-yield-to-date across the investor's active
  // positions (loadPortfolio's own aggregate field, not re-derived here).
  const pendingUsdc = portfolio.accruedYieldUsdc;
  const pendingBtc = usdToBtc(pendingUsdc, btcPrice.value);

  const kpiStats: StatCell[] = [
    {
      label: "Pending Rewards",
      value: formatUsdFull(pendingUsdc),
      provenance: portfolio.source === "live" ? "attested" : "stale",
    },
    {
      label: "Lifetime Distributed",
      value: formatUsdFull(lifetimeDistributedUsdc),
      provenance: hasDistributions ? "attested" : "stale",
    },
    {
      label: "Lifetime BTC Earned",
      value: formatBtc(lifetimeDistributedBtc),
      affix: "BTC",
      provenance: "estimated",
      valueTone: "btc",
    },
    {
      label: "Current Month",
      value: formatUsdFull(currentMonthUsdc),
      provenance: currentMonthUsdc > 0 ? "attested" : "stale",
    },
  ];

  return (
    <div className="dark flex flex-col gap-y-8 p-5 lg:p-6">
      <PortfolioLeafHeader
        titleLead="BTC"
        titleAccent="Rewards"
        kicker="MONTHLY DISTRIBUTIONS"
      />

      {/* ── KPI row ─────────────────────────────────────────────────────── */}
      <div className={SUPPORT}>
        <StatBand items={kpiStats} />
      </div>

      {/* ── Distribution calendar — reused verbatim from /portfolio ──────── */}
      <DistribCalendar {...calendarProps} />

      {/* ── Distribution history ──────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-4 pt-2">
          <h2 className="ct-section-title shrink-0">Distribution history</h2>
          <span aria-hidden="true" className="h-px flex-1" style={{ background: "var(--ct-border-soft)" }} />
        </div>

        {hasDistributions ? (
          <div className={SUPPORT}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Date</TableHeader>
                  <TableHeader>BTC Amount</TableHeader>
                  <TableHeader>USD Value</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader>Transaction</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {distributions.map((dist) => {
                  const btcAmount = usdToBtc(dist.amountUsdc, btcPrice.value);
                  const usdProvenance = dist.txHash ? "attested" : "manual";
                  const hasExplorerLink = dist.txHash && !isPlaceholderTxHash(dist.txHash);

                  return (
                    <TableRow key={dist.id}>
                      <TableCell>
                        <span className="tabular-nums ct-text-strong">
                          {DISTRIB_DATE.format(dist.occurredAt)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ background: "var(--ct-cat-btc)" }}
                          />
                          <span className="tabular-nums ct-text-strong">
                            {formatBtc(btcAmount, { unit: true })}
                          </span>
                          <ProvenanceBadge kind="estimated" variant="compact" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="tabular-nums ct-text-strong">
                            {formatUsdDetailed(dist.amountUsdc)}
                          </span>
                          <ProvenanceBadge kind={usdProvenance} variant="compact" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="body-xs ct-text-muted">Paid</span>
                      </TableCell>
                      <TableCell>
                        {hasExplorerLink ? (
                          <a
                            href={explorerTxUrl(dist.txHash as string)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="body-xs ct-text-muted underline underline-offset-2 decoration-[var(--ct-border)] transition-colors hover:ct-text-strong"
                          >
                            View on BaseScan
                          </a>
                        ) : (
                          <span className="body-xs ct-text-faint">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <EmptySurface
            message="No distributions yet."
            detail="Monthly USDC distributions — and their derived BTC equivalent — appear here once your position starts paying out."
          />
        )}
      </section>

      <p className="ct-metric-caption text-[length:var(--ct-text-nano)] leading-snug">
        BTC amounts are derived from the paid USDC value at today&rsquo;s spot
        price — not a historical on-chain BTC payout. USD figures are what was
        actually paid.
      </p>
    </div>
  );
}
