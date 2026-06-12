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
import { LockMeter } from "@/components/portfolio/lock-meter";
import { TimeToCash } from "@/components/portfolio/time-to-cash";
import { RiskPulse } from "@/components/portfolio/risk-pulse";
import { DistribCalendar } from "@/components/portfolio/distrib-calendar";
import { ProofPulse } from "@/components/portfolio/proof-pulse";
import { YieldStack } from "@/components/portfolio/yield-stack";
import { LayoutPreviewBanner } from "@/components/portfolio/layout-preview-banner";
import { DemoDataBanner } from "@/components/product/demo-data-banner";
import { investorHasDemoPosition } from "@/lib/dev/investor-demo-visible";
import { SecurityPulse } from "@/components/portfolio/security-pulse";
import { MotionViewport } from "@/components/ui/motion-viewport";
import { formatUsdCompact } from "@/lib/format/usd-compact";
import { isLayoutPreview } from "@/lib/portfolio/layout-preview";

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

interface HeroKpiTableProps {
  totalValueUsdc: number;
  totalYieldYtdUsdc: number;
  nextDistributionAt: Date;
  hasPositions: boolean;
}

function HeroKpiTable({
  totalValueUsdc,
  totalYieldYtdUsdc,
  nextDistributionAt,
  hasPositions,
}: HeroKpiTableProps) {
  const fmt = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  const monthDayFmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  const now = new Date();
  const diffDays = Math.ceil(
    Math.max(0, nextDistributionAt.getTime() - now.getTime()) /
      (1000 * 60 * 60 * 24),
  );

  return (
    <div className="flex flex-col gap-6" aria-label="Key metrics summary">
      <span className="stat-label ct-text-accent">Key metrics</span>

      <div className="grid grid-cols-1 gap-6">
        <div className="flex flex-col gap-1">
          <span className="stat-label">Position value</span>
          <div className="dash-value-group">
            <span className="dash-value tabular-nums text-3xl">
              {hasPositions ? fmt.format(totalValueUsdc) : "—"}
            </span>
            <span className="dash-unit">USDC</span>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="stat-label">Yield YTD</span>
          <div className="dash-value-group">
            <span className="dash-value tabular-nums">
              {hasPositions ? formatUsdCompact(totalYieldYtdUsdc) : "—"}
            </span>
            <span className="dash-unit">USDC</span>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="stat-label">Next distribution</span>
          <div className="flex items-center justify-between gap-2 min-w-0">
            <span className="dash-value tabular-nums">
              {hasPositions ? monthDayFmt.format(nextDistributionAt) : "—"}
            </span>
            {hasPositions && diffDays > 0 ? (
              <span className="pf-chip-accent shrink-0">{diffDays}d left</span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function PortfolioPage() {
  const [investor, data] = await Promise.all([getInvestor(), loadPortfolio()]);

  const hasPositions = data.positions.length > 0;
  const isZeroPortfolio = isLayoutPreview(hasPositions);

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
  const sectionVariant = hasPositions ? "active" : "preview";

  return (
    <div
      className="pf-container"
      data-testid="portfolio-page"
    >
      {showDemoBanner ? <DemoDataBanner /> : null}

      <PortfolioGreeting name={displayName(investor)} data={data} />

      {isZeroPortfolio ? <LayoutPreviewBanner /> : null}

      {shouldShowNextActionCard(actionFlags) ? (
        <NextActionCard {...actionFlags} />
      ) : null}

      <MotionViewport>
        <MergedSurface
          title="Performance & Liquidity"
          provenance={portfolioProvenance}
          showProvenance={hasPositions}
          variant={sectionVariant}
          data-section="hero-pulse"
        >
          <div className="dash-bento">
            <div className="bento-col-8">
              <ValueChart
                positions={data.positions}
                totalValueUsdc={data.totalValueUsdc}
                source={data.source}
                updatedAt={data.updatedAt}
              />
            </div>
            <div className="bento-col-4 flex flex-col gap-6">
              <HeroKpiTable
                totalValueUsdc={data.totalValueUsdc}
                totalYieldYtdUsdc={data.totalYieldYtdUsdc}
                nextDistributionAt={data.nextDistributionAt}
                hasPositions={hasPositions}
              />
              <div className="flex flex-col gap-6 pt-6 border-t border-(--ct-border-soft)">
                <span className="stat-label ct-text-accent">Liquidity status</span>
                <TimeToCash {...timeToCashProps} />
                <LockMeter {...lockMeterProps} />
              </div>
            </div>
          </div>
        </MergedSurface>
      </MotionViewport>

      <MotionViewport>
        <div className="flex flex-col gap-4">
          <div className="dash-bento" data-section="yield-allocation">
            <div className="bento-col-8" data-testid="yield-stack-widget">
              <YieldStack {...yieldStackProps} />
            </div>
            <div className="bento-col-4" data-testid="allocation-donut-widget">
              <AllocationDonut
                positions={data.positions}
                totalValueUsdc={data.totalValueUsdc}
                source={data.source}
                updatedAt={data.updatedAt}
              />
            </div>
          </div>

          <MergedSurface
            title="Yield & Trust Pulse"
            provenance={portfolioProvenance}
            showProvenance={hasPositions}
            variant={sectionVariant}
            data-section="yield-trust"
          >
            <div className="dash-bento">
              <div
                data-testid="risk-pulse-widget"
                className="bento-col-4 flex flex-col gap-4"
              >
                <span className="stat-label ct-text-accent">Risk profile</span>
                <RiskPulse {...riskPulseProps} />
              </div>
              <div
                data-testid="proof-pulse-widget"
                className="bento-col-4 flex flex-col gap-4"
              >
                <span className="stat-label ct-text-accent">Proof of reserves</span>
                <ProofPulse {...proofPulseProps} />
              </div>
              <div
                data-testid="security-pulse-widget"
                className="bento-col-4 flex flex-col gap-4"
              >
                <span className="stat-label ct-text-accent">Security audit</span>
                <SecurityPulse />
              </div>
            </div>
          </MergedSurface>
        </div>
      </MotionViewport>

      <MotionViewport>
        <div className="flex flex-col gap-4">
          <div className="dash-bento">
            <div className="bento-col-12">
              <PositionsList
                positions={data.positions}
                source={data.source}
                updatedAt={data.updatedAt}
              />
            </div>
          </div>

          <MergedSurface
            title="Activity & Payouts"
            provenance={portfolioProvenance}
            showProvenance={hasPositions}
            variant={sectionVariant}
            data-section="activity-payouts"
          >
            <div className="dash-bento">
              <div className="bento-col-8 flex flex-col gap-4">
                <span className="stat-label ct-text-accent">Recent transactions</span>
                <RecentActivity
                  transactions={data.recentTransactions}
                  source={data.source}
                  updatedAt={data.updatedAt}
                />
              </div>
              <div
                className="bento-col-4 flex flex-col gap-4"
                data-testid="distrib-calendar-widget"
              >
                <span className="stat-label ct-text-accent">Payout calendar</span>
                <DistribCalendar {...distribCalendarProps} />
              </div>
            </div>
          </MergedSurface>
        </div>
      </MotionViewport>

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
