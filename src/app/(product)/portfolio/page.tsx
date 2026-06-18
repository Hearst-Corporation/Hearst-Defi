import "./portfolio.css";

import { loadPortfolioView } from "@/lib/data/portfolio-view";
import { PortfolioGreeting } from "@/components/portfolio/portfolio-greeting";
import {
  NextActionCard,
  shouldShowNextActionCard,
} from "@/components/portfolio/next-action-card";
import { ValueChart } from "@/components/portfolio/value-chart";
import { PositionsList } from "@/components/portfolio/positions-list";
import { CapitalYield } from "@/components/portfolio/capital-yield";
import { DistribCalendar } from "@/components/portfolio/distrib-calendar";
import { RecentActivity } from "@/components/portfolio/recent-activity";
import { TrustProofCompact } from "@/components/portfolio/trust-panel";
import { DemoDataBanner } from "@/components/product/demo-data-banner";
import { DEMO_SANDBOX_DISCLAIMER } from "@/lib/demo/markers";
import { HeroKpiTable } from "@/components/portfolio/hero-kpi-table";
import { HeroPayoutRail } from "@/components/portfolio/hero-payout-rail";
import { HeroLiquidityRail } from "@/components/portfolio/hero-liquidity-rail";
import {
  zeroLockMeterProps,
  zeroTimeToCashProps,
  ZERO_YIELD_STACK,
  buildZeroDistribEntries,
  zeroProofPulseProps,
} from "@/lib/portfolio/layout-preview";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Portfolio",
  description: "Your positions and distributions",
};

function displayName(
  investor: { email: string | null; walletAddress: string | null } | null,
): string {
  if (investor?.email) {
    const local = investor.email.split("@")[0] ?? "";
    if (local) return local.charAt(0).toUpperCase() + local.slice(1);
  }
  const w = investor?.walletAddress;
  if (w) return `${w.slice(0, 6)}…${w.slice(-4)}`;
  return "Investor";
}

export default async function PortfolioPage() {
  // One consolidated dashboard: the four "view more" leaf pages (Positions,
  // Yield & allocation, Distributions, Activity & trust) are composed onto this
  // single page from the shared view-model loader — no teaser placeholders. The
  // leaf routes still exist as focused/full views; every block keeps its own
  // honest empty/preview state (no fabricated Live data, APY as a range).
  const {
    investor,
    demo,
    data,
    hasPositions,
    previewZeros,
    previewAsOf,
    lockMeterProps,
    timeToCashProps,
    yieldStackProps,
    allocationDonutProps,
    distribCalendarProps,
    riskPulseProps,
    proofPulseProps,
    showDemoBanner,
    actionFlags,
  } = await loadPortfolioView();

  return (
    <div
      className={cn(
        "pf-container",
        "pf-container--fit",
        previewZeros && "pf-container--zero",
      )}
      data-testid="portfolio-page"
      data-portfolio-hub="true"
    >
      {demo ? (
        <DemoDataBanner message={DEMO_SANDBOX_DISCLAIMER} />
      ) : showDemoBanner ? (
        <DemoDataBanner />
      ) : null}

      <PortfolioGreeting name={displayName(investor)} data={data} />

      {shouldShowNextActionCard(actionFlags) && !previewZeros ? (
        <NextActionCard {...actionFlags} />
      ) : null}

      {/* ── COCKPIT BENTO — no top-level scroll: every panel shares the viewport
          height. The four leaf pages (Positions / Yield+allocation /
          Distributions / Activity+trust) are composed as panels that FIT the
          screen, not stack-and-scroll. Long panels (positions table) scroll
          inside their own cell only. ── */}
      <div className="pf-cockpit">
        {/* Row 1 — portfolio value + key metrics (welded summary) */}
        <div className="pf-cockpit-row pf-cockpit-row--summary">
          <div className="pf-hero-grid pf-cockpit-cell">
            <div className="pf-main-chart-wrapper">
              <ValueChart
                positions={data.positions}
                totalValueUsdc={data.totalValueUsdc}
                source={data.source}
                updatedAt={data.updatedAt}
                previewZeros={previewZeros}
                nextAction={previewZeros ? actionFlags : undefined}
              />
            </div>
            <aside className="pf-hero-sidebar">
              <HeroKpiTable
                totalValueUsdc={data.totalValueUsdc}
                totalYieldYtdUsdc={data.totalYieldYtdUsdc}
                nextDistributionAt={data.nextDistributionAt}
                hasPositions={hasPositions}
                source={data.source}
                updatedAt={data.updatedAt}
                previewZeros={previewZeros}
              />
              <HeroPayoutRail
                {...(previewZeros ? zeroTimeToCashProps(previewAsOf) : timeToCashProps)}
                previewZeros={previewZeros}
              />
              <HeroLiquidityRail
                {...(previewZeros ? zeroLockMeterProps(previewAsOf) : lockMeterProps)}
                previewZeros={previewZeros}
              />
            </aside>
          </div>
        </div>

        {/* Row 2 — positions table + capital & yield (wide cells: the donut +
            ledger stays side-by-side instead of stacking tall) */}
        <div className="pf-cockpit-row pf-cockpit-row--mid">
          <div className="pf-cockpit-cell" data-section="positions">
            <PositionsList
              positions={data.positions}
              source={data.source}
              updatedAt={data.updatedAt}
              previewZeros={previewZeros}
              leafHref="/portfolio/positions"
            />
          </div>
          <div
            className="pf-cockpit-cell"
            data-section="yield-allocation"
            data-testid="capital-yield-widget"
          >
            <CapitalYield
              {...(previewZeros ? ZERO_YIELD_STACK : yieldStackProps)}
              buckets={allocationDonutProps.buckets}
              totalValueUsdc={data.totalValueUsdc}
              previewZeros={previewZeros}
              leafHref="/portfolio/yield"
            />
          </div>
        </div>

        {/* Row 3 — distributions · activity · trust (3 compact panels) */}
        <div className="pf-cockpit-row pf-cockpit-row--trio">
          <div
            className="pf-cockpit-cell pf-payout-calendar-slot"
            data-section="payout-calendar"
            data-testid="distrib-calendar-widget"
          >
            <DistribCalendar
              {...distribCalendarProps}
              entries={
                previewZeros && distribCalendarProps.entries.length === 0
                  ? buildZeroDistribEntries(previewAsOf.getUTCFullYear())
                  : distribCalendarProps.entries
              }
              previewZeros={
                previewZeros && distribCalendarProps.entries.length === 0
              }
              leafHref="/portfolio/distributions"
            />
          </div>
          <div
            className="pf-cockpit-cell"
            data-section="activity-payouts"
            data-testid="recent-activity-widget"
          >
            <RecentActivity
              transactions={data.recentTransactions}
              source={data.source}
              updatedAt={data.updatedAt}
              previewZeros={previewZeros}
              leafHref="/portfolio/activity"
            />
          </div>
          <div
            className="pf-cockpit-cell"
            data-section="yield-trust"
            data-testid="trust-panel-widget"
          >
            <TrustProofCompact
              risk={riskPulseProps}
              proof={
                previewZeros ? zeroProofPulseProps(previewAsOf) : proofPulseProps
              }
              previewZeros={previewZeros}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
