// Investor Portfolio — bound to REAL data (loadPortfolio + loadAllocationDonut,
// MISSION #034), rendered entirely on the Hearst Instrument System (HIS) data-viz
// (src/components/dataviz/his — PR #160). Server Component, gated by the product
// layout. Replaces the former 100% static mock ($509,800 / $500,000 / $9,800 /
// $8,380 demo activity) so the investor sees the SAME truth as /profile and
// /admin/customers (e.g. the real $11 account). No data-layer rewrite — this page
// only BINDS the existing loader + HIS primitives. HIS guarantees honesty:
// non-live data can never read as "Live" (source badge + fallback hatch veil).

import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/catalyst/table";
import {
  HcChartCard,
  HcCompositionRing,
  HcValueChart,
  type HcSourceStatus,
} from "@/components/dataviz/his";
import { RecentActivity } from "@/components/portfolio/recent-activity";
import { DistributionChart } from "@/components/portfolio/distribution-chart";
import {
  loadPortfolio,
  loadAllocationDonutProps,
  loadDistribCalendarProps,
  POSITION_STATUS_CONFIG,
} from "@/lib/data/portfolio";
import { formatApyRange } from "@/lib/format/apy";
import { resolvePortfolioChartWindow } from "@/lib/portfolio/value-series";
import { formatUsdFull } from "@/lib/vaults/product-display";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Portfolio",
  description: "Your positions and distributions",
};

const TABLE_HEAD = "bg-transparent ct-bento-label";
const ROW =
  "border-transparent transition-all hover:bg-[radial-gradient(circle_at_20%_50%,rgba(255,255,255,0.05)_0%,transparent_60%)]";
// One KPI tile in the Account card (hairline-separated cells on the black grid).
const KPI_TILE = "flex flex-col gap-1.5 bg-surface-card p-5 min-w-0";
const KPI_VALUE = "ct-metric-value text-[length:var(--ct-text-2xl)] tracking-tight";

const BUCKET_LABEL: Record<string, string> = {
  mining: "Mining cashflow",
  usdc_base: "USDC base yield",
  btc_tactical: "BTC tactical",
  stable_reserve: "Stable reserve",
};

function apyLabel(low: number | null, high: number | null): string {
  if (low === null || high === null) return "—";
  return formatApyRange({ low, high });
}

/** Canon "See more →" link to a portfolio leaf page (token-only). */
function SeeMore({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="ct-bento-label group inline-flex shrink-0 items-center gap-1 transition-colors hover:text-[var(--ct-accent)]"
    >
      See more <span aria-hidden="true" className="transition-transform ease-out group-hover:translate-x-0.5">→</span>
    </Link>
  );
}

