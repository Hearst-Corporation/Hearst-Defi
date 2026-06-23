import "./portfolio.css";

import { loadPortfolioView } from "@/lib/data/portfolio-view";
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
        <section className="pf-cockpit-row pf-cockpit-row--chart" aria-label="Portfolio value">
          <div className="pf-cockpit-cell" data-section="value-chart">
            <ValueChart
              positions={positions}
              totalValueUsdc={data.totalValueUsdc}
              valueChartTransactions={data.valueChartTransactions}
              source={source}
              updatedAt={updatedAt}
              embedded={false}
            />
          </div>
        </section>

        <section className="pf-cockpit-row pf-cockpit-row--mid" aria-label="Capital yield and status">
          <div className="pf-fused-surface pf-fused-surface--mid">
            <div className="pf-fused-surface__pane">
              <CapitalYield
                {...yieldStackProps}
                buckets={allocationDonutProps.buckets}
                totalValueUsdc={data.totalValueUsdc}
                leafHref="/portfolio/yield"
                embedded={true}
              />
            </div>
            <div className="pf-fused-surface__pane pf-fused-surface__pane--aside">
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
          </div>
        </section>

        <section
          className="pf-cockpit-row pf-cockpit-row--deck"
          aria-label="Portfolio distributions and activity"
        >
          <div className="pf-fused-surface pf-fused-surface--deck">
            <div className="pf-fused-surface__pane">
              <DistribCalendar
                {...distribCalendarProps}
                leafHref="/portfolio/distributions"
                secondaryLeafHref="/portfolio/tax"
                secondaryLeafLabel="Tax preview"
                embedded={true}
              />
            </div>
            <div className="pf-fused-surface__pane pf-fused-surface__pane--aside">
              <RecentActivity
                transactions={data.recentTransactions}
                source={source}
                updatedAt={updatedAt}
                leafHref="/portfolio/activity"
                embedded={true}
              />
            </div>
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
