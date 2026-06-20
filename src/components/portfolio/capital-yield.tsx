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
  buckets: [
    { label: "Mining", pct: 62, color: "var(--ct-accent)", opacity: 0.45 },
    { label: "USDC Base", pct: 18, color: "var(--ct-accent)", opacity: 0.28 },
    { label: "BTC Tactical", pct: 12, color: "var(--ct-accent)", opacity: 0.18 },
    { label: "Reserve", pct: 8, color: "var(--ct-accent)", opacity: 0.11 },
  ],
  ledgerRows: [
    { label: "Mining yield", w: 78, apy: "9-13%" },
    { label: "USDC base", w: 52, apy: "4-6%" },
    { label: "BTC tactical", w: 38, apy: "2-4%" },
    { label: "Reserve buffer", w: 22, apy: "1-2%" },
  ],
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
    const previewApyRange = formatApyRange(CY_ZERO_STATE.targetApyRange);

    if (embedded) {
      return (
        <PfCockpitPanel
          variant="wide"
          chrome="embedded"
          aria-label="Capital and yield — awaiting first position"
          className="cy-panel cy-panel--embedded-empty"
        >
          <PfCockpitPanelHeader
            title="Capital & Yield"
            subtitle="Allocation · 12m forward yield"
            titleVariant="primary"
            trailing={leafHref ? <PortfolioLeafLink href={leafHref} /> : undefined}
          />
          <div className="cy-embedded-empty">
            <p className="cy-ledger-head body-xs ct-text-faint mono m-0">Target APY band</p>
            <p className="tabular font-semibold ct-text-accent m-0">
              {formatApyRange(CY_ZERO_STATE.targetApyRange, 1, { spaced: true })}
            </p>
            <p className="body-xs ct-text-muted m-0">
              Allocation activates after first confirmed position.
            </p>
          </div>
        </PfCockpitPanel>
      );
    }

    let offset = 0;
    return (
      <PfCockpitPanel
        variant="wide"
        chrome="panel"
        aria-label="Capital and yield — awaiting first position"
        className="cy-panel cy-panel--onboarding-empty"
      >
        <PfCockpitPanelHeader
          title="Capital & Yield"
          subtitle="Allocation · 12m forward yield"
          titleVariant="primary"
          trailing={leafHref ? <PortfolioLeafLink href={leafHref} /> : undefined}
        />
        <div className="cy-body">
          {/* Ghost donut */}
          <div className="cy-donut dash-chart-container">
            <svg className="dash-chart-svg" viewBox="0 0 42 42" aria-hidden="true">
              <defs>
                <radialGradient id="cy-ghost-bloom" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="var(--ct-accent)" stopOpacity="0.14" />
                  <stop offset="100%" stopColor="var(--ct-accent)" stopOpacity="0" />
                </radialGradient>
              </defs>
              <circle cx="21" cy="21" r="18" fill="url(#cy-ghost-bloom)" />
              {/* Ghost track */}
              <circle cx="21" cy="21" r="15.9155" fill="none"
                stroke="var(--ct-border-soft)" strokeWidth="4.4" strokeDasharray="100 0" />
              {/* Ghost segments */}
              {CY_ZERO_STATE.buckets.map((b) => {
                const dash = `${(b.pct - 0.6).toFixed(2)} ${(100 - b.pct + 0.6).toFixed(2)}`;
                const dashOffset = -offset;
                offset += b.pct;
                return (
                  <circle key={b.label} cx="21" cy="21" r="15.9155" fill="none"
                    stroke={b.color} strokeWidth="4.4"
                    strokeDasharray={dash}
                    strokeDashoffset={dashOffset.toFixed(2)}
                    opacity={b.opacity}
                  />
                );
              })}
            </svg>
            <div className="donut-center">
              <span className="donut-pending-label">Awaiting snapshot</span>
            </div>
          </div>
          <div className="cy-spine" aria-hidden />

          {/* Ghost ledger */}
          <div className="cy-ledger">
            <p className="cy-ledger-head body-xs ct-text-faint mono m-0">
              Indicative yield structure
            </p>
            {CY_ZERO_STATE.ledgerRows.map((b) => (
              <div key={b.label} className="cy-row cy-row--pending">
                <span className="cy-dot" style={{ background: "var(--ct-border-soft)" }} />
                <span className="cy-label body-xs ct-text-faint">{b.label}</span>
                <span className="cy-val" style={{ opacity: "var(--ct-opacity-35)" }}>{b.apy}</span>
                <div className="cy-track cy-track--pending" style={{ gridColumn: "1 / -1" }}>
                  <div className="cy-fill" style={{
                    width: `${b.w}%`,
                    background: `color-mix(in srgb, var(--ct-accent) 20%, var(--ct-border-soft))`,
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="cy-panel__empty-copy body-xs ct-text-faint m-0" role="status">
          Live allocation unlocks after your first confirmed position.
        </p>
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
      className="cy-panel"
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
          <p className="cy-ledger-head body-xs ct-text-faint mono m-0">
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

      <p className="pf-panel-footnote body-xs ct-text-faint" role="note">
        Conditional projection — not guaranteed ·{" "}
        {methodologyVersion.startsWith("v")
          ? methodologyVersion
          : `v${methodologyVersion}`}
      </p>
    </PfCockpitPanel>
  );
}