export default async function PortfolioPage() {
  // Call ONLY the two loaders this page renders (the value/positions data + the
  // allocation ring). Avoids loadPortfolioView's extra risk/distrib/proof/yield
  // props that this page doesn't consume — no wasted queries.
  const [data, allocationDonutProps, distribCalendarProps] = await Promise.all([
    loadPortfolio(),
    loadAllocationDonutProps(),
    loadDistribCalendarProps(),
  ]);
  const {
    positions,
    totalValueUsdc,
    deployedUsdc,
    accruedYieldUsdc,
    recentTransactions,
    hourlyValueSnapshots,
    source,
    updatedAt,
  } = data;

  const hasPositions = positions.length > 0;
  const activeCount = positions.filter((p) => p.status === "active").length;
  const deployedPct =
    totalValueUsdc > 0
      ? `${((deployedUsdc / totalValueUsdc) * 100).toFixed(1)}%`
      : "—";

  // Real NAV points (with dates) feed the axed hero chart (HcValueChart). The
  // series is real and untouched — no fake [0,0] baseline. <2 points → the chart
  // renders its own honest empty state. A fallback-source run still gets the veil.
  const valuePoints = hourlyValueSnapshots.map((s) => ({
    at: s.at,
    value: s.valueUsdc,
  }));
  const heroState: "ready" | "fallback" =
    source === "fallback" ? "fallback" : "ready";

  // Resolve the chart's header + axis from the REAL span so the subtitle can
  // never claim "12 months" while the x-axis shows days, and so the provenance
  // badge reads "Live" only when the data is genuinely live (real source AND a
  // real span). Demo data gets the explicit "Demo" pill; a seed/low balance is
  // annotated rather than dressed up as a mature institutional book.
  const chartWindow = resolvePortfolioChartWindow(valuePoints, source);
  const heroSubtitle = chartWindow.isLowBalance
    ? `${chartWindow.subtitle} · seed balance`
    : chartWindow.subtitle;
  const heroSource: HcSourceStatus = chartWindow.isDemo
    ? "demo"
    : chartWindow.isLive
      ? "live"
      : "estimated";

  // Allocation ring — REAL vault-snapshot buckets only. No fabricated split: if
  // there is no real allocation, the ring renders its empty track (zero stays
  // zero, widget still visible) rather than an invented 60/25/10/5 under a badge.
  const allocSegments = allocationDonutProps.buckets.map((b) => ({
    label: BUCKET_LABEL[b.bucket] ?? b.bucket,
    value: b.valueUsdc,
  }));
  const hasAllocation = allocSegments.length > 0;

  return (
    <div className="dark flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page [--gutter:theme(spacing.8)] mb-8 relative">
      {/* Premium ambient glow */}
      <div 
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[400px] opacity-[0.04]"
        style={{
          background: "radial-gradient(ellipse at center, var(--ct-accent) 0%, transparent 70%)",
        }}
      />

      <div className="p-5 lg:p-6 flex flex-col gap-y-5 relative z-10">
        {/* HEADER */}
        <div className="flex flex-wrap items-center justify-between pb-3 border-b border-[var(--ct-border-soft)] gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="ct-bento-label">HYV · Investor Cockpit</span>
            <h1 className="h1 shrink-0">
              Portfolio <span className="h1-accent">Cockpit</span>
            </h1>
          </div>
        </div>

        {/* HERO — value instrument (HIS) + status tiles */}
        <section className="grid grid-cols-1 lg:grid-cols-[1.6fr_minmax(256px,352px)] gap-5">
          <HcChartCard
            title="Portfolio value"
            subtitle={heroSubtitle}
            metric={formatUsdFull(totalValueUsdc)}
            metricCompact
            source={heroSource}
            state={heroState}
            height={200}
            aria-label="Portfolio value over time"
          >
            <HcValueChart
              points={valuePoints}
              height={200}
              xTicks={chartWindow.xTicks}
              granularity={chartWindow.granularity}
              aria-label="Portfolio value trend"
            />
          </HcChartCard>

          {/* Account key-metrics card — black surface, titled header, responsive
              KPI grid (1 col on narrow, 2 on wider). */}
          <div 
            className="rounded-2xl border border-[var(--ct-border)] bg-surface-card flex flex-col overflow-hidden"
            style={{ boxShadow: "var(--ct-shadow-soft), inset 0 1px 0 rgba(255, 255, 255, 0.04)" }}
          >
            <div className="p-5 border-b border-[var(--ct-border-soft)]">
              <h2 className="ct-section-title">Account</h2>
              <p className="ct-metric-caption">Key metrics</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-[var(--ct-border-soft)] flex-1">
              <div className={KPI_TILE}>
                <div className="ct-bento-label">Principal</div>
                <div className={KPI_VALUE}>{formatUsdFull(deployedUsdc)}</div>
                <div className="ct-metric-caption">Net deposits</div>
              </div>
              <div className={KPI_TILE}>
                <div className="ct-bento-label">Positions</div>
                <div className={KPI_VALUE}>{activeCount}</div>
                <div className="ct-metric-caption">Active vaults</div>
              </div>
              <div className={KPI_TILE}>
                <div className="ct-bento-label">Deployed</div>
                <div className={KPI_VALUE}>{deployedPct}</div>
                <div className="ct-metric-caption">Capital efficiency</div>
              </div>
              <div className={KPI_TILE}>
                <div className="ct-bento-label">Accrued yield</div>
                <div 
                  className={`${KPI_VALUE} text-transparent bg-clip-text font-bold`}
                  style={{ backgroundImage: "linear-gradient(to right, var(--ct-text-primary), var(--ct-accent))" }}
                >
                  {accruedYieldUsdc > 0
                    ? `+${formatUsdFull(accruedYieldUsdc)}`
                    : formatUsdFull(accruedYieldUsdc)}
                </div>
                <div className="ct-metric-caption">Since inception</div>
              </div>
            </div>
          </div>
        </section>

        {/* CAPITAL & YIELD — allocation ring (HIS) */}
        <HcChartCard
          title="Capital & yield"
          subtitle="Strategy allocation by bucket"
          source={
            hasAllocation
              ? allocationDonutProps.source === "live"
                ? "live"
                : "stale"
              : undefined
          }
          state="ready"
          height={180}
          actions={<SeeMore href="/portfolio/yield" />}
          aria-label="Strategy allocation"
        >
          <div className="flex h-full items-center">
            <HcCompositionRing
              segments={allocSegments}
              centerLabel="Capital"
              centerValue={
                allocationDonutProps.aumUsdc
                  ? formatUsdFull(allocationDonutProps.aumUsdc)
                  : formatUsdFull(deployedUsdc)
              }
              bars
              aria-label="Allocation composition ring"
            />
          </div>
        </HcChartCard>

        {/* DECK — Distribution calendar + Recent activity (real) */}
        <section className="grid grid-cols-1 lg:grid-cols-[1.2fr_minmax(16rem,0.8fr)] gap-5">
          <div 
            className="rounded-2xl border border-[var(--ct-border)] bg-surface-card flex flex-col overflow-hidden"
            style={{ boxShadow: "var(--ct-shadow-soft), inset 0 1px 0 rgba(255, 255, 255, 0.04)" }}
          >
            <div className="flex items-start justify-between gap-4 p-5 border-b border-[var(--ct-border-soft)]">
              <div className="flex flex-col gap-1.5">
                <h2 className="ct-section-title">Distribution calendar</h2>
                <p className="ct-metric-caption">12m · USDC payout history</p>
              </div>
              <SeeMore href="/portfolio/distributions" />
            </div>
            
            <div className="p-5 flex flex-col justify-end min-h-[180px]">
              <DistributionChart entries={distribCalendarProps.entries} />
            </div>
          </div>

          {/* Real recent activity — empty state is honest ("No transactions yet") */}
          <RecentActivity
            transactions={recentTransactions}
            source={source}
            updatedAt={updatedAt}
            leafHref="/portfolio/activity"
          />
        </section>

        {/* POSITIONS — real rows */}
        <section
          className="rounded-2xl border border-[var(--ct-border)] bg-surface-card overflow-hidden flex flex-col"
          style={{ boxShadow: "var(--ct-shadow-soft), inset 0 1px 0 rgba(255, 255, 255, 0.04)" }}
          aria-label="Active positions"
        >
          <div className="flex items-start justify-between gap-4 p-5 border-b border-[var(--ct-border-soft)]">
            <div className="flex flex-col gap-1.5">
              <h2 className="ct-section-title">Active positions</h2>
              <p className="ct-metric-caption">Your deployed capital</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <SeeMore href="/portfolio/positions" />
            </div>
          </div>

          {hasPositions ? (
            <Table
              dense
              // Neutralize the Catalyst wrapper's -mx-(--gutter) bleed (the page
              // sets --gutter:spacing.8): pin --gutter to 0 so the table aligns
              // flush inside the card instead of being pulled 32px left/right
              // (which shifted every column and clipped the Vault name).
              className="[--gutter:0px] max-w-full [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap"
            >
              <TableHead>
                <TableRow>
                  <TableHeader className={`${TABLE_HEAD} pl-5`}>
                    <div className="flex items-center gap-3">
                      <div aria-hidden="true" className="w-1 shrink-0" />
                      <span>Vault</span>
                    </div>
                  </TableHeader>
                  <TableHeader className={TABLE_HEAD}>
                    <div className="flex items-center gap-2">
                      <div aria-hidden="true" className="w-1.5 shrink-0" />
                      <span>Status</span>
                    </div>
                  </TableHeader>
                  <TableHeader className={`${TABLE_HEAD} text-right`}>
                    Position
                  </TableHeader>
                  <TableHeader className={`${TABLE_HEAD} pr-5 text-right`}>
                    Target APY
                  </TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {positions.map((p) => {
                  const statusCfg = POSITION_STATUS_CONFIG[p.status];
                  return (
                    <TableRow key={p.id} className={ROW}>
                      <TableCell className="pl-5">
                        <div className="flex items-center gap-3">
                          <div
                            aria-hidden="true"
                            className="h-7 w-1 shrink-0 rounded-full bg-[var(--ct-accent)]"
                          />
                          <Link
                            href={`/portfolio/${p.id}`}
                            className="ct-metric-value min-w-0 truncate hover:underline"
                          >
                            {p.vaultName ?? "Hearst Yield Vault"}
                          </Link>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            aria-hidden="true"
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                              p.status === "active"
                                ? "bg-[var(--ct-accent)]"
                                : p.status === "matured"
                                  ? "bg-amber-500"
                                  : "bg-[var(--ct-text-muted)]"
                            }`}
                          />
                          <span className="ct-metric-caption uppercase tracking-widest text-[length:var(--ct-text-nano)]">
                            {statusCfg.label}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="ct-metric-value text-right">
                        {formatUsdFull(p.valueUsdc)}
                      </TableCell>
                      <TableCell className="ct-metric-value text-right text-[var(--ct-accent)]">
                        {apyLabel(p.apyLow, p.apyHigh)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="p-10 text-center">
              <p className="ct-metric-caption">
                No active positions yet. Once you subscribe to a vault, your
                deployed capital appears here.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
