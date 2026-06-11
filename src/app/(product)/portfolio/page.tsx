import "./portfolio.css";

import { PREVIEW_PORTFOLIO } from "./__preview-mock";
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
import { PortfolioEmptyState } from "@/components/portfolio/portfolio-empty-state";
import { PortfolioGreeting } from "@/components/portfolio/portfolio-greeting";
import { NextActionCard } from "@/components/portfolio/next-action-card";
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
import { SecurityPulse } from "@/components/portfolio/security-pulse";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { Tooltip } from "@/components/ui/tooltip";
import { MotionViewport } from "@/components/ui/motion-viewport";
import { formatUsdCompact } from "@/lib/format/usd-compact";
import type { Provenance } from "@/components/ui/provenance-badge";

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

// ---------------------------------------------------------------------------
// Section wrappers — semantic sections with border separators
// ---------------------------------------------------------------------------

interface SectionProps {
  "data-section": string;
  children: React.ReactNode;
  label?: string;
}

function Section({ "data-section": dataSectionAttr, children, label }: SectionProps) {
  return (
    <section
      data-section={dataSectionAttr}
      aria-label={label}
      className="flex flex-col gap-6 border-t border-(--ct-border-soft) pt-12 first:border-t-0 first:pt-0"
    >
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Position Value KPI — explicit card separate from "Portfolio Value"
// ---------------------------------------------------------------------------

interface PositionValueKpiProps {
  totalValueUsdc: number;
  provenance: Provenance;
}

function PositionValueKpi({ totalValueUsdc, provenance }: PositionValueKpiProps) {
  const fmt = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  return (
    <article className="dash-cell dash-cell-premium col-4" aria-label="Position value" data-testid="position-value-kpi">
      <div className="dash-label">
        <Tooltip content="Total current value of your positions including accrued yield">
          <span className="cursor-help border-b border-dotted border-(--ct-border-soft)">Position Value</span>
        </Tooltip>
        <ProvenanceBadge kind={provenance} />
      </div>
      <div className="dash-value-group relative z-10">
        <span className="dash-value">
          {totalValueUsdc > 0 ? fmt.format(totalValueUsdc) : "—"}
        </span>
        <span className="dash-unit shrink-0">USDC</span>
      </div>
      <p className="body-xs ct-text-muted mt-2 relative z-10">Principal + accrued yield</p>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Yield YTD KPI
// ---------------------------------------------------------------------------

interface YieldYtdKpiProps {
  totalYieldYtdUsdc: number;
  hasPositions: boolean;
  provenance: Provenance;
}

function YieldYtdKpi({ totalYieldYtdUsdc, hasPositions, provenance }: YieldYtdKpiProps) {
  return (
    <article className="dash-cell dash-cell-premium col-4" aria-label="Yield year to date" data-testid="yield-ytd-kpi">
      <div className="dash-label">
        <Tooltip content="Total yield earned since the beginning of the current calendar year">
          <span className="cursor-help border-b border-dotted border-(--ct-border-soft)">Yield YTD</span>
        </Tooltip>
        <ProvenanceBadge kind={provenance} />
      </div>
      <div className="dash-value-group relative z-10">
        <span className="dash-value">
          {hasPositions ? formatUsdCompact(totalYieldYtdUsdc) : "—"}
        </span>
        <span className="dash-unit shrink-0">USDC</span>
      </div>
      <p className="body-xs ct-text-muted mt-2 italic relative z-10">Accrued + distributed. Not projected forward.</p>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Next Distribution KPI
// ---------------------------------------------------------------------------

interface NextDistributionKpiProps {
  nextDistributionAt: Date;
  provenance: Provenance;
}

function NextDistributionKpi({ nextDistributionAt, provenance }: NextDistributionKpiProps) {
  const monthDayFmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  // Calculate days remaining (mock logic for visual density)
  const now = new Date();
  const diffTime = Math.max(0, nextDistributionAt.getTime() - now.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return (
    <article className="dash-cell dash-cell-premium col-4" aria-label="Next distribution date" data-testid="next-distribution-kpi">
      <div className="dash-label">
        <span>Next Distribution</span>
        <ProvenanceBadge kind={provenance} />
      </div>
      <div className="dash-value-group relative z-10">
        <span className="dash-value-range stat-value tabular">
          {monthDayFmt.format(nextDistributionAt)}
        </span>
      </div>
      <div className="flex items-center gap-2 mt-2 relative z-10">
        <p className="text-xs text-(--ct-text-muted) mono uppercase tracking-(--ct-tracking-wider) leading-4 truncate min-w-0 opacity-70">
          Indicative · Monthly, Day 1 (T+5)
        </p>
        {diffDays > 0 && (
          <span className="text-micro font-bold px-1.5 py-0.5 rounded-full bg-(--ct-accent)/10 text-(--ct-accent) border border-(--ct-accent)/20">
            {diffDays}d left
          </span>
        )}
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

// TEMP — layout preview. Flip to false to restore real empty-state behaviour.
const PREVIEW_LAYOUT = false;

export default async function PortfolioPage() {
  // 1. Parallelize initial data loading
  const [investor, loadedData] = await Promise.all([
    getInvestor(),
    loadPortfolio(),
  ]);

  const hasPositionsData = PREVIEW_LAYOUT ? PREVIEW_PORTFOLIO : loadedData;

  const hasPositions = hasPositionsData.positions.length > 0;

  // 2. Parallelize all widget props loaders
  const [
    data,
    lockMeterProps,
    timeToCashProps,
    riskPulseProps,
    distribCalendarProps,
    proofPulseProps,
    yieldStackProps,
  ] = await Promise.all([
    Promise.resolve(hasPositionsData),
    loadLockMeterProps(),
    loadTimeToCashProps(),
    loadRiskPulseProps(),
    loadDistribCalendarProps(),
    loadProofPulseProps(),
    loadYieldStackProps(hasPositions),
  ]);
  const name = displayName(investor);

  // No active positions → calm guided empty state; skip the full dashboard.
  if (!hasPositions) {
    return (
      <PortfolioEmptyState
        name={name}
        data={data}
        kycStatus={investor?.kycStatus ?? "pending"}
        accreditationAttested={investor?.accreditationAttestedAt != null}
        hasWallet={investor?.walletAddress != null}
      />
    );
  }

  const portfolioProvenance = resolveProvenance(data.source, data.updatedAt);

  return (
    <div className="pf-container flex flex-col gap-8" data-testid="portfolio-page">
      <PortfolioGreeting name={name} data={data} />

      {/* The single "what to do next" surface — above the fold is for
          deciding. Pure derivation of status flags already loaded above;
          no fetch, no financial logic. */}
      <NextActionCard
        kycStatus={investor?.kycStatus ?? "pending"}
        accreditationAttested={investor?.accreditationAttestedAt != null}
        hasWallet={investor?.walletAddress != null}
        positionCount={data.positions.length}
      />

      {/* ── Section 1 — Performance & Liquidity (Hero) ────────────────────── */}
      <MotionViewport>
        <Section data-section="hero-pulse" label="Hero Pulse — key performance and liquidity">
          {/* Ligne 1 : 3 KPIs (NAV/share hidden — no meaningful value at 0 positions) */}
          <div className="dash-bento" data-testid="hero-top-metrics">
            <PositionValueKpi
              totalValueUsdc={data.totalValueUsdc}
              provenance={portfolioProvenance}
            />
            <YieldYtdKpi
              totalYieldYtdUsdc={data.totalYieldYtdUsdc}
              hasPositions={hasPositions}
              provenance={resolveProvenance(data.source, data.updatedAt, "estimated")}
            />
            <NextDistributionKpi
              nextDistributionAt={data.nextDistributionAt}
              provenance={resolveProvenance(data.source, data.updatedAt, "estimated")}
            />
          </div>

          {/* Ligne 2 : ValueChart (2/3) + Liquidity Column (1/3) */}
          <div className="dash-bento">
            <div className="bento-col-8 flex flex-col">
              <ValueChart
                positions={data.positions}
                totalValueUsdc={data.totalValueUsdc}
                source={data.source}
                updatedAt={data.updatedAt}
              />
            </div>

            {/* Liquidity Column */}
            <div className="bento-col-4 flex flex-col gap-6">
              <TimeToCash {...timeToCashProps} />
              <LockMeter {...lockMeterProps} />
            </div>
          </div>
        </Section>
      </MotionViewport>

      {/* ── Section 2 — Under the Hood (Yield & Trust) ────────────────────── */}
      <MotionViewport>
        <Section data-section="yield-trust" label="Yield and Trust — analytics and risk">
          {/* Ligne 1 : Yield Analytics */}
          <div className="dash-bento">
            <div className="bento-col-6">
            <AllocationDonut
              positions={data.positions}
              totalValueUsdc={data.totalValueUsdc}
              source={data.source}
              updatedAt={data.updatedAt}
            />
            </div>
            <div className="bento-col-6" data-testid="yield-stack-widget">
              <YieldStack {...yieldStackProps} />
            </div>
          </div>

          {/* Ligne 2 : Security & Trust */}
          <div className="dash-bento">
            <div className="bento-col-4" data-testid="risk-pulse-widget">
              <RiskPulse {...riskPulseProps} />
            </div>
            <div className="bento-col-4" data-testid="proof-pulse-widget">
              <ProofPulse {...proofPulseProps} />
            </div>
            <div className="bento-col-4" data-testid="security-pulse-widget">
              <SecurityPulse />
            </div>
          </div>
        </Section>
      </MotionViewport>

      {/* ── Section 3 — Activity & Payouts ────────────────────────────────── */}
      <MotionViewport>
        <Section data-section="activity-payouts" label="Activity and payouts — your positions, deposits, withdrawals and payouts">
          <div className="dash-bento">
            <div className="bento-col-12">
              <PositionsList
                positions={data.positions}
                source={data.source}
                updatedAt={data.updatedAt}
              />
            </div>
          </div>

          <div className="dash-bento">
            <div className="bento-col-6" data-testid="distrib-calendar-widget">
              <DistribCalendar {...distribCalendarProps} />
            </div>

            <div className="bento-col-6">
            <RecentActivity
              transactions={data.recentTransactions}
              source={data.source}
              updatedAt={data.updatedAt}
            />
            </div>
          </div>
        </Section>
      </MotionViewport>

      {/* ── Disclaimer ─────────────────────────────────────────────────── */}
      <footer className="border-t border-(--ct-border-soft) pt-12 pb-24">
        <p className="body-xs ct-text-muted max-w-3xl">
          Projections and estimated yields are conditional on stated assumptions
          and are **not guaranteed**. Past performance is not indicative of
          future results. All data is subject to the methodology v1.0 and
          latest Proof of Reserves attestation.
        </p>
      </footer>

    </div>
  );
}
