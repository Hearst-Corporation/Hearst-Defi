import "./portfolio.css";

import { loadPortfolioView } from "@/lib/data/portfolio-view";
import { PortfolioGreeting } from "@/components/portfolio/portfolio-greeting";
import { PortfolioHero } from "@/components/portfolio/portfolio-hero";
import { PositionCards } from "@/components/portfolio/position-badges";
import { CapitalYield } from "@/components/portfolio/capital-yield";
import { DistribCalendar } from "@/components/portfolio/distrib-calendar";
import { RecentActivity } from "@/components/portfolio/recent-activity";
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

  const wallet = investor?.walletAddress?.trim();
  if (wallet) {
    if (wallet.length > 10) return `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
    return wallet;
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

      <div className="pf-cockpit">
        <section className="pf-cockpit-row pf-cockpit-row--chart" aria-label="Portfolio overview">
          <PortfolioHero
            hasPositions={hasPositions}
            positions={positions}
            totalValueUsdc={data.totalValueUsdc}
            deployedUsdc={deployedUsdc}
            accruedYieldUsdc={accruedYieldUsdc}
            positionsCount={positionsCount}
            source={source}
            updatedAt={updatedAt}
            valueChartTransactions={data.valueChartTransactions}
            hourlySnapshots={data.hourlyValueSnapshots}
          />
        </section>

        <section
          className="pf-cockpit-row pf-cockpit-row--yield"
          aria-label="Capital and yield allocation"
        >
          <div className="pf-cockpit-cell">
            <CapitalYield
              {...yieldStackProps}
              buckets={allocationDonutProps.buckets}
              totalValueUsdc={data.totalValueUsdc}
              hasActivePosition={hasPositions}
              source={source === "live" ? "live" : "estimated"}
              updatedAt={updatedAt}
              leafHref="/portfolio/yield"
              embedded={false}
            />
          </div>
        </section>

        <section
          className="pf-cockpit-row pf-cockpit-row--deck"
          aria-label="Portfolio distributions and activity"
        >
          <div className="pf-deck-grid">
            <DistribCalendar
              {...distribCalendarProps}
              leafHref="/portfolio/distributions"
              secondaryLeafHref="/portfolio/tax"
              secondaryLeafLabel="Tax preview"
              embedded={false}
              nextDistributionAt={data.nextDistributionAt}
              hasActivePosition={hasPositions}
            />
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
            <PositionCards
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
