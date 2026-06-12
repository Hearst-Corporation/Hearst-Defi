import "./portfolio.css";

import { loadPortfolio } from "@/lib/data/portfolio";
import { getInvestor } from "@/lib/auth/session";
import {
  loadLockMeterProps,
  loadRiskPulseProps,
  loadDistribCalendarProps,
  loadProofPulseProps,
  loadYieldStackProps,
  loadTimeToCashProps,
  resolveProvenance,
} from "@/lib/data/portfolio";
import { MergedSurface } from "@/components/portfolio/merged-surface";
import { PortfolioGreeting } from "@/components/portfolio/portfolio-greeting";
import {
  NextActionCard,
  shouldShowNextActionCard,
} from "@/components/portfolio/next-action-card";
import { AllocationDonut } from "@/components/portfolio/allocation-donut";
import { ValueChart } from "@/components/portfolio/value-chart";
import { PositionsList } from "@/components/portfolio/positions-list";
import { RecentActivity } from "@/components/portfolio/recent-activity";
import { RiskPulse } from "@/components/portfolio/risk-pulse";
import { DistribCalendar } from "@/components/portfolio/distrib-calendar";
import { ProofPulse } from "@/components/portfolio/proof-pulse";
import { YieldStack } from "@/components/portfolio/yield-stack";
import { LayoutPreviewBanner } from "@/components/portfolio/layout-preview-banner";
import { DemoDataBanner } from "@/components/product/demo-data-banner";
import { investorHasDemoPosition } from "@/lib/dev/investor-demo-visible";
import { SecurityPulse } from "@/components/portfolio/security-pulse";
import { HeroKpiTable } from "@/components/portfolio/hero-kpi-table";
import { HeroPayoutRail } from "@/components/portfolio/hero-payout-rail";
import { HeroLiquidityRail } from "@/components/portfolio/hero-liquidity-rail";
import { SectionEmbedProvider } from "@/components/ui/section-embed";
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

const previewSectionClass = "ct-section-preview--compact";

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
    showDemoBanner,
  ] = await Promise.all([
    loadLockMeterProps(),
    loadTimeToCashProps(),
    loadRiskPulseProps(),
    loadDistribCalendarProps(),
    loadProofPulseProps(),
    loadYieldStackProps(hasPositions),
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
  const sectionClass = previewZeros ? previewSectionClass : undefined;

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

      <MergedSurface
        title="Performance & Liquidity"
        provenance={portfolioProvenance}
        showProvenance={hasPositions}
        variant={sectionVariant}
        className={sectionClass}
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
      </MergedSurface>

      <div className="flex flex-col gap-4">
        <div className="dash-bento pf-secondary-grid" data-section="yield-allocation">
          <div className="bento-col-8 pf-secondary-panel" data-testid="yield-stack-widget">
            <YieldStack
              {...(previewZeros ? ZERO_YIELD_STACK : yieldStackProps)}
              previewZeros={previewZeros}
            />
          </div>
          <div className="bento-col-4 pf-secondary-panel" data-testid="allocation-donut-widget">
            <AllocationDonut
              positions={data.positions}
              totalValueUsdc={data.totalValueUsdc}
              source={data.source}
              updatedAt={data.updatedAt}
              previewZeros={previewZeros}
            />
          </div>
        </div>

        <MergedSurface
          title="Yield & Trust Pulse"
          provenance={portfolioProvenance}
          showProvenance={hasPositions}
          variant={sectionVariant}
          className={sectionClass}
          data-section="yield-trust"
        >
          <SectionEmbedProvider>
            <div className="dash-bento pf-secondary-grid">
              <div
                data-testid="risk-pulse-widget"
                className="bento-col-4 pf-compact-panel"
              >
                <RiskPulse {...riskPulseProps} previewZeros={previewZeros} />
              </div>
              <div
                data-testid="proof-pulse-widget"
                className="bento-col-4 pf-compact-panel"
              >
                <ProofPulse
                  {...(previewZeros
                    ? zeroProofPulseProps(previewAsOf)
                    : proofPulseProps)}
                  previewZeros={previewZeros}
                />
              </div>
              <div
                data-testid="security-pulse-widget"
                className="bento-col-4 pf-compact-panel"
              >
                <SecurityPulse previewZeros={previewZeros} />
              </div>
            </div>
          </SectionEmbedProvider>
        </MergedSurface>
      </div>

      <div className="flex flex-col gap-4">
        <div className="dash-bento pf-secondary-grid">
          <div className="bento-col-12 pf-secondary-panel">
            <PositionsList
              positions={data.positions}
              source={data.source}
              updatedAt={data.updatedAt}
              previewZeros={previewZeros}
            />
          </div>
        </div>

        <MergedSurface
          title="Activity & Payouts"
          provenance={portfolioProvenance}
          showProvenance={hasPositions}
          variant={sectionVariant}
          className={sectionClass}
          data-section="activity-payouts"
        >
          <SectionEmbedProvider>
            <div className="dash-bento pf-secondary-grid">
              <div className="bento-col-8 pf-secondary-panel">
                <RecentActivity
                  transactions={data.recentTransactions}
                  source={data.source}
                  updatedAt={data.updatedAt}
                  previewZeros={previewZeros}
                />
              </div>
              <div
                className="bento-col-4 pf-secondary-panel"
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
          </SectionEmbedProvider>
        </MergedSurface>
      </div>

      <footer className="border-t border-(--ct-border-soft) pt-12 pb-24">
        <p className="body-xs ct-text-muted max-w-3xl">
          Projections and estimated yields are conditional on stated assumptions
          and are <strong>not guaranteed</strong>. Past performance is not
          indicative of future results. All data is subject to the methodology
          v1.0 and latest Proof of Reserves attestation.
        </p>
      </footer>
    </div>
  );
}
