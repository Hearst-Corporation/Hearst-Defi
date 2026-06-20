import "./portfolio.css";

import { loadPortfolioView } from "@/lib/data/portfolio-view";
import { PortfolioGreeting } from "@/components/portfolio/portfolio-greeting";
import { ValueChart } from "@/components/portfolio/value-chart";
import { PositionsList } from "@/components/portfolio/positions-list";
import { CapitalYield } from "@/components/portfolio/capital-yield";
import { DistribCalendar } from "@/components/portfolio/distrib-calendar";
import { RecentActivity } from "@/components/portfolio/recent-activity";
import { TrustProofCompact } from "@/components/portfolio/trust-panel";
import { PortfolioStatusPanel } from "@/components/portfolio/portfolio-status-panel";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Portfolio",
  description: "Your positions and distributions",
};

export default async function PortfolioPage() {
  const {
    data,
    hasPositions,
    yieldStackProps,
    allocationDonutProps,
    distribCalendarProps,
    riskPulseProps,
    proofPulseProps,
  } = await loadPortfolioView();

  const deployedUsdc = data.positions.reduce((s, p) => s + p.principalUsdc, 0);
  const accruedYieldUsdc = data.positions.reduce((s, p) => s + p.accruedYieldUsdc, 0);

  return (
    <div
      className={cn("pf-container pf-container--fit", !hasPositions && "pf-container--zero")}
      data-testid="portfolio-page"
      data-portfolio-hub="true"
    >
      <PortfolioGreeting
        name="Investor"
        ticker={{
          totalValueUsdc: data.totalValueUsdc,
          totalYieldYtdUsdc: data.totalYieldYtdUsdc,
          nextDistributionAt: data.nextDistributionAt,
          blendedLow: yieldStackProps.blendedLow,
          blendedHigh: yieldStackProps.blendedHigh,
          hasPositions,
        }}
      />

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
            <PortfolioStatusPanel
              hasPositions={hasPositions}
              positionsCount={data.positions.length}
              deployedUsdc={deployedUsdc}
              totalValueUsdc={data.totalValueUsdc}
              accruedYieldUsdc={accruedYieldUsdc}
              netDepositsUsdc={deployedUsdc}
              source={data.source}
              {...(data.updatedAt ? { updatedAt: data.updatedAt } : {})}
            />
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

        <div className="pf-cockpit-row pf-cockpit-row--deck">
          <div
            className="pf-cockpit-cell"
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
