import "./portfolio.css";

import { loadPortfolioView } from "@/lib/data/portfolio-view";
import { PortfolioGreeting } from "@/components/portfolio/portfolio-greeting";
import { ValueChart } from "@/components/portfolio/value-chart";
import { PositionsList } from "@/components/portfolio/positions-list";
import { CapitalYield } from "@/components/portfolio/capital-yield";
import { DistribCalendar } from "@/components/portfolio/distrib-calendar";
import { RecentActivity } from "@/components/portfolio/recent-activity";
import { TrustProofCompact } from "@/components/portfolio/trust-panel";
import { HeroKpiTable } from "@/components/portfolio/hero-kpi-table";
import { HeroPayoutRail } from "@/components/portfolio/hero-payout-rail";
import { HeroLiquidityRail } from "@/components/portfolio/hero-liquidity-rail";

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
  const {
    investor,
    data,
    hasPositions,
    lockMeterProps,
    timeToCashProps,
    yieldStackProps,
    allocationDonutProps,
    distribCalendarProps,
    riskPulseProps,
    proofPulseProps,
  } = await loadPortfolioView();

  return (
    <div
      className="pf-container pf-container--fit"
      data-testid="portfolio-page"
      data-portfolio-hub="true"
    >
      <PortfolioGreeting name={displayName(investor)} />

      <div className="pf-cockpit">
        <div className="pf-cockpit-row pf-cockpit-row--summary">
          <div className="pf-hero-grid pf-cockpit-cell">
            <div className="pf-main-chart-wrapper">
              <ValueChart
                positions={data.positions}
                totalValueUsdc={data.totalValueUsdc}
                source={data.source}
                updatedAt={data.updatedAt}
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
              />
              <HeroPayoutRail {...timeToCashProps} />
              <HeroLiquidityRail {...lockMeterProps} />
            </aside>
          </div>
        </div>

        <div className="pf-cockpit-row pf-cockpit-row--mid">
          <div className="pf-cockpit-cell" data-section="positions">
            <PositionsList
              positions={data.positions}
              source={data.source}
              updatedAt={data.updatedAt}
              leafHref="/portfolio/positions"
            />
          </div>
          <div
            className="pf-cockpit-cell"
            data-section="yield-allocation"
            data-testid="capital-yield-widget"
          >
            <CapitalYield
              {...yieldStackProps}
              buckets={allocationDonutProps.buckets}
              totalValueUsdc={data.totalValueUsdc}
              leafHref="/portfolio/yield"
            />
          </div>
        </div>

        <div className="pf-cockpit-row pf-cockpit-row--trio">
          <div
            className="pf-cockpit-cell pf-payout-calendar-slot"
            data-section="payout-calendar"
            data-testid="distrib-calendar-widget"
          >
            <DistribCalendar
              {...distribCalendarProps}
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
              leafHref="/portfolio/activity"
            />
          </div>
          <div
            className="pf-cockpit-cell"
            data-section="yield-trust"
            data-testid="trust-panel-widget"
          >
            <TrustProofCompact risk={riskPulseProps} proof={proofPulseProps} />
          </div>
        </div>
      </div>
    </div>
  );
}
