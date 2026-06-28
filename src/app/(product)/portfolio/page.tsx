// Investor Portfolio — bound to REAL data (loadPortfolio + loadAllocationDonut,
// MISSION #034), rendered entirely on the Hearst Instrument System (HIS) data-viz
// (src/components/dataviz/his — PR #160). Server Component, gated by the product
// layout. Replaces the former 100% static mock ($509,800 / $500,000 / $9,800 /
// $8,380 demo activity) so the investor sees the SAME truth as /profile and
// /admin/customers (e.g. the real $11 account). No data-layer rewrite — this page
// only BINDS the existing loader + HIS primitives. HIS guarantees honesty:
// non-live data can never read as "Live" (source badge + fallback hatch veil).

import Link from "next/link";

import { Badge } from "@/components/catalyst/badge";
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
  HcMetricSparkline,
  type HcSourceStatus,
} from "@/components/dataviz/his";
import { RecentActivity } from "@/components/portfolio/recent-activity";
import {
  loadPortfolio,
  loadAllocationDonutProps,
  POSITION_STATUS_CONFIG,
} from "@/lib/data/portfolio";
import { formatApyRange } from "@/lib/format/apy";
import { formatUsdFull } from "@/lib/vaults/product-display";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Portfolio",
  description: "Your positions and distributions",
};

const TABLE_HEAD = "bg-transparent ct-bento-label";
const ROW =
  "border-transparent transition-colors hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_2%,transparent)]";
// One KPI tile in the Account card (hairline-separated cells on the black grid).
const KPI_TILE = "flex flex-col gap-1.5 bg-surface-card p-5 min-w-0";
const KPI_VALUE = "ct-metric-value text-[length:var(--ct-text-2xl)]";

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

/** Loader source → HIS truth status (drives the badge tone + honesty veil). */
function hcSource(source: "live" | "fallback"): HcSourceStatus {
  return source === "live" ? "live" : "fallback";
}

export default async function PortfolioPage() {
  // Call ONLY the two loaders this page renders (the value/positions data + the
  // allocation ring). Avoids loadPortfolioView's extra risk/distrib/proof/yield
  // props that this page doesn't consume — no wasted queries.
  const [data, allocationDonutProps] = await Promise.all([
    loadPortfolio(),
    loadAllocationDonutProps(),
  ]);
  const {
    positions,
    totalValueUsdc,
    deployedUsdc,
    accruedYieldUsdc,
    nextDistributionAt,
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

  // Real value series for the hero sparkline (hourly investor NAV prints).
  // Pass the REAL series untouched — never inject a fake [0,0] baseline (that
  // made the curve flat-line at $0 while the headline showed the true value,
  // e.g. the $11 account, and bypassed the primitive's honest empty-state).
  // For a single real point we duplicate the TRUE value ([v, v]) so the plot is
  // a flat line at the real level, not at zero. With 0 points the primitive
  // renders its own empty surface. A fallback-source run still gets the hatch veil.
  const realSpark = hourlyValueSnapshots.map((s) => s.valueUsdc);
  const sparkValues =
    realSpark.length === 1 ? [realSpark[0]!, realSpark[0]!] : realSpark;
  const heroState: "ready" | "fallback" =
    source === "fallback" ? "fallback" : "ready";

  // Allocation ring is ALWAYS populated. Use the real vault-snapshot buckets
  // when present; otherwise fall back to the Hearst Yield Vault strategy targets
  // (Mining 60 / BTC 25 / USDC 10 / Stable 5) so the ring always shows segments
  // and is never an empty track. The source badge still tells the truth (live vs
  // stale) — only the geometry is guaranteed non-empty.
  const allocSegments =
    allocationDonutProps.buckets.length > 0
      ? allocationDonutProps.buckets.map((b) => ({
          label: BUCKET_LABEL[b.bucket] ?? b.bucket,
          value: b.valueUsdc,
        }))
      : [
          { label: BUCKET_LABEL.mining!, value: 60 },
          { label: BUCKET_LABEL.btc_tactical!, value: 25 },
          { label: BUCKET_LABEL.usdc_base!, value: 10 },
          { label: BUCKET_LABEL.stable_reserve!, value: 5 },
        ];

  return (
    <div className="dark flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page [--gutter:theme(spacing.8)] mb-8">
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
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
        <section className="grid grid-cols-1 lg:grid-cols-[1.8fr_minmax(300px,1fr)] gap-5">
          <HcChartCard
            title="Portfolio value"
            subtitle="Net asset value · last 12 months"
            metric={formatUsdFull(totalValueUsdc)}
            source={hcSource(source)}
            state={heroState}
            height={200}
            aria-label="Portfolio value over time"
          >
            <HcMetricSparkline
              values={sparkValues}
              width={640}
              height={200}
              area
              tone="accent"
              responsive
              aria-label="Portfolio value trend"
            />
          </HcChartCard>

          {/* Account key-metrics card — black surface, titled header, responsive
              KPI grid (1 col on narrow, 2 on wider). */}
          <div className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-sm flex flex-col overflow-hidden">
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
                <div className={`${KPI_VALUE} text-[var(--ct-accent)]`}>
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
          source={allocationDonutProps.source === "live" ? "live" : "stale"}
          state="ready"
          height={180}
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
              aria-label="Allocation composition ring"
            />
          </div>
        </HcChartCard>

        {/* DECK — Distribution calendar + Recent activity (real) */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-sm flex flex-col">
            <div className="p-5 border-b border-[var(--ct-border-soft)]">
              <div className="flex flex-col gap-1.5">
                <h2 className="ct-section-title">Distribution calendar</h2>
                <p className="ct-metric-caption">Upcoming payouts</p>
              </div>
            </div>
            <div className="p-6 flex flex-col items-center justify-center min-h-[180px]">
              <div className="ct-bento-label mb-3">Next distribution</div>
              <div className="h1 mb-2">
                {nextDistributionAt.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </div>
              <div className="ct-metric-caption">
                Monthly USDC · T+5 settlement
              </div>
            </div>
          </div>

          {/* Real recent activity — empty state is honest ("No transactions yet") */}
          <RecentActivity
            transactions={recentTransactions}
            source={source}
            updatedAt={updatedAt}
          />
        </section>

        {/* POSITIONS — real rows */}
        <section
          className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-sm overflow-hidden flex flex-col"
          aria-label="Active positions"
        >
          <div className="flex items-center gap-4 p-5 border-b border-[var(--ct-border-soft)]">
            <div className="flex flex-col gap-1.5">
              <h2 className="ct-section-title">Active positions</h2>
              <p className="ct-metric-caption">Your deployed capital</p>
            </div>
            {activeCount > 0 ? (
              <Badge color="zinc" className="shrink-0 self-start uppercase">
                {activeCount} active
              </Badge>
            ) : null}
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
                    Vault
                  </TableHeader>
                  <TableHeader className={`${TABLE_HEAD} text-center`}>
                    Status
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
                      <TableCell className="text-center">
                        <Badge
                          color={
                            p.status === "active"
                              ? "green"
                              : p.status === "matured"
                                ? "amber"
                                : "zinc"
                          }
                          className="uppercase"
                        >
                          {statusCfg.label}
                        </Badge>
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
