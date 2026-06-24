import {
  PfCockpitPanel,
  PfCockpitPanelHeader,
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
  const hasData =
    sources.length > 0 &&
    buckets.length > 0 &&
    sources.reduce((acc, s) => Math.max(acc, Math.abs(s.contributionPct)), 0) > 0;

  const maxAbsPct = hasData
    ? sources.reduce((acc, s) => Math.max(acc, Math.abs(s.contributionPct)), 0)
    : 0;

  // Badge/disclaimer only when there is real data AND a confirmed position.
  const isFilled = hasData && totalValueUsdc > 0;
  const provenance = isFilled
    ? resolveProvenance(source, updatedAt ?? new Date(), "estimated")
    : undefined;

  const [rLow, rHigh] =
    blendedLow <= blendedHigh ? [blendedLow, blendedHigh] : [blendedHigh, blendedLow];
  const [sLow, sHigh] =
    stressedBearRange.low <= stressedBearRange.high
      ? [stressedBearRange.low, stressedBearRange.high]
      : [stressedBearRange.high, stressedBearRange.low];

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
      className={embedded ? "pf-capital-yield--embedded" : "cy-panel"}
    >
      <PfCockpitPanelHeader
        title="Capital & Yield"
        subtitle={isFilled ? "Allocation · 12m forward yield" : undefined}
        provenance={provenance}
        titleVariant="primary"
        trailing={leafHref ? <PortfolioLeafLink href={leafHref} /> : undefined}
      />

      <div className="cy-body">
        {/* ── Zone 1 — allocation gauge ── */}
        <div className="cy-donut dash-chart-container">
          {/* svg-geometry: cx/cy/r/strokeDasharray/viewBox are raw numbers by SVG spec */}
          <svg
            className={cn("dash-chart-svg", !hasData && "dash-chart-svg--skeleton")}
            viewBox="0 0 42 42"
            role="img"
            aria-label={hasData ? "Allocation by yield source" : "Allocation — awaiting first confirmed on-chain position"}
          >
            {/* Background track ring (always present). */}
            <circle
              className="dash-chart-circle"
              cx="21"
              cy="21"
              r="15.9155"
              stroke="var(--ct-surface-1)"
              strokeDasharray="100 0"
            />
            {hasData ? (
              <>
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
                    style={{ "--cy-bucket": CY_BUCKET_GREEN[s.bucket] } as React.CSSProperties}
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
                <span className="donut-val">{formatUsdCompact(totalValueUsdc)}</span>
                <span className="donut-lbl">Capital</span>
              </>
            ) : null}
          </div>
        </div>

        {/* ── Zone 2 — hairline spine ── */}
        <div className="cy-spine" aria-hidden />

        {/* ── Zone 3 — yield ledger (doubles as the donut legend) ── */}
        <div className="cy-ledger">
          <p className="cy-ledger-head body-xs ct-text-tertiary mono m-0">
            Yield source · 12m fwd contribution
          </p>

          {hasData
            ? sources.map((s) => {
                const w = barWidthPct(s.contributionPct, maxAbsPct);
                const isNeg = s.contributionPct < 0;
                const val = formatContribution(s.contributionPct, s.isVolatile ?? false);
                return (
                  <div
                    key={s.bucket}
                    className={cn(
                      "cy-row group",
                      s.bucket === "mining" && "cy-row-mining",
                    )}
                    style={{ "--cy-bucket": CY_BUCKET_GREEN[s.bucket] } as React.CSSProperties}
                  >
                    <span className="cy-dot" aria-hidden />
                    <span className="cy-label body-xs min-w-0 truncate ct-text-body">
                      {s.label}
                    </span>
                    <span className="cy-val" aria-label={`${s.label} ${val}`}>
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
            : /* Zero-state skeleton rows — muted dot + label/value bars + a
                 graded track fill, so the ledger reads as a structured frame. */
              [62, 44, 30, 18].map((w, i) => (
                <div key={i} className="cy-row cy-row--skeleton" aria-hidden>
                  <span className="cy-dot cy-dot--skeleton" />
                  <span className="pf-skeleton-bar pf-skeleton-bar--cy-label" />
                  <span className="pf-skeleton-bar pf-skeleton-bar--cy-val" />
                  <div className="cy-track">
                    <span className="cy-ticks" />
                    <span className="cy-fill cy-fill--skeleton" style={{ width: `${w}%` }} />
                  </div>
                </div>
              ))}

          <hr className="cy-ledger-rule" aria-hidden />

          <dl className="pf-stack--dense group/footer">
            <div className="flex items-baseline justify-between cy-footer-row transition-all duration-200 hover:translate-x-1 cursor-default">
              <dt className="body-xs min-w-0 truncate ct-text-muted transition-colors duration-200 group-hover/footer:ct-text-primary">
                Blended fwd range
              </dt>
              <dd
                className={cn("tabular font-semibold transition-colors duration-200", isFilled ? "ct-text-primary group-hover/footer:ct-text-accent" : "ct-text-tertiary")}
                aria-label={isFilled ? `Blended forward range ${rLow.toFixed(1)} to ${rHigh.toFixed(1)} percent` : "Blended forward range pending"}
              >
                {isFilled ? formatApyRange({ low: rLow, high: rHigh }) : "—"}
              </dd>
            </div>
            <div className="flex items-baseline justify-between cy-footer-row transition-all duration-200 hover:translate-x-1 cursor-default">
              <dt className="body-xs min-w-0 truncate ct-text-muted transition-colors duration-200 group-hover/footer:ct-text-primary">
                Stressed (bear) <span className="body-xs opacity-(--ct-opacity-70)">(proxy)</span>
              </dt>
              <dd
                className={cn("tabular font-medium transition-colors duration-200", isFilled ? "ct-text-body group-hover/footer:ct-text-accent" : "ct-text-tertiary")}
                aria-label={isFilled ? `Stressed bear scenario ${sLow.toFixed(1)} to ${sHigh.toFixed(1)} percent` : "Stressed bear scenario pending"}
              >
                {isFilled ? formatApyRange({ low: sLow, high: sHigh }) : "—"}
              </dd>
            </div>
          </dl>
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
