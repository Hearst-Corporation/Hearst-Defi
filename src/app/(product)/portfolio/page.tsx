import "./portfolio.css";

import { loadPortfolioView } from "@/lib/data/portfolio-view";
import { ProductSection } from "@/components/ui/product-section";
import { PortfolioGreeting } from "@/components/portfolio/portfolio-greeting";
import {
  NextActionCard,
  shouldShowNextActionCard,
} from "@/components/portfolio/next-action-card";
import { ValueChart } from "@/components/portfolio/value-chart";
import { PortfolioTeaserTile } from "@/components/portfolio/portfolio-teaser-tile";
import { DemoDataBanner } from "@/components/product/demo-data-banner";
import { DEMO_SANDBOX_DISCLAIMER } from "@/lib/demo/markers";
import { HeroKpiTable } from "@/components/portfolio/hero-kpi-table";
import { HeroPayoutRail } from "@/components/portfolio/hero-payout-rail";
import { HeroLiquidityRail } from "@/components/portfolio/hero-liquidity-rail";
import {
  zeroLockMeterProps,
  zeroTimeToCashProps,
} from "@/lib/portfolio/layout-preview";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Portfolio",
  description: "Your positions and distributions",
};

const usd0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const monthDay = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

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
  // All demo + previewZeros + provenance + widget-props wiring lives in the
  // shared view-model loader (one source of truth across the dashboard and the
  // "view more" leaf pages). Honesty invariants are preserved there verbatim.
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
    distribCalendarProps,
    showDemoBanner,
    actionFlags,
    portfolioProvenance,
    sectionVariant,
  } = await loadPortfolioView();

  // No-scroll dashboard: the heavy blocks live on the /portfolio/<x> leaf
  // pages; the top level surfaces an honest one-figure teaser per leaf. Calm
  // copy when there is no live data — never a fabricated value.
  const positionCount = data.positions.length;
  const yieldLive =
    yieldStackProps.source === "live" && yieldStackProps.blendedHigh > 0;
  const txCount = data.recentTransactions.length;

  return (
    <div
      className={cn("pf-container", previewZeros && "pf-container--zero")}
      data-testid="portfolio-page"
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

      <ProductSection
        title="Performance & Liquidity"
        eyebrow="Portfolio"
        provenance={portfolioProvenance}
        showProvenance={hasPositions}
        variant={sectionVariant}
        previewLead={previewZeros ? false : undefined}
        showPreviewHead={!previewZeros}
        className="pf-hero-section"
        data-section="hero-pulse"
      >
        <div className="pf-hero-grid">
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
      </ProductSection>

      <div className="pf-teaser-grid">
        <PortfolioTeaserTile
          href="/portfolio/positions"
          label="Positions"
          moreLabel="View all"
          value={
            hasPositions
              ? `${positionCount} ${positionCount === 1 ? "position" : "positions"}`
              : "No open positions"
          }
          meta={
            hasPositions
              ? `${usd0.format(data.totalValueUsdc)} total value`
              : "Start investing"
          }
        />
        <PortfolioTeaserTile
          href="/portfolio/yield"
          label="Yield & allocation"
          moreLabel="Detail"
          value={
            yieldLive
              ? `${yieldStackProps.blendedLow}–${yieldStackProps.blendedHigh}%`
              : "Pending"
          }
          meta={yieldLive ? "Blended APY range" : "Awaiting allocation"}
        />
        <PortfolioTeaserTile
          href="/portfolio/distributions"
          label="Distributions"
          moreLabel="Calendar"
          value={`Next ${monthDay.format(data.nextDistributionAt)}`}
          meta={distribCalendarProps.cadence ?? "Monthly distributions"}
        />
        <PortfolioTeaserTile
          href="/portfolio/activity"
          label="Activity"
          moreLabel="View all"
          value={txCount > 0 ? `${txCount} recent` : "No activity yet"}
          meta={
            txCount > 0 ? "Deposits & distributions" : "Your timeline appears here"
          }
        />
      </div>
    </div>
  );
}
