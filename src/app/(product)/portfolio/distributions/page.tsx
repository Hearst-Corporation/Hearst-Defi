import "../portfolio.css";

import { loadPortfolioView } from "@/lib/data/portfolio-view";
import { PortfolioLeafShell } from "@/components/portfolio/portfolio-leaf-shell";
import { DistribCalendar } from "@/components/portfolio/distrib-calendar";
import { ApyRange } from "@/components/ui/apy-range";
import { formatUsdCompact, formatUsdFull } from "@/lib/vaults/product-display";
import { cn } from "@/lib/cn";
import Link from "next/link";
import { ArrowLeft, CalendarDays, CircleDollarSign, TrendingUp, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Distributions",
  description: "Your monthly distribution calendar and payout history",
};

const distribDateFmt = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const distribMonthFmt = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export default async function DistributionsPage() {
  const { distribCalendarProps, data, hasPositions, yieldStackProps } = await loadPortfolioView();
  const { blendedLow, blendedHigh } = yieldStackProps;
  const [rLow, rHigh] = blendedLow <= blendedHigh ? [blendedLow, blendedHigh] : [blendedHigh, blendedLow];

  const hasEntries = distribCalendarProps.entries.length > 0;
  const paidEntries = distribCalendarProps.entries.filter((e) => e.paidAt !== null);
  const totalPaid = paidEntries.reduce((sum, e) => sum + e.amountUsdc, 0);
  const lastEntry = paidEntries.at(-1);

  const nextDistributionAt = data.nextDistributionAt;

  return (
    <PortfolioLeafShell testId="portfolio-distributions-page">
      <div className="pf-leaf-page">
        {/* ── Back nav ── */}
        <div className="pf-leaf-back-nav">
          <Link href="/portfolio" className="pf-leaf-back-link">
            <ArrowLeft size={14} aria-hidden />
            Portfolio
          </Link>
          <span className="pf-leaf-back-sep" aria-hidden>/</span>
          <span className="pf-leaf-back-current">Distributions</span>
        </div>

        {/* ── Page header ── */}
        <div className="pf-leaf-header">
          <div className="pf-leaf-header__left">
            <p className="pf-leaf-eyebrow">Portfolio</p>
            <h1 className="pf-leaf-title">Distributions</h1>
            <p className="pf-leaf-desc">
              {hasEntries
                ? `Monthly USDC payouts — ${paidEntries.length} distribution${paidEntries.length !== 1 ? "s" : ""} since inception.`
                : hasPositions
                ? "Monthly USDC distributions begin after your first qualifying cycle."
                : "Monthly USDC distributions are posted here once your position is active."}
            </p>
          </div>
        </div>

        {/* ── Summary KPIs (always shown when position exists) ── */}
        {hasPositions && (
          <div className="pf-leaf-hero-row">
            <div className="pf-leaf-kpi-card">
              <span className="pf-leaf-kpi-label">
                <CircleDollarSign size={12} aria-hidden />
                Total paid
              </span>
              <span className="pf-leaf-kpi-value tabular">
                {hasEntries ? formatUsdCompact(totalPaid) : "—"}
              </span>
              <span className="pf-leaf-kpi-sub">
                {hasEntries ? `${paidEntries.length} payout${paidEntries.length !== 1 ? "s" : ""}` : "None yet"}
              </span>
            </div>

            <div className="pf-leaf-kpi-card">
              <span className="pf-leaf-kpi-label">
                <TrendingUp size={12} aria-hidden />
                Accrued yield
              </span>
              <span className={cn(
                "pf-leaf-kpi-value tabular",
                data.accruedYieldUsdc > 0 && "pf-leaf-kpi-value--accent",
              )}>
                {data.accruedYieldUsdc > 0 ? formatUsdFull(data.accruedYieldUsdc) : "—"}
              </span>
              <span className="pf-leaf-kpi-sub">Pending payout</span>
            </div>

            <div className="pf-leaf-kpi-card">
              <span className="pf-leaf-kpi-label">
                <CalendarDays size={12} aria-hidden />
                Next estimated
              </span>
              <span className="pf-leaf-kpi-value">
                {distribMonthFmt.format(nextDistributionAt)}
              </span>
              <span className="pf-leaf-kpi-sub">~{distribDateFmt.format(nextDistributionAt)}</span>
            </div>

            <div className="pf-leaf-kpi-card">
              <span className="pf-leaf-kpi-label">
                <TrendingUp size={12} aria-hidden />
                Target APY
              </span>
              <span className="pf-leaf-kpi-value">
                <ApyRange low={rLow} high={rHigh} className="tabular" />
              </span>
              <span className="pf-leaf-kpi-sub">Blended forward</span>
            </div>
          </div>
        )}

        {/* ── Calendar chart — DistribCalendar owns its own panel chrome ── */}
        <div className="pf-leaf-section">
          <DistribCalendar
            {...distribCalendarProps}
            secondaryLeafHref="/portfolio/tax"
            secondaryLeafLabel="Tax preview"
            embedded={false}
            nextDistributionAt={nextDistributionAt}
            hasActivePosition={hasPositions}
          />
        </div>

        {/* ── Last distribution detail (when paid entries exist) ── */}
        {lastEntry && (
          <div className="pf-leaf-section">
            <div className="pf-leaf-section__card">
              <div className="pf-leaf-section__head">
                <h2 className="pf-leaf-section-title">Most recent payout</h2>
              </div>
              <div className="pf-leaf-model-grid">
                <div className="pf-leaf-model-item">
                  <span className="pf-leaf-model-item__label">Period</span>
                  <span className="pf-leaf-model-item__value tabular">{lastEntry.period}</span>
                </div>
                <div className="pf-leaf-model-item">
                  <span className="pf-leaf-model-item__label">Amount</span>
                  <span className="pf-leaf-model-item__value tabular ct-text-accent font-semibold">
                    {formatUsdFull(lastEntry.amountUsdc)}
                  </span>
                </div>
                {lastEntry.paidAt && (
                  <div className="pf-leaf-model-item">
                    <span className="pf-leaf-model-item__label">Paid on</span>
                    <span className="pf-leaf-model-item__value tabular">
                      {distribDateFmt.format(lastEntry.paidAt)}
                    </span>
                  </div>
                )}
                {lastEntry.txHash && (
                  <div className="pf-leaf-model-item">
                    <span className="pf-leaf-model-item__label">Transaction</span>
                    <span className="pf-leaf-model-item__value tabular mono" style={{ fontSize: "var(--ct-text-micro)" }}>
                      {lastEntry.txHash.slice(0, 16)}…
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Distribution mechanics ── */}
        <div className="pf-leaf-section">
          <div className="pf-leaf-section__card">
            <div className="pf-leaf-section__head">
              <h2 className="pf-leaf-section-title">How distributions work</h2>
              <span className="pf-leaf-section-subtitle">Schedule and mechanics</span>
            </div>
            <div className="pf-leaf-model-grid">
              <div className="pf-leaf-model-item">
                <span className="pf-leaf-model-item__label">Frequency</span>
                <span className="pf-leaf-model-item__value">Monthly</span>
              </div>
              <div className="pf-leaf-model-item">
                <span className="pf-leaf-model-item__label">Currency</span>
                <span className="pf-leaf-model-item__value">USDC</span>
              </div>
              <div className="pf-leaf-model-item">
                <span className="pf-leaf-model-item__label">Settlement</span>
                <span className="pf-leaf-model-item__value">T+5 business days</span>
              </div>
              <div className="pf-leaf-model-item">
                <span className="pf-leaf-model-item__label">Eligibility</span>
                <span className="pf-leaf-model-item__value">After first qualifying cycle</span>
              </div>
              <div className="pf-leaf-model-item">
                <span className="pf-leaf-model-item__label">Share class</span>
                <span className="pf-leaf-model-item__value">
                  {distribCalendarProps.shareClass ? `Series ${distribCalendarProps.shareClass}` : "—"}
                </span>
              </div>
              <div className="pf-leaf-model-item">
                <span className="pf-leaf-model-item__label">Cadence</span>
                <span className="pf-leaf-model-item__value">
                  {distribCalendarProps.cadence ?? "Monthly, T+5"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Next distribution ── */}
        {hasPositions && !hasEntries && (
          <div className="pf-leaf-section">
            <div className="pf-leaf-section__card pf-leaf-section__card--notice">
              <Clock size={14} aria-hidden />
              <div>
                <p className="pf-leaf-notice-title">First distribution pending</p>
                <p className="pf-leaf-notice-text">
                  Your capital ({formatUsdCompact(data.totalValueUsdc)}) is deployed and accruing.
                  The first distribution posts after the cycle closes — estimated{" "}
                  {distribMonthFmt.format(nextDistributionAt)}.
                  {data.accruedYieldUsdc > 0 && (
                    <span>
                      {" "}Current accrued: <strong className="ct-text-accent">{formatUsdFull(data.accruedYieldUsdc)}</strong>.
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Tax note ── */}
        <div className="pf-leaf-section">
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Link href="/portfolio/tax" className="pf-leaf-back-link">
              View tax preview →
            </Link>
          </div>
        </div>

        <p className="pf-leaf-disclaimer">
          Distribution dates are estimated — confirmed at cycle close. Amount depends on
          vault performance. Not guaranteed.
        </p>
      </div>
    </PortfolioLeafShell>
  );
}
