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
import {
  ZERO_YIELD_STACK,
  isLayoutPreview,
  isProofPulseEmpty,
  isRiskPulseEmpty,
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

interface HeroKpiTableProps {
  totalValueUsdc: number;
  totalYieldYtdUsdc: number;
  nextDistributionAt: Date;
  hasPositions: boolean;
  /** Layout preview: $0 and scheduled date instead of em-dashes. */
  previewZeros?: boolean;
}

function HeroKpiTable({
  totalValueUsdc,
  totalYieldYtdUsdc,
  nextDistributionAt,
  hasPositions,
  previewZeros = false,
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

  const showValues = hasPositions || previewZeros;

  return (
    <div className="flex flex-col gap-6" aria-label="Key metrics summary">
      <span className="stat-label ct-text-accent">Key metrics</span>

      <div className="grid grid-cols-1 gap-6">
        <div className="flex flex-col gap-1">
          <span className="stat-label">Position value</span>
          <div className="dash-value-group">
            <span className="dash-value tabular-nums text-3xl">
              {showValues
                ? fmt.format(previewZeros ? 0 : totalValueUsdc)
                : "—"}
            </span>
            <span className="dash-unit">USDC</span>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="stat-label">Yield YTD</span>
          <div className="dash-value-group">
            <span className="dash-value tabular-nums">
              {showValues
                ? formatUsdCompact(previewZeros ? 0 : totalYieldYtdUsdc)
                : "—"}
            </span>
            <span className="dash-unit">USDC</span>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="stat-label">Next distribution</span>
          <div className="flex items-center justify-between gap-2 min-w-0">
            <span className="dash-value tabular-nums">
              {showValues ? monthDayFmt.format(nextDistributionAt) : "—"}
            </span>
            {hasPositions && diffDays > 0 ? (
              <span className="pf-chip-accent shrink-0">{diffDays}d left</span>
            ) : previewZeros ? (
              <span className="body-xs ct-text-faint shrink-0">Preview</span>
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

  const portfolioProvenance = resolveProvenance(
    previewZeros ? "stale" : data.source,
    data.updatedAt,
  );

  const yieldStack =
    previewZeros && yieldStackProps.sources.length === 0
      ? ZERO_YIELD_STACK
      : yieldStackProps;

  const riskPulse =
    previewZeros && isRiskPulseEmpty(riskPulseProps)
      ? { ...riskPulseProps, source: "stale" as const }
      : riskPulseProps;

  const proofPulse =
    previewZeros && isProofPulseEmpty(proofPulseProps)
      ? zeroProofPulseProps(previewAsOf)
      : proofPulseProps;

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

      <MotionViewport>
        <MergedSurface
          title="Performance & Liquidity"
          provenance={portfolioProvenance}
          showProvenance
          data-section="hero-pulse"
        >
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-8">
              <ValueChart
                positions={data.positions}
                totalValueUsdc={data.totalValueUsdc}
                source={data.source}
                updatedAt={data.updatedAt}
                previewZeros={previewZeros}
              />
            </div>
            <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
              <HeroKpiTable
                totalValueUsdc={data.totalValueUsdc}
                totalYieldYtdUsdc={data.totalYieldYtdUsdc}
                nextDistributionAt={data.nextDistributionAt}
                hasPositions={hasPositions}
                previewZeros={previewZeros}
              />
              <div className="flex flex-col gap-6 pt-6 border-t border-(--ct-border-soft)">
                <span className="stat-label ct-text-accent">Liquidity status</span>
                <TimeToCash
                  {...(previewZeros ? zeroTimeToCashProps(previewAsOf) : timeToCashProps)}
                  previewZeros={previewZeros}
                />
                <LockMeter
                  {...(previewZeros ? zeroLockMeterProps(previewAsOf) : lockMeterProps)}
                  previewZeros={previewZeros}
                />
              </div>
            </div>
          </div>
        </MergedSurface>
      </MotionViewport>

      <MotionViewport>
        <div className="flex flex-col gap-4">
          <div className="dash-bento" data-section="yield-allocation">
            <div className="bento-col-8" data-testid="yield-stack-widget">
              <YieldStack
                {...yieldStack}
                previewZeros={previewZeros && yieldStackProps.sources.length === 0}
              />
            </div>
            <div className="bento-col-4" data-testid="allocation-donut-widget">
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
            showProvenance
            data-section="yield-trust"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div data-testid="risk-pulse-widget" className="flex flex-col gap-4">
                <span className="stat-label ct-text-accent">Risk profile</span>
                <RiskPulse
                  {...riskPulse}
                  previewZeros={previewZeros && isRiskPulseEmpty(riskPulseProps)}
                />
              </div>
              <div data-testid="proof-pulse-widget" className="flex flex-col gap-4">
                <span className="stat-label ct-text-accent">Proof of reserves</span>
                <ProofPulse
                  {...proofPulse}
                  previewZeros={previewZeros && isProofPulseEmpty(proofPulseProps)}
                />
              </div>
              <div data-testid="security-pulse-widget" className="flex flex-col gap-4">
                <span className="stat-label ct-text-accent">Security audit</span>
                <SecurityPulse embedded previewZeros={previewZeros} />
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
                previewZeros={previewZeros}
              />
            </div>
          </div>

          <MergedSurface
            title="Activity & Payouts"
            provenance={portfolioProvenance}
            showProvenance
            data-section="activity-payouts"
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 flex flex-col gap-4">
                <span className="stat-label ct-text-accent">Recent transactions</span>
                <RecentActivity
                  transactions={data.recentTransactions}
                  source={data.source}
                  updatedAt={data.updatedAt}
                  previewZeros={previewZeros}
                  embedded
                />
              </div>
              <div
                className="lg:col-span-4 flex flex-col gap-4"
                data-testid="distrib-calendar-widget"
              >
                <span className="stat-label ct-text-accent">Payout calendar</span>
                <DistribCalendar
                  {...distribCalendarProps}
                  previewZeros={
                    previewZeros && distribCalendarProps.entries.length === 0
                  }
                />
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
