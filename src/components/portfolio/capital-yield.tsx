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

const CY_ZERO_STATE = {
  targetApyRange: { low: 9, high: 13 },
} as const;

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
  const maxAbsPct = sources.reduce(
    (acc, s) => Math.max(acc, Math.abs(s.contributionPct)),
    0,
  );
  const hasData =
    sources.length > 0 && buckets.length > 0 && totalValueUsdc > 0;
  const isEmpty = !hasData || maxAbsPct === 0;
  const provenance = isEmpty ? undefined : resolveProvenance(source, updatedAt, "estimated");

  if (isEmpty) {
    if (embedded) {
      return (
        <PfCockpitPanel
          variant="wide"
          chrome="embedded"
          aria-label="Capital and yield — awaiting first confirmed on-chain position"
          className="pf-capital-yield--embedded-empty"
        >
          <PfCockpitPanelHeader
            title="Capital & Yield"
            subtitle="Allocation · 12m forward yield"
            titleVariant="primary"
            trailing={leafHref ? <PortfolioLeafLink href={leafHref} /> : undefined}
          />
          <div className="cy-embedded-empty">
            <p className="cy-ledger-head body-xs ct-text-tertiary mono m-0">
              Indicative target APY band
            </p>
            <p className="tabular font-semibold ct-text-primary m-0">
              {formatApyRange(CY_ZERO_STATE.targetApyRange, 1, { spaced: true })}
            </p>
            <p className="body-xs ct-text-muted m-0">
              Allocation activates after your first confirmed on-chain position.
            </p>
          </div>
        </PfCockpitPanel>
      );
    }

    return (
      <PfCockpitPanel
        variant="wide"
        chrome="panel"
        aria-label="Capital and yield — awaiting first confirmed on-chain position"
        className="cy-panel cy-panel--onboarding-empty"
      >
        <PfCockpitPanelHeader
          title="Capital & Yield"
          subtitle="Allocation · 12m forward yield"
          titleVariant="primary"
          trailing={leafHref ? <PortfolioLeafLink href={leafHref} /> : undefined}
        />
        {/* Empty-state only — no ghost donut/ledger (a faux allocation chart next
           to "no data yet" reads as two conflicting signals). Same register as
           the Positions and Recent Activity empty states. */}
        <div className="cy-embedded-empty">
          <p className="cy-ledger-head body-xs ct-text-tertiary mono m-0">
            Indicative target APY band
          </p>
          <p className="tabular font-semibold ct-text-primary m-0">
            {formatApyRange(CY_ZERO_STATE.targetApyRange, 1, { spaced: true })}
          </p>
          <p className="body-xs ct-text-muted m-0">
            Live allocation unlocks after your first confirmed on-chain position.
          </p>
        </div>
      </PfCockpitPanel>
    );
  }

  const [rLow, rHigh] =
    blendedLow <= blendedHigh ? [blendedLow, blendedHigh] : [blendedHigh, blendedLow];
  const [sLow, sHigh] =
    stressedBearRange.low <= stressedBearRange.high
      ? [stressedBearRange.low, stressedBearRange.high]
      : [stressedBearRange.high, stressedBearRange.low];

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
        subtitle="Allocation · 12m forward yield"
        provenance={provenance}
        titleVariant="primary"
        trailing={leafHref ? <PortfolioLeafLink href={leafHref} /> : undefined}
      />

      <div className="cy-body">
        {/* ── Zone 1 — allocation gauge ── */}
        <div className="cy-donut dash-chart-container">
          {/* svg-geometry: cx/cy/r/strokeDasharray/viewBox are raw numbers by SVG spec */}
          <svg
            className="dash-chart-svg"
            viewBox="0 0 42 42"
            role="img"
            aria-label="Allocation by yield source"
          >
            <circle
              className="dash-chart-circle"
              cx="21"
              cy="21"
              r="15.9155"
              stroke="var(--ct-surface-3)"
              strokeDasharray="100 0"
            />
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
          </svg>
          <div className="donut-center">
            <>
              <span className="donut-val">{formatUsdCompact(totalValueUsdc)}</span>
              <span className="donut-lbl">Capital</span>
            </>
          </div>
        </div>

        {/* ── Zone 2 — hairline spine ── */}
        <div className="cy-spine" aria-hidden />

        {/* ── Zone 3 — yield ledger (doubles as the donut legend) ── */}
        <div className="cy-ledger">
          <p className="cy-ledger-head body-xs ct-text-tertiary mono m-0">
            Yield source · 12m fwd contribution
          </p>

          {sources.map((s) => {
            const w = barWidthPct(s.contributionPct, maxAbsPct);
            const isNeg = s.contributionPct < 0;
            const val = formatContribution(s.contributionPct, s.isVolatile ?? false);
            return (
              <div
                key={s.bucket}
                className={cn(
                  "cy-row",
                  s.bucket === "mining" && "cy-row-mining",
                )}
                style={{ "--cy-bucket": CY_BUCKET_GREEN[s.bucket] } as React.CSSProperties}
              >
                <span className="cy-dot" aria-hidden />
                <span className="cy-label body-xs min-w-0 truncate ct-text-body">
                  {s.label}
                </span>
                <span
                  className="cy-val"
                  aria-label={`${s.label} ${val}`}
                >
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
          })}

          <hr className="cy-ledger-rule" aria-hidden />

          <dl className="pf-stack--dense">
            <div className="flex items-baseline justify-between">
              <dt className="body-xs min-w-0 truncate ct-text-muted">
                Blended fwd range
              </dt>
              <dd
                className="tabular font-semibold ct-text-primary"
                aria-label={`Blended forward range ${rLow.toFixed(1)} to ${rHigh.toFixed(1)} percent`}
              >
                {formatApyRange({ low: rLow, high: rHigh })}
              </dd>
            </div>
            <div className="flex items-baseline justify-between">
              <dt className="body-xs min-w-0 truncate ct-text-muted">
                Stressed (bear) <span className="body-xs opacity-(--ct-opacity-70)">(proxy)</span>
              </dt>
              <dd
                className="tabular font-medium ct-text-body"
                aria-label={`Stressed bear scenario ${sLow.toFixed(1)} to ${sHigh.toFixed(1)} percent`}
              >
                {formatApyRange({ low: sLow, high: sHigh })}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <p className="pf-panel-footnote body-xs ct-text-tertiary" role="note">
        Conditional projection — not guaranteed ·{" "}
        {methodologyVersion.startsWith("v")
          ? methodologyVersion
          : `v${methodologyVersion}`}
      </p>
    </PfCockpitPanel>
  );
}
