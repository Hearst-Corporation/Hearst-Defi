"use client";

import { useState } from "react";
import { DashboardPanelHeader } from "@/components/ui/dashboard-panel-header";
import { PfCockpitPanel } from "@/components/portfolio/pf-cockpit-panel";
import {
  barWidthPct,
  formatContribution,
  type YieldSource,
} from "@/components/portfolio/yield-stack";
import type { AllocationBucketSlice } from "@/lib/data/portfolio";
import { formatUsdCompact } from "@/lib/vaults/product-display";
import { formatApyRange } from "@/lib/format/apy";
import { resolveProvenance } from "@/lib/portfolio/provenance";
import { PortfolioLeafLink } from "@/components/portfolio/portfolio-leaf-link";
import { METHODOLOGY_VERSION } from "@/lib/engine/methodology";
import { cn } from "@/lib/cn";

const CY_BUCKET_GREEN: Record<YieldSource["bucket"], string> = {
  mining: "var(--ct-accent)",
  usdc_base: "color-mix(in srgb, var(--ct-accent) 70%, var(--ct-text-neutral))",
  btc_tactical: "color-mix(in srgb, var(--ct-accent) 50%, var(--ct-text-neutral))",
  stable_reserve: "color-mix(in srgb, var(--ct-accent) 32%, var(--ct-text-neutral))",
};

export interface CapitalYieldProps {
  sources: YieldSource[];
  blendedLow: number;
  blendedHigh: number;
  stressedBearRange: { low: number; high: number };
  buckets: AllocationBucketSlice[];
  totalValueUsdc: number;
  methodologyVersion?: string;
  source?: "live" | "estimated" | "stale";
  updatedAt?: Date;
  /** Hub-only link to the focused leaf page. */
  leafHref?: string;
  embedded?: boolean;
}

