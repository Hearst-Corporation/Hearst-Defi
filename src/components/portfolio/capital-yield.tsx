import { DashboardPanelHeader } from "@/components/ui/dashboard-panel-header";
import {
  PfCockpitPanel,
} from "@/components/portfolio/pf-cockpit-panel";
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

/**
 * Capital & Yield — "Living Precision" instrument panel.
 *
 * Merges the former Yield Source Stack + Allocation donut into ONE full-width
 * showpiece: a haloed allocation gauge (left) reading across a hairline spine
 * into a precision yield ledger (right) whose rows ARE the donut legend.
 *
 * Pure Server Component. No client JS, no Date.now()/Math.random(); all motion
 * is CSS-only (@keyframes, behind prefers-reduced-motion).
 *
 * CLAUDE.md non-negotiables: APY always a range (#1), provenance badge (#2),
 * forbidden words absent (#5), "not guaranteed" disclaimer (#10).
 */

/**
 * Monochrome-green bucket palette — LOCAL to the portfolio "Living Precision"
 * panel (Adrien's premium direction: green + derivations only, no other hue).
 */
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
  // Zero-state = the graphic SKELETON renders (empty ring + zeroed ledger rows),
  // NO invented data. As soon as real vault data arrives, the donut/ledger fill in.
  const hasData = sources.length > 0 && buckets.length > 0;

  const hasYield = hasData && sources.reduce((acc, s) => Math.max(acc, Math.abs(s.contributionPct)), 0) > 0;

  const maxAbsPct = hasData
    ? sources.reduce((acc, s) => Math.max(acc, Math.abs(s.contributionPct)), 0)
    : 0;

  // Badge/disclaimer only when there is real data AND a confirmed position.
  const isFilled = hasYield && totalValueUsdc > 0;
  const provenance = isFilled
    ? resolveProvenance(source, updatedAt ?? new Date(), "estimated")
    : hasData ? resolveProvenance("fallback", updatedAt ?? new Date(), "estimated") : undefined;

  const [rLow, rHigh] =
    blendedLow <= blendedHigh ? [blendedLow, blendedHigh] : [blendedHigh, blendedLow];
  const [sLow, sHigh] =
    stressedBearRange.low <= stressedBearRange.high
      ? [stressedBearRange.low, stressedBearRange.high]
      : [stressedBearRange.high, stressedBearRange.low];
  const showReferenceRange = hasData && !isFilled;
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
      ? "Vault-level reference while your first position is pending"
      : "Awaiting allocation snapshot";
  const stressedValue = isFilled || showReferenceRange
    ? formatApyRange({ low: sLow, high: sHigh })
    : "—";

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
        !hasData && (embedded ? "pf-capital-yield--embedded-empty" : "cy-panel--onboarding-empty")
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
          <span className={cn("cy-hero__stress-value", (isFilled || showReferenceRange) && "cy-hero__stress-value--live")}>
            {stressedValue}
          </span>
        </div>
      </div>

      <div className="cy-body">
        {/* ── Zone 1 — allocation gauge ── */}
        <div className="cy-donut-shell">
          <div className="cy-donut dash-chart-container group/donut">
          {/* svg-geometry: cx/cy/r/strokeDasharray/viewBox are raw numbers by SVG spec */}
            <svg
              className={cn("dash-chart-svg", !hasYield && "dash-chart-svg--skeleton")}
              viewBox="0 0 42 42"
              role="img"
              aria-label={hasYield ? "Allocation by yield source" : "Allocation — awaiting first confirmed on-chain position"}
            >
            {/* Background track ring (always present). */}
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
                {segments.map((s) => (
                  <circle
                    key={s.bucket}
                    className={cn(
                      "dash-chart-circle cy-donut-arc",
                      s.bucket === "mining" && "cy-arc-mining",
                    )}
                    cx="21"
                    cy="21"
                    r="15.9155"
                    stroke={CY_BUCKET_GREEN[s.bucket]}
                    strokeDasharray={`${(s.pct - 0.6).toFixed(2)} ${(100 - s.pct + 0.6).toFixed(2)}`}
                    strokeDashoffset={s.dashOffset.toFixed(2)}
                  />
                ))}
              </>
            ) : (
              /* Zero-state: four evenly-spaced muted arcs suggest the allocation
                 structure to come — a quiet skeleton, not a flat grey ring. */
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
              {isFilled ? (
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
              : showReferenceRange
                ? "Reference allocation mix"
                : "Awaiting first confirmed position"}
          </div>
        </div>

        {/* ── Zone 2 — hairline spine ── */}
        <div className="cy-spine" aria-hidden />

        {/* ── Zone 3 — yield ledger (doubles as the donut legend) ── */}
        <div className="cy-ledger">
          {!hasData ? null : (
            <p className="cy-ledger-head body-xs ct-text-tertiary mono m-0">
              Yield source · 12m fwd contribution
            </p>
          )}

          {hasData
            ? sources.map((s) => {
                const w = hasYield ? barWidthPct(s.contributionPct, maxAbsPct) : 0;
                const isNeg = s.contributionPct < 0;
                const val = hasYield ? formatContribution(s.contributionPct, s.isVolatile ?? false) : "—";
                return (
                  <div
                    key={s.bucket}
                    className={cn(
                      "cy-row",
                      s.bucket === "mining" && "cy-row-mining",
                      !hasYield && "opacity-60"
                    )}
                    style={{ "--cy-bucket": CY_BUCKET_GREEN[s.bucket] } as React.CSSProperties}
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
