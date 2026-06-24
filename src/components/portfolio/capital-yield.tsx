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
              <g className="opacity-60">
                <circle
                  className="dash-chart-circle"
                  cx="21"
                  cy="21"
                  r="15.9155"
                  stroke="var(--ct-border-soft)"
                  strokeWidth="0.5"
                  strokeDasharray="1 3"
                />
                <circle
                  cx="21"
                  cy="21"
                  r="14"
                  stroke="var(--ct-border-soft)"
                  strokeWidth="0.2"
                  fill="none"
                />
                <circle
                  cx="21"
                  cy="21"
                  r="17.5"
                  stroke="var(--ct-border-soft)"
                  strokeWidth="0.2"
                  fill="none"
                />
                <path d="M 21 2 L 21 6 M 21 36 L 21 40 M 2 21 L 6 21 M 36 21 L 40 21" stroke="var(--ct-border-soft)" strokeWidth="0.5" opacity="0.5" />
              </g>
            )}
          </svg>
          <div className="donut-center">
            {isFilled ? (
              <div className="flex flex-col items-center">
                <span className="text-[9px] uppercase tracking-[0.15em] text-tertiary font-semibold mb-0.5">Total</span>
                <span className="donut-val text-[20px] font-medium tracking-tight text-strong">{formatUsdCompact(totalValueUsdc)}</span>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <span className="text-[9px] uppercase tracking-[0.2em] text-tertiary font-medium opacity-50">Pending</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Zone 2 — hairline spine ── */}
        <div className="cy-spine" aria-hidden />

        {/* ── Zone 3 — yield ledger (doubles as the donut legend) ── */}
        <div className="cy-ledger px-2">
          <p className="cy-ledger-head text-[10px] uppercase tracking-[0.15em] ct-text-tertiary font-medium mb-3 pb-2 border-b border-[color-mix(in_srgb,var(--ct-border-soft)_20%,transparent)]">
            Yield source · 12m fwd
          </p>

          {hasData
            ? <div className="flex flex-col gap-3 mt-2">
                {sources.map((s) => {
                  const w = barWidthPct(s.contributionPct, maxAbsPct);
                  const isNeg = s.contributionPct < 0;
                  const val = formatContribution(s.contributionPct, s.isVolatile ?? false);
                  return (
                    <div
                      key={s.bucket}
                      className={cn(
                        "cy-row group flex items-center justify-between",
                        s.bucket === "mining" && "cy-row-mining",
                      )}
                      style={{ "--cy-bucket": CY_BUCKET_GREEN[s.bucket] } as React.CSSProperties}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--cy-bucket)] shadow-[0_0_8px_var(--cy-bucket)]" aria-hidden />
                        <span className="cy-label text-[12px] min-w-0 truncate ct-text-secondary group-hover:ct-text-primary transition-colors font-medium">
                          {s.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="cy-track w-16 h-1 bg-[color-mix(in_srgb,var(--ct-surface-1)_60%,transparent)] rounded-full overflow-hidden" aria-hidden>
                          <span
                            className={cn(
                              "cy-fill block h-full bg-[var(--cy-bucket)] transition-all duration-500",
                              isNeg && "bg-destructive",
                              s.isVolatile && "opacity-80",
                            )}
                            style={{ width: `${w.toFixed(1)}%` }}
                          />
                        </div>
                        <span className="cy-val tabular text-[13px] font-semibold ct-text-strong min-w-[3.5rem] text-right" aria-label={`${s.label} ${val}`}>
                          {val}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            : /* Premium empty state for the ledger. */
              <div className="flex flex-col gap-2 py-6 items-center justify-center text-center h-full">
                <span className="text-[11px] uppercase tracking-[0.15em] text-secondary font-medium">No allocation yet</span>
                <span className="text-[11px] text-tertiary max-w-[32ch] leading-relaxed opacity-60">
                  Your capital allocation and projected yield will appear here once your position is confirmed on-chain.
                </span>
              </div>
          }
          <hr className="cy-ledger-rule mt-5 mb-4 border-[color-mix(in_srgb,var(--ct-border-soft)_20%,transparent)]" aria-hidden />

          <dl className="pf-stack--dense group/footer bg-[color-mix(in_srgb,var(--ct-surface-1)_30%,transparent)] p-3 rounded-lg border border-[color-mix(in_srgb,var(--ct-border-soft)_15%,transparent)] shadow-[inset_0_1px_0_color-mix(in_srgb,var(--ct-surface-0)_20%,transparent)]">
            <div className="flex items-center justify-between cy-footer-row transition-all duration-200 cursor-default mb-1.5">
              <dt className="text-[11px] uppercase tracking-[0.12em] min-w-0 truncate ct-text-tertiary transition-colors duration-200 group-hover/footer:ct-text-secondary font-medium">
                Blended forward
              </dt>
              <dd
                className={cn("tabular text-[14px] font-bold transition-colors duration-200", isFilled ? "ct-text-strong group-hover/footer:ct-text-accent" : "ct-text-tertiary")}
                aria-label={isFilled ? `Blended forward range ${rLow.toFixed(1)} to ${rHigh.toFixed(1)} percent` : "Blended forward range pending"}
              >
                {isFilled ? formatApyRange({ low: rLow, high: rHigh }) : "—"}
              </dd>
            </div>
            <div className="flex items-center justify-between cy-footer-row transition-all duration-200 cursor-default">
              <dt className="text-[11px] uppercase tracking-[0.12em] min-w-0 truncate ct-text-tertiary transition-colors duration-200 group-hover/footer:ct-text-secondary font-medium">
                Stressed bear
              </dt>
              <dd
                className={cn("tabular text-[12px] font-semibold transition-colors duration-200", isFilled ? "ct-text-secondary group-hover/footer:ct-text-accent opacity-80" : "ct-text-tertiary")}
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