export function CapitalYield({
  sources,
  blendedLow,
  blendedHigh,
  stressedBearRange,
  buckets,
  totalValueUsdc,
  methodologyVersion = METHODOLOGY_VERSION,
  source = "estimated",
  updatedAt,
  leafHref,
  embedded = false,
}: CapitalYieldProps) {
  const [hoveredBucket, setHoveredBucket] = useState<string | null>(null);

  const hasData = sources.length > 0 && buckets.length > 0;
  const hasYield = hasData && sources.reduce((acc, s) => Math.max(acc, Math.abs(s.contributionPct)), 0) > 0;
  const maxAbsPct = hasData
    ? sources.reduce((acc, s) => Math.max(acc, Math.abs(s.contributionPct)), 0)
    : 0;
  const hasCapital = totalValueUsdc > 0;
  const isFilled = hasYield && totalValueUsdc > 0;

  const [rLow, rHigh] = blendedLow <= blendedHigh ? [blendedLow, blendedHigh] : [blendedHigh, blendedLow];
  const [sLow, sHigh] = stressedBearRange.low <= stressedBearRange.high
    ? [stressedBearRange.low, stressedBearRange.high]
    : [stressedBearRange.high, stressedBearRange.low];

  const hasRange = rLow + rHigh > 0;
  const hasStress = sLow + sHigh > 0;
  const showReferenceRange = hasRange && !isFilled;

  const provenance = isFilled || hasRange
    ? resolveProvenance(isFilled ? source : "estimated", updatedAt ?? new Date(), "estimated")
    : undefined;

  const heroRangeLabel = isFilled
    ? "Forward range"
    : showReferenceRange
      ? "Reference range"
      : "Forward range pending";
  const heroRangeValue = isFilled || showReferenceRange
    ? formatApyRange({ low: rLow, high: rHigh })
    : "—";
  const heroRangeNote = isFilled
    ? "12m forward projection · not guaranteed"
    : showReferenceRange
      ? "Vault reference range · not guaranteed · allocation settling"
      : "Awaiting allocation snapshot";
  const stressedValue = hasStress ? formatApyRange({ low: sLow, high: sHigh }) : "—";

  // Only real buckets become coloured arcs. Empty → the background ring shows alone.
  const segments = buckets.map((slice, i) => ({
    ...slice,
    dashOffset: -buckets.slice(0, i).reduce((sum, b) => sum + b.pct, 0),
  }));

  return (
    <PfCockpitPanel
      variant="wide"
      chrome={embedded ? "embedded" : "panel"}
      aria-label="Capital and yield — allocation and 12 month forward yield"
      className={cn(
        embedded ? "pf-capital-yield--embedded" : "cy-panel",
        !hasCapital && !hasData && (embedded ? "pf-capital-yield--embedded-empty" : "cy-panel--onboarding-empty")
      )}
    >
      <DashboardPanelHeader
        title="Capital & Yield"
        subtitle={isFilled ? "Allocation · 12m forward yield" : undefined}
        provenance={provenance}
        tone="primary"
        trailing={leafHref ? <PortfolioLeafLink href={leafHref} /> : undefined}
      />

      <div className="cy-hero">
        <div className="cy-hero__range">
          <span className="cy-hero__eyebrow">{heroRangeLabel}</span>
          <span className={cn("cy-hero__value", (isFilled || showReferenceRange) && "cy-hero__value--accent")}>
            {heroRangeValue}
          </span>
          <span className="cy-hero__note">{heroRangeNote}</span>
        </div>
        <div className="cy-hero__stress">
          <span className="cy-hero__stress-label">Stress case</span>
          <span className={cn("cy-hero__stress-value", hasStress && "cy-hero__stress-value--live")}>
            {stressedValue}
          </span>
        </div>
      </div>

      <div className="cy-body">
        <div className="cy-donut-shell">
        <div className="cy-donut dash-chart-container group/donut">
          <svg
            className={cn("dash-chart-svg", !hasYield && "dash-chart-svg--skeleton")}
            viewBox="0 0 42 42"
            role="img"
            aria-label={hasYield ? "Allocation by yield source" : "Allocation — awaiting first confirmed on-chain position"}
          >
            <circle
              className="dash-chart-circle"
              cx="21"
              cy="21"
              r="15.9155"
              stroke="var(--ct-surface-2)"
              strokeDasharray="100 0"
            />
            {hasYield ? (
              <>
                {segments
                  .filter((s) => s.bucket === "mining")
                  .map((s) => (
                    <circle
                      key="halo"
                      className="dash-chart-circle cy-donut-halo"
                      cx="21"
                      cy="21"
                      r="15.9155"
                      strokeDasharray={`${(s.pct - 0.6).toFixed(2)} ${(100 - s.pct + 0.6).toFixed(2)}`}
                      strokeDashoffset={s.dashOffset.toFixed(2)}
                    />
                  ))}
                {segments.map((s) => {
                  const isDimmed = hoveredBucket !== null && hoveredBucket !== s.bucket;
                  const isHighlighted = hoveredBucket === s.bucket;
                  return (
                    <circle
                      key={s.bucket}
                      className={cn(
                        "dash-chart-circle cy-donut-arc",
                        s.bucket === "mining" && "cy-arc-mining",
                        isHighlighted && "cy-donut-arc--highlight",
                        isDimmed && "cy-donut-arc--dimmed",
                      )}
                      cx="21"
                      cy="21"
                      r="15.9155"
                      stroke={CY_BUCKET_GREEN[s.bucket]}
                      strokeDasharray={`${(s.pct - 0.6).toFixed(2)} ${(100 - s.pct + 0.6).toFixed(2)}`}
                      strokeDashoffset={s.dashOffset.toFixed(2)}
                      opacity={isDimmed ? 0.3 : isHighlighted ? 1 : 0.85}
                      strokeWidth={isHighlighted ? 5.2 : undefined}
                    />
                  );
                })}
              </>
            ) : (
              [0, 25, 50, 75].map((offset) => (
                <circle
                  key={offset}
                  className="dash-chart-circle cy-donut-arc--skeleton"
                  cx="21"
                  cy="21"
                  r="15.9155"
                  stroke="var(--ct-surface-3)"
                  strokeDasharray="22 3"
                  strokeDashoffset={-offset}
                />
              ))
            )}
          </svg>
            <div className="donut-center">
              {hasCapital ? (
                <>
                  <span className="donut-val group-hover/donut:scale-110 transition-transform duration-500">{formatUsdCompact(totalValueUsdc)}</span>
                  <span className="donut-lbl">Capital</span>
                </>
              ) : (
                <>
                  <span className="donut-val ct-text-tertiary">—</span>
                  <span className="donut-lbl">Pending</span>
                </>
              )}
            </div>
          </div>
          <div className="cy-donut-shell__caption">
            {isFilled
              ? "Live investor allocation"
              : hasCapital
                ? "Allocation settling"
                : showReferenceRange
                  ? "Reference allocation mix"
                  : "Awaiting first confirmed position"}
          </div>
        </div>

        <div className="cy-spine" aria-hidden />

      <div className="cy-ledger">
          {!hasData ? (
            <div className="cy-ledger-empty">
              <p className="cy-ledger-empty__lead">Yield allocation pending</p>
              <p className="cy-ledger-empty__hint">
                Mining allocations settle within 24h of first deposit.
                Forward yield estimates will appear here.
              </p>
            </div>
          ) : (
            <p className="cy-ledger-head body-xs ct-text-tertiary mono m-0">
              Yield source · 12m fwd contribution
            </p>
          )}

          {hasData
            ? sources.map((s) => {
                const w = hasYield ? barWidthPct(s.contributionPct, maxAbsPct) : 0;
                const isNeg = s.contributionPct < 0;
                const val = hasYield ? formatContribution(s.contributionPct, s.isVolatile ?? false) : "—";
                const isRowHovered = hoveredBucket === s.bucket;
                return (
                  <div
                    key={s.bucket}
                    className={cn(
                      "cy-row",
                      s.bucket === "mining" && "cy-row-mining",
                      !hasYield && "opacity-60",
                      isRowHovered && "cy-row--highlight"
                    )}
                    style={{ "--cy-bucket": CY_BUCKET_GREEN[s.bucket] } as React.CSSProperties}
                    onMouseEnter={() => setHoveredBucket(s.bucket)}
                    onMouseLeave={() => setHoveredBucket(null)}
                  >
                    <span className="cy-dot" aria-hidden />
                    <span className="cy-label body-xs min-w-0 truncate ct-text-body font-medium">
                      {s.label}
                    </span>
                    <span className="cy-val font-mono" aria-label={`${s.label} ${val}`}>
                      {val}
                    </span>
                    <div className="cy-track" aria-hidden>
                      <span className="cy-ticks" />
                      <span
                        className={cn(
                          "cy-fill",
                          isNeg && "cy-fill--neg",
                          s.isVolatile && "cy-fill--volatile",
                          isRowHovered && "cy-fill--highlight"
                        )}
                        style={{ width: `${w.toFixed(1)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            : null}

        </div>
      </div>

      {isFilled ? (
        <p className="pf-panel-footnote body-xs ct-text-tertiary" role="note">
          Conditional projection — not guaranteed ·{" "}
          {methodologyVersion.startsWith("v")
            ? methodologyVersion
            : `v${methodologyVersion}`}
        </p>
      ) : null}
    </PfCockpitPanel>
  );
}
