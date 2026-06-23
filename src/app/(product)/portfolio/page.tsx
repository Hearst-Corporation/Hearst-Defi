import "./portfolio.css";

import { loadPortfolioView } from "@/lib/data/portfolio-view";
import { PortfolioGreeting } from "@/components/portfolio/portfolio-greeting";
import { ValueChart } from "@/components/portfolio/value-chart";
import { PositionBadges } from "@/components/portfolio/position-badges";
import { CapitalYield } from "@/components/portfolio/capital-yield";
import { DistribCalendar } from "@/components/portfolio/distrib-calendar";
import { RecentActivity } from "@/components/portfolio/recent-activity";
import { PortfolioStatusPanel } from "@/components/portfolio/portfolio-status-panel";
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
    const emailLocal = investor.email.split("@")[0]?.trim() ?? "";
    const normalizedLocal = emailLocal.replace(/[._-]+/g, " ").trim();
    if (normalizedLocal) {
      return normalizedLocal.charAt(0).toUpperCase() + normalizedLocal.slice(1);
    }
  }
  const w = investor?.walletAddress;
  if (w) {
    const wallet = w.trim();
    if (wallet.length > 10) return `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
    if (wallet.length > 0) return wallet;
  }
  return "Investor";
}

export default async function PortfolioPage() {
  const {
    investor,
    data,
    hasPositions,
    yieldStackProps,
    allocationDonutProps,
    distribCalendarProps,
  } = await loadPortfolioView();

  const { deployedUsdc, accruedYieldUsdc, positions, source, updatedAt } = data;
  const positionsCount = positions.length;
  const containerClassName = cn(
    "pf-container",
    !hasPositions && "pf-container--zero",
  );

  return (
    <div className={containerClassName} data-testid="portfolio-page" data-portfolio-hub="true">
      <PortfolioGreeting name={displayName(investor)} />

      <div className="pf-hairline" aria-hidden="true" />

      <div className="pf-cockpit">
        <section className="pf-cockpit-row pf-cockpit-row--summary" aria-label="Portfolio summary">
          <div className="pf-hero-grid pf-cockpit-cell">
            <div className="pf-main-chart-wrapper">
              <ValueChart
                positions={positions}
                totalValueUsdc={data.totalValueUsdc}
                valueChartTransactions={data.valueChartTransactions}
                source={source}
                updatedAt={updatedAt}
                embedded
              />
            </div>
            <PortfolioStatusPanel
              hasPositions={hasPositions}
              positionsCount={positionsCount}
              deployedUsdc={deployedUsdc}
              totalValueUsdc={data.totalValueUsdc}
              accruedYieldUsdc={accruedYieldUsdc}
              source={source}
              embedded
              updatedAt={updatedAt ?? undefined}
            />
          </div>
        </section>

        <section className="pf-cockpit-row pf-cockpit-row--mid" aria-label="Capital and yield">
          <div className="pf-cockpit-cell" data-section="yield-allocation" data-testid="capital-yield-widget">
            <CapitalYield
              {...yieldStackProps}
              buckets={allocationDonutProps.buckets}
              totalValueUsdc={data.totalValueUsdc}
              leafHref="/portfolio/yield"
              embedded={false}
            />
          </div>
        </section>

        <section
          className="pf-cockpit-row pf-cockpit-row--deck"
          aria-label="Portfolio distributions and activity"
        >
          <div
            className="pf-cockpit-cell"
            data-section="payout-calendar"
            data-testid="distrib-calendar-widget"
          >
            <DistribCalendar
              {...distribCalendarProps}
              leafHref="/portfolio/distributions"
              secondaryLeafHref="/portfolio/tax"
              secondaryLeafLabel="Tax preview"
            />
          </div>
          <div
            className="pf-cockpit-cell"
            data-section="activity"
            data-testid="recent-activity-widget"
          >
            <RecentActivity
              transactions={data.recentTransactions}
              source={source}
              updatedAt={updatedAt}
              leafHref="/portfolio/activity"
              embedded={false}
            />
          </div>
        </section>

        <section className="pf-cockpit-row pf-cockpit-row--positions" aria-label="Your positions">
          <div className="pf-cockpit-cell" data-section="positions">
            <PositionBadges
              positions={positions}
              leafHref="/portfolio/positions"
              embedded={false}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
