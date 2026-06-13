import "./portfolio.css";

import { loadPortfolio } from "@/lib/data/portfolio";
import { getInvestor } from "@/lib/auth/session";
import {
  loadLockMeterProps,
  loadRiskPulseProps,
  loadDistribCalendarProps,
  loadProofPulseProps,
  loadYieldStackProps,
  loadAllocationDonutProps,
  loadTimeToCashProps,
  resolveProvenance,
} from "@/lib/data/portfolio";
import { ProductSection } from "@/components/ui/product-section";
import { PortfolioGreeting } from "@/components/portfolio/portfolio-greeting";
import {
  NextActionCard,
  shouldShowNextActionCard,
} from "@/components/portfolio/next-action-card";
import { AllocationDonut } from "@/components/portfolio/allocation-donut";
import { ValueChart } from "@/components/portfolio/value-chart";
import { PositionsList } from "@/components/portfolio/positions-list";
import { RecentActivity } from "@/components/portfolio/recent-activity";
import { TrustPanel } from "@/components/portfolio/trust-panel";
import { DistribCalendar } from "@/components/portfolio/distrib-calendar";
import { YieldStack } from "@/components/portfolio/yield-stack";
import { LayoutPreviewBanner } from "@/components/portfolio/layout-preview-banner";
import { DemoDataBanner } from "@/components/product/demo-data-banner";
import { investorHasDemoPosition } from "@/lib/dev/investor-demo-visible";
import { HeroKpiTable } from "@/components/portfolio/hero-kpi-table";
import { HeroPayoutRail } from "@/components/portfolio/hero-payout-rail";
import { HeroLiquidityRail } from "@/components/portfolio/hero-liquidity-rail";
import {
  ZERO_YIELD_STACK,
  buildZeroDistribEntries,
  isLayoutPreview,
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
  const [investor, data] = await Promise.all([getInvestor(), loadPortfolio()]);

  const hasPositions = data.positions.length > 0;
  const previewZeros = isLayoutPreview(hasPositions);
  const previewAsOf = new Date();

  const [
    lockMeterProps,
    timeToCashProps,
    riskPulseProps,
    distribCalendarProps,
    proofPulseProps,
    yieldStackProps,
    allocationDonutProps,
    showDemoBanner,
  ] = await Promise.all([
    loadLockMeterProps(),
    loadTimeToCashProps(),
    loadRiskPulseProps(),
    loadDistribCalendarProps(),
    loadProofPulseProps(),
    loadYieldStackProps(hasPositions),
    loadAllocationDonutProps(hasPositions),
    investor?.id != null
      ? investorHasDemoPosition(investor.id)
      : Promise.resolve(false),
  ]);

  const actionFlags = {
    kycStatus: investor?.kycStatus ?? "pending",
    accreditationAttested: investor?.accreditationAttestedAt != null,
    hasWallet: investor?.walletAddress != null,
    positionCount: data.positions.length,
  };

  const portfolioProvenance = resolveProvenance(data.source, data.updatedAt);
  const sectionVariant = previewZeros ? "preview" : "active";

  return (
    <div
      className={cn("pf-container", previewZeros && "pf-container--zero")}
      data-testid="portfolio-page"
    >
      {showDemoBanner ? <DemoDataBanner /> : null}

      <PortfolioGreeting name={displayName(investor)} data={data} />

      {previewZeros ? <LayoutPreviewBanner /> : null}

      {shouldShowNextActionCard(actionFlags) ? (
        <NextActionCard {...actionFlags} />
      ) : null}

      <div className="dash-bento pf-secondary-grid" data-section="positions">
        <div className="bento-col-12 pf-cockpit-slot">
          <PositionsList
            positions={data.positions}
            source={data.source}
            updatedAt={data.updatedAt}
            previewZeros={previewZeros}
          />
        </div>
      </div>

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
        <div className="dash-bento pf-secondary-grid pf-hero-grid">
          <div className="bento-col-8 pf-main-chart-wrapper">
            <ValueChart
              positions={data.positions}
              totalValueUsdc={data.totalValueUsdc}
              source={data.source}
              updatedAt={data.updatedAt}
              previewZeros={previewZeros}
            />
          </div>
          <aside className="bento-col-4 pf-hero-sidebar">
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
        <div className="dash-bento pf-secondary-grid" data-section="yield-allocation">
          <div className="bento-col-8 pf-cockpit-slot" data-testid="yield-stack-widget">
            <YieldStack
              {...(previewZeros ? ZERO_YIELD_STACK : yieldStackProps)}
              previewZeros={previewZeros}
            />
          </div>
          <div className="bento-col-4 pf-cockpit-slot" data-testid="allocation-donut-widget">
            <AllocationDonut
              buckets={allocationDonutProps.buckets}
              totalValueUsdc={data.totalValueUsdc}
              source={allocationDonutProps.source}
              updatedAt={allocationDonutProps.updatedAt}
              previewZeros={previewZeros}
            />
          </div>
        </div>

        <ProductSection
          title="Yield & Trust Pulse"
          eyebrow="Trust"
          provenance={portfolioProvenance}
          showProvenance={hasPositions}
          variant={sectionVariant}
          previewLead={previewZeros ? false : undefined}
          showPreviewHead={!previewZeros}
          className="pf-yield-trust-section"
          data-section="yield-trust"
        >
          <div
            data-testid="trust-panel-widget"
            className="pf-cockpit-slot"
          >
            <TrustPanel
              risk={riskPulseProps}
              proof={previewZeros ? zeroProofPulseProps(previewAsOf) : proofPulseProps}
              previewZeros={previewZeros}
            />
          </div>
        </ProductSection>
      </div>

      <div className="pf-section-stack">
        <ProductSection
          title="Activity & Payouts"
          eyebrow="Activity"
          provenance={portfolioProvenance}
          showProvenance={hasPositions}
          variant={sectionVariant}
          previewLead={previewZeros ? false : undefined}
          showPreviewHead={!previewZeros}
          className="pf-activity-payouts-section"
          data-section="activity-payouts"
        >
          <div className="dash-bento pf-secondary-grid pf-activity-payouts-grid">
            <div
              className="bento-col-8 pf-cockpit-slot"
              data-testid="recent-activity-widget"
            >
              <RecentActivity
                transactions={data.recentTransactions}
                source={data.source}
                updatedAt={data.updatedAt}
                previewZeros={previewZeros}
              />
            </div>
            <div
              className="bento-col-4 pf-cockpit-slot"
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
        </ProductSection>
      </div>

      <footer className="pf-footer">
        <p className="pf-footer-disclaimer body-xs ct-text-muted ct-prose-xl">
          Projections and estimated yields are conditional on stated assumptions
          and are <strong>not guaranteed</strong>. Past performance is not
          indicative of future results. All data is subject to methodology v1.0
          {previewZeros
            ? " and future Proof of Reserves attestations."
            : " and the latest Proof of Reserves attestation."}
        </p>
      </footer>
    </div>
  );
}
