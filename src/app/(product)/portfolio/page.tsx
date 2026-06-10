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
  loadTaxPreview,
} from "@/lib/data/portfolio";
import { PortfolioEmptyState } from "@/components/portfolio/portfolio-empty-state";
import { SurpriseDelightBar } from "@/components/portfolio/surprise-delight-bar";
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
import { Metric } from "@/components/ui/metric";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { formatUsdCompact } from "@/lib/format/usd-compact";

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
  source: "live" | "fallback";
}

function PositionValueKpi({ totalValueUsdc, source }: PositionValueKpiProps) {
  const provenance = source === "fallback" ? "stale" : "live";
  const fmt = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  return (
    <article className="dash-cell dash-cell-premium" aria-label="Position value" data-testid="position-value-kpi">
      <div className="dash-label">
        <span>Position Value</span>
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
// Portfolio Brief — compact investor summary before deeper widgets
// ---------------------------------------------------------------------------

interface PortfolioBriefProps {
  totalValueUsdc: number;
  recentChangeUsdc: number | null;
  nextDistributionAt: Date;
  projectedPayoutUsdc: number;
  riskLabel: string | undefined;
  proofState: "attested" | "stale";
  source: "live" | "fallback";
}

function formatDateShort(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function PortfolioBrief({
  totalValueUsdc,
  recentChangeUsdc,
  nextDistributionAt,
  projectedPayoutUsdc,
  riskLabel,
  proofState,
  source,
}: PortfolioBriefProps) {
  const provenance = source === "fallback" ? "stale" : "live";
  const recentChange =
    recentChangeUsdc === null
      ? "Not available yet"
      : `${recentChangeUsdc >= 0 ? "+" : ""}${formatUsdCompact(recentChangeUsdc)}`;
  const nextPayout =
    projectedPayoutUsdc > 0
      ? `${formatUsdCompact(projectedPayoutUsdc)} around ${formatDateShort(nextDistributionAt)}`
      : `Next cycle around ${formatDateShort(nextDistributionAt)}`;
  const proofLabel =
    proofState === "attested" ? "Latest proof attested" : "Proof awaiting attestation";

  return (
    <section
      aria-label="Portfolio brief"
      className="dash-cell dash-cell-premium grid gap-4 sm:grid-cols-2 xl:grid-cols-5"
    >
      <div className="space-y-1">
        <div className="dash-label mb-0">
          <span>Portfolio brief</span>
          <ProvenanceBadge kind={provenance} />
        </div>
        <p className="body-xs ct-text-muted">
          One-line view before the detailed widgets below.
        </p>
      </div>
      <Metric
        variant="nested"
        label="Current value"
        value={formatUsdCompact(totalValueUsdc)}
      />
      <Metric variant="nested" label="Recent change" value={recentChange} />
      <Metric variant="nested" label="Next payout/event" value={nextPayout} />
      <Metric
        variant="nested"
        label="Risk & proof"
        value={riskLabel ?? "Risk snapshot awaiting data"}
        sublabel={proofLabel}
      />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Yield YTD KPI
// ---------------------------------------------------------------------------

interface YieldYtdKpiProps {
  totalYieldYtdUsdc: number;
  hasPositions: boolean;
  source: "live" | "fallback";
}

function YieldYtdKpi({ totalYieldYtdUsdc, hasPositions, source }: YieldYtdKpiProps) {
  const provenance = source === "fallback" ? "stale" : "estimated";
  return (
    <article className="dash-cell dash-cell-premium" aria-label="Yield year to date" data-testid="yield-ytd-kpi">
      <div className="dash-label">
        <span>Yield YTD</span>
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
  source: "live" | "fallback";
}

function NextDistributionKpi({ nextDistributionAt, source }: NextDistributionKpiProps) {
  const provenance = source === "fallback" ? "stale" : "estimated";
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
    <article className="dash-cell dash-cell-premium" aria-label="Next distribution date" data-testid="next-distribution-kpi">
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

export default async function PortfolioPage() {
  const [
    data,
    investor,
    lockMeterPropsRaw,
    timeToCashPropsRaw,
    riskPulsePropsRaw,
    distribCalendarPropsRaw,
    proofPulsePropsRaw,
    yieldStackPropsRaw,
  ] = await Promise.all([
    loadPortfolio(),
    getInvestor(),
    loadLockMeterProps(),
    loadTimeToCashProps(),
    loadRiskPulseProps(),
    loadDistribCalendarProps(),
    loadProofPulseProps(),
    loadYieldStackProps(),
  ]);
  // Tax preview is loaded after the investor is known so its loader can reuse
  // the same session lookup; running it inside the Promise.all is safe since
  // `loadTaxPreview` resolves the investor internally. Keeping it serial is
  // simpler here than threading the investor object into the loader.
  const taxPreview = await loadTaxPreview();

  const name = displayName(investor);

  // Strip the `source` field before forwarding to widget components
  // (widgets that don't accept source-driven provenance keep their default badge).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { source: _lmSource, ...lockMeterProps } = lockMeterPropsRaw;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { source: _tcSource, ...timeToCashProps } = timeToCashPropsRaw;
  // Risk Pulse keeps `source` so the header badge reflects stale/live honestly.
  const { source: riskPulseSource, ...riskPulseProps } = riskPulsePropsRaw;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { source: _dcSource, ...distribCalendarProps } = distribCalendarPropsRaw;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { source: _ppSource, ...proofPulseProps } = proofPulsePropsRaw;
  // YieldStack accepts source — forward it so its ProvenanceBadge reflects DB state.
  // For a user with no positions, suppress the vault-level sources and ranges: the
  // widget would otherwise display a forward yield projection (Mining +6.2%, USDC
  // +4.8%, …) that has nothing to do with the user's empty portfolio. Hand it an
  // empty payload so it falls through to its "No yield source data yet" empty state.
  const yieldStackProps =
    data.positions.length === 0
      ? {
          ...yieldStackPropsRaw,
          sources: [],
          blendedLow: 0,
          blendedHigh: 0,
          stressedBearRange: { low: 0, high: 0 },
        }
      : yieldStackPropsRaw;

  const hasPositions = data.positions.length > 0;
  const proofState =
    proofPulseProps.lastPor.statedTvlUsdc > 0 &&
    proofPulseProps.lastPor.onChainTvlUsdc > 0 &&
    Math.abs(proofPulseProps.lastPor.statedTvlUsdc - proofPulseProps.lastPor.onChainTvlUsdc) /
      proofPulseProps.lastPor.statedTvlUsdc <
      0.005
      ? "attested"
      : "stale";

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

  return (
    <div className="space-y-12" data-testid="portfolio-page">

      {/* Single page-level provenance notice when the WHOLE view is demo /
          unauthenticated data. Stating it once here is calmer than the "Stale"
          badge repeating on every card — the per-card badges remain for honesty,
          but this gives the repetition context instead of alarm. */}
      {data.source === "fallback" ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-(--ct-border-soft) ct-surface-1 px-4 py-2.5"
        >
          <span aria-hidden className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-(--ct-text-muted)" />
          <p className="body-xs ct-text-muted">
            Preview data — your portfolio appears here after activation.
          </p>
        </div>
      ) : null}

      {/* ── Header & Next Action ──────────────────────────────────────────── */}
      <div className="flex flex-col gap-6">
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

        {/* Quick access to reporting documents — only when positions exist */}
        <SurpriseDelightBar
          investorId={investor?.id ?? null}
          taxPreview={taxPreview}
        />
      </div>

      <PortfolioBrief
        totalValueUsdc={data.totalValueUsdc}
        recentChangeUsdc={data.pnl?.totalReturnUsdc ?? null}
        nextDistributionAt={data.nextDistributionAt}
        projectedPayoutUsdc={timeToCashProps.projectedUsdc}
        riskLabel={riskPulseProps.compositeLabel}
        proofState={proofState}
        source={data.source}
      />

      {/* ── Section 1 — Performance & Liquidity (Hero) ────────────────────── */}
      <Section data-section="hero-pulse" label="Hero Pulse — key performance and liquidity">
        {/* Ligne 1 : 3 KPIs (NAV/share hidden — no meaningful value at 0 positions) */}
        <div
          className="grid grid-cols-1 gap-4 sm:grid-cols-3"
          data-testid="hero-top-metrics"
        >
          <PositionValueKpi
            totalValueUsdc={data.totalValueUsdc}
            source={data.source}
          />
          <YieldYtdKpi
            totalYieldYtdUsdc={data.totalYieldYtdUsdc}
            hasPositions={hasPositions}
            source={data.source}
          />
          <NextDistributionKpi
            nextDistributionAt={data.nextDistributionAt}
            source={data.source}
          />
        </div>

        {/* Ligne 2 : ValueChart (2/3) + Liquidity Column (1/3) */}
        <div className="grid items-start grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Performance Chart */}
          <div className="lg:col-span-8 flex flex-col">
            <ValueChart
              positions={data.positions}
              totalValueUsdc={data.totalValueUsdc}
              source={data.source}
            />
          </div>

          {/* Liquidity Column */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <TimeToCash {...timeToCashProps} />
            <LockMeter {...lockMeterProps} />
          </div>
        </div>
      </Section>

      {/* ── Section 2 — Under the Hood (Yield & Trust) ────────────────────── */}
      <Section data-section="yield-trust" label="Yield and Trust — analytics and risk">
        {/* Ligne 1 : Yield Analytics */}
        <div className="grid items-start grid-cols-1 gap-6 xl:grid-cols-2">
          <AllocationDonut
            positions={data.positions}
            totalValueUsdc={data.totalValueUsdc}
            source={data.source}
          />
          <div data-testid="yield-stack-widget">
            <YieldStack {...yieldStackProps} />
          </div>
        </div>

        {/* Ligne 2 : Security & Trust */}
        <div className="grid items-start grid-cols-1 gap-6 xl:grid-cols-2">
          <div data-testid="risk-pulse-widget">
            <RiskPulse {...riskPulseProps} source={riskPulseSource} />
          </div>
          <div data-testid="proof-pulse-widget">
            <ProofPulse {...proofPulseProps} />
          </div>
        </div>
      </Section>

      {/* ── Section 3 — Activity & Payouts ────────────────────────────────── */}
      <Section data-section="activity-payouts" label="Activity and payouts — your positions, deposits, withdrawals and payouts">
        {/* Positions List — Full width */}
        <PositionsList positions={data.positions} source={data.source} />

        <div className="grid items-start grid-cols-1 gap-6 xl:grid-cols-2">
          {/* Payout calendar */}
          <div data-testid="distrib-calendar-widget">
            <DistribCalendar {...distribCalendarProps} />
          </div>

          {/* Recent activity — deposits, withdrawals, payouts */}
          <RecentActivity
            transactions={data.recentTransactions}
            source={data.source}
          />
        </div>
      </Section>

    </div>
  );
}
