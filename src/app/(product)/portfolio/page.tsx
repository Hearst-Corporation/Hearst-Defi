import "./portfolio.css";

import { loadPortfolioView } from "@/lib/data/portfolio-view";
import { ProductSection } from "@/components/ui/product-section";
import { PortfolioGreeting } from "@/components/portfolio/portfolio-greeting";
import {
  NextActionCard,
  shouldShowNextActionCard,
} from "@/components/portfolio/next-action-card";
import { ValueChart } from "@/components/portfolio/value-chart";
import { PositionsList } from "@/components/portfolio/positions-list";
import { RecentActivity } from "@/components/portfolio/recent-activity";
import { TrustProofCompact } from "@/components/portfolio/trust-panel";
import { DistribCalendar } from "@/components/portfolio/distrib-calendar";
import { CapitalYield } from "@/components/portfolio/capital-yield";
import { DemoDataBanner } from "@/components/product/demo-data-banner";
import { DEMO_SANDBOX_DISCLAIMER } from "@/lib/demo/markers";
import { HeroKpiTable } from "@/components/portfolio/hero-kpi-table";
import { HeroPayoutRail } from "@/components/portfolio/hero-payout-rail";
import { HeroLiquidityRail } from "@/components/portfolio/hero-liquidity-rail";
import {
  ZERO_YIELD_STACK,
  buildZeroDistribEntries,
  zeroLockMeterProps,
  zeroProofPulseProps,
  zeroTimeToCashProps,
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
    riskPulseProps,
    distribCalendarProps,
    proofPulseProps,
    yieldStackProps,
    allocationDonutProps,
    showDemoBanner,
    actionFlags,
    portfolioProvenance,
    sectionVariant,
  } = await loadPortfolioView();

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

      <div className="pf-section-stack">
        <div
          data-section="yield-allocation"
          data-testid="capital-yield-widget"
        >
          <CapitalYield
            {...(previewZeros ? ZERO_YIELD_STACK : yieldStackProps)}
            buckets={allocationDonutProps.buckets}
            totalValueUsdc={data.totalValueUsdc}
            previewZeros={previewZeros}
          />
        </div>

        <div data-section="positions">
          <PositionsList
            positions={data.positions}
            source={data.source}
            updatedAt={data.updatedAt}
            previewZeros={previewZeros}
          />
        </div>

        <ProductSection
          title="Activity & trust"
          eyebrow="Activity"
          provenance={portfolioProvenance}
          showProvenance={hasPositions}
          variant={sectionVariant}
          previewLead={previewZeros ? false : undefined}
          showPreviewHead={!previewZeros}
          className="pf-activity-payouts-section"
          data-section="activity-payouts"
        >
          <div className="pf-activity-grid">
            <div className="pf-activity-grid__cell" data-testid="recent-activity-widget">
              <RecentActivity
                transactions={data.recentTransactions}
                source={data.source}
                updatedAt={data.updatedAt}
                previewZeros={previewZeros}
              />
            </div>
            <div
              className="pf-activity-grid__cell"
              data-section="yield-trust"
              data-testid="trust-panel-widget"
            >
              <TrustProofCompact
                risk={riskPulseProps}
                proof={previewZeros ? zeroProofPulseProps(previewAsOf) : proofPulseProps}
                previewZeros={previewZeros}
              />
            </div>
          </div>
        </ProductSection>

        <div
          className="pf-payout-calendar-slot"
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
          />
        </div>
      </div>
    </div>
  );
}
