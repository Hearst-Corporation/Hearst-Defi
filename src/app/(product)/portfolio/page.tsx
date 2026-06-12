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
import { AwaitingMetricState } from "@/components/portfolio/awaiting-metric-state";
import { YieldStack } from "@/components/portfolio/yield-stack";
import { DemoDataBanner } from "@/components/product/demo-data-banner";
import { investorHasDemoPosition } from "@/lib/dev/investor-demo-visible";
import { SecurityPulse } from "@/components/portfolio/security-pulse";
import { MotionViewport } from "@/components/ui/motion-viewport";
import { formatUsdCompact } from "@/lib/format/usd-compact";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Portfolio",
  description: "Your positions and distributions",
};

/** Derive a friendly display name from the investor identity. */
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
  compact?: boolean;
}

function HeroKpiTable({
  totalValueUsdc,
  totalYieldYtdUsdc,
  nextDistributionAt,
  hasPositions,
  compact = false,
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
  const diffTime = Math.max(0, nextDistributionAt.getTime() - now.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return (
    <div
      className={cn("flex flex-col", compact ? "gap-3" : "gap-6")}
      aria-label="Key metrics summary"
    >
      <span className="stat-label ct-text-accent">Key metrics</span>

      <div
        className={cn(
          "grid gap-4",
          compact ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 gap-6",
        )}
      >
        <div className="flex flex-col gap-1">
          <span className="stat-label">Position value</span>
          <div className="dash-value-group">
            <span
              className={cn(
                "dash-value tabular-nums",
                compact ? "text-xl" : "text-3xl",
              )}
            >
              {totalValueUsdc > 0 ? fmt.format(totalValueUsdc) : "—"}
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
            ) : !hasPositions ? (
              <span className="body-xs ct-text-faint shrink-0">After first position</span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Compact trust preview rows — zero-position only (no large empty cards). */
function ZeroTrustRows() {
  const rows = [
    {
      id: "risk-pulse-widget",
      label: "Risk profile",
      hint: "Risk scores will appear after the first snapshot.",
    },
    {
      id: "proof-pulse-widget",
      label: "Proof of reserves",
      hint: "No attestation published yet — appears after vault activity is attested.",
    },
    {
      id: "security-pulse-widget",
      label: "Security audit",
      hint: "Security status will appear after account verification.",
    },
  ] as const;

  return (
    <ul className="pf-zero-trust-list">
      {rows.map((row) => (
        <li key={row.id} data-testid={row.id} className="pf-zero-trust-row">
          <span className="stat-label ct-text-accent">{row.label}</span>
          <p className="body-xs ct-text-faint m-0">{row.hint}</p>
        </li>
      ))}
    </ul>
  );
}

export default async function PortfolioPage() {
  const [investor, loadedData] = await Promise.all([
    getInvestor(),
    loadPortfolio(),
  ]);

  const data = loadedData;
  const hasPositions = data.positions.length > 0;

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

  const name = displayName(investor);

  /** Both widgets empty — skip fake 8/4 chart/donut placeholders (DS §9). */
  const yieldAllocationRowEmpty =
    yieldStackProps.sources.length === 0 && data.totalValueUsdc <= 0;

  const actionFlags = {
    kycStatus: investor?.kycStatus ?? "pending",
    accreditationAttested: investor?.accreditationAttestedAt != null,
    hasWallet: investor?.walletAddress != null,
    positionCount: data.positions.length,
  };

  const portfolioProvenance = resolveProvenance(data.source, data.updatedAt);
  const showNextAction = shouldShowNextActionCard(actionFlags);
  const useLightSections = !hasPositions;
  const activityPayoutsEmpty =
    data.recentTransactions.length === 0 && distribCalendarProps.entries.length === 0;

  return (
    <div
      className={cn("pf-container", !hasPositions && "pf-container--zero")}
      data-testid="portfolio-page"
    >
      {showDemoBanner ? <DemoDataBanner /> : null}

      <PortfolioGreeting name={name} data={data} />

      {showNextAction ? <NextActionCard {...actionFlags} /> : null}

      <MotionViewport>
        {useLightSections ? (
          <section
            data-section="hero-pulse"
            className="pf-section-light pf-section-light--compact"
            aria-label="Performance and liquidity"
          >
            <div className="pf-zero-section-head">
              <h3 className="h3 m-0">Performance &amp; Liquidity</h3>
              <p className="pf-zero-lead body-sm ct-text-muted m-0">
                Value trend, payout timing, and lock progress populate after your
                first active position.
              </p>
            </div>
            <div className="pf-zero-hero-body">
              <HeroKpiTable
                totalValueUsdc={data.totalValueUsdc}
                totalYieldYtdUsdc={data.totalYieldYtdUsdc}
                nextDistributionAt={data.nextDistributionAt}
                hasPositions={hasPositions}
                compact
              />
              <div className="pf-zero-liquidity">
                <span className="stat-label ct-text-accent">Liquidity status</span>
                <div className="pf-zero-await" data-testid="liquidity-awaiting">
                  <AwaitingMetricState
                    message="Distribution cycle and lock terms appear after your first active position."
                    detail="Payout timing, soft lock-up progress, and unlock dates populate once share-class terms are confirmed."
                  />
                </div>
              </div>
            </div>
          </section>
        ) : (
          <MergedSurface
            title="Performance & Liquidity"
            provenance={portfolioProvenance}
            showProvenance
            data-section="hero-pulse"
          >
            <div className="grid grid-cols-12 gap-8">
              <div className="col-span-12 lg:col-span-8">
                <ValueChart
                  positions={data.positions}
                  totalValueUsdc={data.totalValueUsdc}
                  source={data.source}
                  updatedAt={data.updatedAt}
                />
              </div>
              <div className="col-span-12 lg:col-span-4 flex flex-col gap-8">
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
        )}
      </MotionViewport>

      <MotionViewport>
        <div className="flex flex-col gap-4">
          <div className="dash-bento" data-section="yield-allocation">
            {yieldAllocationRowEmpty ? (
              <div
                className="bento-col-12 pf-zero-await"
                data-testid="yield-allocation-empty"
              >
                <AwaitingMetricState
                  message="Yield and allocation appear after your first active position."
                  detail="The forward yield stack and position breakdown populate once deposited capital is confirmed."
                />
              </div>
            ) : (
              <>
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
              </>
            )}
          </div>

          {useLightSections ? (
            <section
              data-section="yield-trust"
              className="pf-section-light pf-section-light--compact"
              aria-label="Yield and trust pulse"
            >
              <div className="pf-zero-section-head">
                <h3 className="h3 m-0">Yield &amp; Trust Pulse</h3>
                <p className="pf-zero-lead body-sm ct-text-muted m-0">
                  Risk, proof, and security signals unlock as the vault operates
                  and your account is verified.
                </p>
              </div>
              <ZeroTrustRows />
            </section>
          ) : (
            <MergedSurface
              title="Yield & Trust Pulse"
              provenance={portfolioProvenance}
              showProvenance
              data-section="yield-trust"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                <div data-testid="risk-pulse-widget" className="flex flex-col gap-4">
                  <span className="stat-label ct-text-accent">Risk profile</span>
                  <RiskPulse {...riskPulseProps} />
                </div>
                <div data-testid="proof-pulse-widget" className="flex flex-col gap-4">
                  <span className="stat-label ct-text-accent">Proof of reserves</span>
                  <ProofPulse {...proofPulseProps} />
                </div>
                <div data-testid="security-pulse-widget" className="flex flex-col gap-4">
                  <span className="stat-label ct-text-accent">Security audit</span>
                  <SecurityPulse />
                </div>
              </div>
            </MergedSurface>
          )}
        </div>
      </MotionViewport>

      <MotionViewport>
        <div className="flex flex-col gap-4">
          {hasPositions ? (
            <div className="dash-bento">
              <div className="bento-col-12">
                <PositionsList
                  positions={data.positions}
                  source={data.source}
                  updatedAt={data.updatedAt}
                />
              </div>
            </div>
          ) : null}

          {useLightSections ? (
            <section
              data-section="activity-payouts"
              className="pf-section-light pf-section-light--compact"
              aria-label="Activity and payouts"
            >
              <div className="pf-zero-section-head">
                <h3 className="h3 m-0">Activity &amp; Payouts</h3>
              </div>
              {activityPayoutsEmpty ? (
                <div className="pf-zero-await" data-testid="activity-payouts-empty">
                  <AwaitingMetricState
                    message="Transactions and payout history appear after your first active position."
                    detail="Recent deposits, distributions, and the payout calendar populate once capital is active."
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-8 flex flex-col gap-3">
                    <span className="stat-label ct-text-accent">Recent transactions</span>
                    <RecentActivity
                      transactions={data.recentTransactions}
                      source={data.source}
                      updatedAt={data.updatedAt}
                    />
                  </div>
                  <div
                    className="lg:col-span-4 flex flex-col gap-3"
                    data-testid="distrib-calendar-widget"
                  >
                    <span className="stat-label ct-text-accent">Payout calendar</span>
                    <DistribCalendar {...distribCalendarProps} />
                  </div>
                </div>
              )}
            </section>
          ) : (
            <MergedSurface
              title="Activity & Payouts"
              provenance={portfolioProvenance}
              showProvenance
              data-section="activity-payouts"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                <div className="lg:col-span-8 flex flex-col gap-4">
                  <span className="stat-label ct-text-accent">Recent transactions</span>
                  <RecentActivity
                    transactions={data.recentTransactions}
                    source={data.source}
                    updatedAt={data.updatedAt}
                  />
                </div>
                <div
                  className="lg:col-span-4 flex flex-col gap-4"
                  data-testid="distrib-calendar-widget"
                >
                  <span className="stat-label ct-text-accent">Payout calendar</span>
                  <DistribCalendar {...distribCalendarProps} />
                </div>
              </div>
            </MergedSurface>
          )}
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
