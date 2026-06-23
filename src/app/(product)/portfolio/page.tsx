import "./portfolio.css";

import { loadPortfolioView } from "@/lib/data/portfolio-view";
import { PortfolioGreeting } from "@/components/portfolio/portfolio-greeting";
import { ValueChart } from "@/components/portfolio/value-chart";
import { PositionsList } from "@/components/portfolio/positions-list";
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
    yieldStackProps,
    allocationDonutProps,
    distribCalendarProps,
    now,
    nextPayoutUsdc,
    proofPulseProps,
  } = await loadPortfolioView();

  // Totals pre-computed in loadPortfolio() — no client-side reduce().

  return (
    <div
      className={cn("pf-container pf-container--fit", !hasPositions && "pf-container--zero")}
      data-testid="portfolio-page"
      data-portfolio-hub="true"
    >
      <PortfolioGreeting
        name={displayName(investor)}
        now={now}
        ticker={{
          totalValueUsdc: data.totalValueUsdc,
          deployedUsdc: data.deployedUsdc,
          totalYieldYtdUsdc: data.totalYieldYtdUsdc,
          nextDistributionAt: data.nextDistributionAt,
          nextPayoutUsdc,
          blendedLow: yieldStackProps.blendedLow,
          blendedHigh: yieldStackProps.blendedHigh,
          hasPositions,
        }}
      />

      <div className="pf-hairline" aria-hidden="true" />

      <div className="pf-cockpit">
        {/* ROW 1 — HERO: Chart (50%) + Status (50%) — fused visual anchor */}
        <div className="pf-cockpit-row pf-cockpit-row--hero">
          <div className="pf-cockpit-cell pf-fused-surface pf-fused-surface--hero">
            <div className="pf-fused-surface__pane pf-fused-surface__pane--chart" data-section="chart">
              <ValueChart
                positions={data.positions}
                totalValueUsdc={data.totalValueUsdc}
                valueChartTransactions={data.valueChartTransactions}
                source={data.source}
                updatedAt={data.updatedAt}
                asOf={now}
                embedded
              />
            </div>
            <div className="pf-fused-surface__pane pf-fused-surface__pane--status" data-section="status">
              <PortfolioStatusPanel
                hasPositions={hasPositions}
                positionsCount={data.positions.length}
                deployedUsdc={data.deployedUsdc}
                totalValueUsdc={data.totalValueUsdc}
                accruedYieldUsdc={data.accruedYieldUsdc}
                source={data.source}
                proof={{
                  statedTvlUsdc: proofPulseProps.lastPor.statedTvlUsdc,
                  onChainTvlUsdc: proofPulseProps.lastPor.onChainTvlUsdc,
                  timestamp: proofPulseProps.lastPor.timestamp,
                  source: proofPulseProps.source,
                }}
                embedded
                {...(data.updatedAt ? { updatedAt: data.updatedAt } : {})}
              />
            </div>
          </div>
        </div>

        {/* ROW 2 — Positions (full-width, primary focus) */}
        <div className="pf-cockpit-row pf-cockpit-row--positions">
          <div className="pf-cockpit-cell" data-section="positions">
            <PositionsList
              positions={data.positions}
              source={data.source}
              updatedAt={data.updatedAt}
              leafHref="/portfolio/positions"
              embedded={false}
            />
          </div>
        </div>

        {/* ROW 3 — Deck: Yield (60%) | [Calendar + Activity] (40%) */}
        <div className="pf-cockpit-row pf-cockpit-row--deck">
          <div
            className="pf-cockpit-cell pf-cockpit-cell--yield"
            data-section="yield-allocation"
            data-testid="capital-yield-widget"
          >
            <CapitalYield
              {...yieldStackProps}
              buckets={allocationDonutProps.buckets}
              totalValueUsdc={data.totalValueUsdc}
              leafHref="/portfolio/yield"
              embedded
            />
          </div>
          <div className="pf-cockpit-cell pf-cockpit-cell--auxiliary" data-section="calendar-activity">
            <DistribCalendar
              {...distribCalendarProps}
              leafHref="/portfolio/distributions"
              secondaryLeafHref="/portfolio/tax"
              secondaryLeafLabel="Tax preview"
            />
            <div className="pf-auxiliary-stack">
              <RecentActivity
                transactions={data.recentTransactions}
                source={data.source}
                updatedAt={data.updatedAt}
                asOf={now}
                leafHref="/portfolio/activity"
                embedded={false}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
