import "./portfolio.css";

import { loadPortfolioView } from "@/lib/data/portfolio-view";
import { PfCockpitPanel } from "@/components/portfolio/pf-cockpit-panel";
import { PortfolioGreeting } from "@/components/portfolio/portfolio-greeting";
import { ValueChart } from "@/components/portfolio/value-chart";
import { PositionCards } from "@/components/portfolio/position-badges";
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

export default async function PortfolioPage() {
  const {
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
      <PortfolioGreeting />

      <div className="pf-hairline" aria-hidden="true" />

      <div className="pf-cockpit">
        {/* HERO — Portfolio Value (chart welded with portfolio status) */}
        <section className="pf-cockpit-row pf-cockpit-row--chart" aria-label="Portfolio overview">
          <PfCockpitPanel variant="wide" aria-label="Portfolio overview hero">
            <div className="pf-hero-grid">
              <div className="pf-main-chart-wrapper">
                <ValueChart
                  positions={positions}
                  totalValueUsdc={data.totalValueUsdc}
                  valueChartTransactions={data.valueChartTransactions}
                  hourlySnapshots={data.hourlyValueSnapshots}
                  source={source}
                  updatedAt={updatedAt}
                  embedded={true}
                />
              </div>
              <PortfolioStatusPanel
                hasPositions={hasPositions}
                positionsCount={positionsCount}
                deployedUsdc={deployedUsdc}
                totalValueUsdc={data.totalValueUsdc}
                accruedYieldUsdc={accruedYieldUsdc}
                source={source}
                embedded={true}
                updatedAt={updatedAt ?? undefined}
              />
            </div>
          </PfCockpitPanel>
        </section>

        {/* NIVEAU 2 — Positions (prominent) + Capital & Yield */}
        <section
          className="pf-cockpit-row pf-cockpit-row--pair"
          aria-label="Positions and capital allocation"
        >
          <PfCockpitPanel variant="wide" aria-label="Positions and capital & yield">
            <div className="pf-pair-grid">
              <PositionCards
                positions={positions}
                leafHref="/portfolio/positions"
                embedded={true}
              />
              <CapitalYield
                {...yieldStackProps}
                buckets={allocationDonutProps.buckets}
                totalValueUsdc={data.totalValueUsdc}
                hasActivePosition={hasPositions}
                leafHref="/portfolio/yield"
                embedded={true}
              />
            </div>
          </PfCockpitPanel>
        </section>

        {/* NIVEAU 3 — Payout calendar + Recent activity (compact support) */}
        <section
          className="pf-cockpit-row pf-cockpit-row--deck"
          aria-label="Distributions and activity"
        >
          <PfCockpitPanel variant="wide" aria-label="Distributions and activity">
            <div className="pf-deck-grid">
              <DistribCalendar
                {...distribCalendarProps}
                leafHref="/portfolio/distributions"
                secondaryLeafHref="/portfolio/tax"
                secondaryLeafLabel="Tax preview"
                embedded={true}
                nextDistributionAt={data.nextDistributionAt}
                hasActivePosition={hasPositions}
              />
              <RecentActivity
                transactions={data.recentTransactions}
                source={source}
                updatedAt={updatedAt}
                leafHref="/portfolio/activity"
                embedded={true}
              />
            </div>
          </PfCockpitPanel>
        </section>
      </div>
    </div>
  );
}
