import {
  PfCockpitPanel,
  PfCockpitPanelHeader,
} from "@/components/portfolio/pf-cockpit-panel";
import {
  BUCKET_COLOR,
  barWidthPct,
  formatContribution,
  type YieldSource,
} from "@/components/portfolio/yield-stack";
import type { AllocationBucketSlice } from "@/lib/data/portfolio";
import type { Provenance } from "@/components/ui/provenance-badge";
import { formatUsdCompact } from "@/lib/vaults/product-display";
import { resolveProvenance } from "@/lib/portfolio/provenance";
import { METHODOLOGY_VERSION } from "@/lib/engine/methodology";
import { cn } from "@/lib/cn";

/**
 * Capital & Yield — "Living Precision" instrument panel.
 *
 * Merges the former Yield Source Stack + Allocation donut into ONE full-width
 * showpiece: a haloed allocation gauge (left) reading across a hairline spine
 * into a precision yield ledger (right) whose rows ARE the donut legend — the
 * two halves share one per-bucket colour identity (`BUCKET_COLOR`, the
 * test-locked yield map; the ONLY green is mining = --ct-accent).
 *
 * Pure Server Component. No client JS, no Date.now()/Math.random(); all motion
 * is CSS-only (@keyframes, behind prefers-reduced-motion).
 *
 * CLAUDE.md non-negotiables: APY always a range (#1), provenance badge (#2),
 * forbidden words absent (#5), "not guaranteed" disclaimer (#10).
 */
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
  /** Render the full instrument shell at zero (layout preview / no snapshot). */
  previewZeros?: boolean;
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
  previewZeros = false,
}: CapitalYieldProps) {
  const maxAbsPct = sources.reduce(
    (acc, s) => Math.max(acc, Math.abs(s.contributionPct)),
    0,
  );
  const hasData =
    sources.length > 0 && buckets.length > 0 && totalValueUsdc > 0;
  const showZeroShell = previewZeros || !hasData || maxAbsPct === 0;
  const badgeKind: Provenance | undefined = showZeroShell
    ? undefined
    : resolveProvenance(source, updatedAt, "estimated");

  const [rLow, rHigh] =
    blendedLow <= blendedHigh ? [blendedLow, blendedHigh] : [blendedHigh, blendedLow];
  const [sLow, sHigh] =
    stressedBearRange.low <= stressedBearRange.high
      ? [stressedBearRange.low, stressedBearRange.high]
      : [stressedBearRange.high, stressedBearRange.low];

  // Pure prefix-sum dashoffset (same convention as allocation-donut.tsx):
  // r=15.9155 → C≈100, so pct maps 1:1 to stroke-dasharray; a 0.6-unit gap
  // separates adjacent arcs.
  const segments = buckets.map((slice, i) => ({
    ...slice,
    dashOffset: -buckets.slice(0, i).reduce((sum, b) => sum + b.pct, 0),
  }));

  return (
    <PfCockpitPanel
      variant="wide"
      aria-label="Capital and yield — allocation and 12 month forward yield"
      className="cy-panel"
    >
      <PfCockpitPanelHeader
        title="Capital & Yield"
        subtitle="Allocation · 12m forward yield"
        provenance={badgeKind}
        titleVariant="primary"
      />

      <div className="cy-body">
        {/* ── Zone 1 — allocation gauge ── */}
        <div className="cy-donut dash-chart-container">
          <svg
            className="dash-chart-svg"
            viewBox="0 0 42 42"
            role="img"
            aria-label={
              showZeroShell
                ? "Allocation by yield source — awaiting first snapshot"
                : "Allocation by yield source"
            }
          >
            <circle
              className="dash-chart-circle"
              cx="21"
              cy="21"
              r="15.9155"
              stroke="var(--ct-surface-3)"
              strokeDasharray="100 0"
            />
            {showZeroShell ? (
              <circle
                className="dash-chart-circle cy-donut-pending"
                cx="21"
                cy="21"
                r="15.9155"
              />
            ) : (
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
                    stroke={BUCKET_COLOR[s.bucket]}
                    strokeDasharray={`${(s.pct - 0.6).toFixed(2)} ${(100 - s.pct + 0.6).toFixed(2)}`}
                    strokeDashoffset={s.dashOffset.toFixed(2)}
                  />
                ))}
              </>
            )}
          </svg>
          <div className="donut-center">
            {showZeroShell ? (
              <span className="donut-pending-label">Awaiting snapshot</span>
            ) : (
              <>
                <span className="donut-val">{formatUsdCompact(totalValueUsdc)}</span>
                <span className="donut-lbl">Capital</span>
              </>
            )}
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
            const w = showZeroShell ? 0 : barWidthPct(s.contributionPct, maxAbsPct);
            const isNeg = !showZeroShell && s.contributionPct < 0;
            const val = showZeroShell
              ? "—"
              : formatContribution(s.contributionPct, s.isVolatile ?? false);
            return (
              <div
                key={s.bucket}
                className={cn(
                  "cy-row",
                  s.bucket === "mining" && "cy-row-mining",
                  showZeroShell && "cy-row--pending",
                )}
                style={{ "--cy-bucket": BUCKET_COLOR[s.bucket] } as React.CSSProperties}
              >
                <span className="cy-dot" aria-hidden />
                <span
                  className={cn(
                    "cy-label body-xs min-w-0 truncate",
                    showZeroShell
                      ? "ct-text-faint"
                      : s.isVolatile
                        ? "ct-status-warning"
                        : "ct-text-body",
                  )}
                >
                  {s.label}
                </span>
                <span
                  className={cn(
                    "cy-val",
                    showZeroShell
                      ? "ct-text-faint"
                      : isNeg
                        ? "ct-status-danger"
                        : undefined,
                  )}
                  aria-label={
                    showZeroShell ? `${s.label} pending` : `${s.label} ${val}`
                  }
                >
                  {val}
                </span>
                <div
                  className={cn("cy-track", showZeroShell && "cy-track--pending")}
                  aria-hidden
                >
                  <span className="cy-ticks" />
                  {!showZeroShell ? (
                    <span
                      className={cn(
                        "cy-fill",
                        isNeg && "cy-fill--neg",
                        s.isVolatile && "cy-fill--volatile",
                      )}
                      style={{ width: `${w.toFixed(1)}%` }}
                    />
                  ) : null}
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
                className={cn(
                  "tabular font-semibold",
                  showZeroShell ? "ct-text-faint" : "ct-text-primary",
                )}
                aria-label={
                  showZeroShell
                    ? "Blended forward range pending"
                    : `Blended forward range ${rLow.toFixed(1)} to ${rHigh.toFixed(1)} percent`
                }
              >
                {showZeroShell ? "—" : `${rLow.toFixed(1)}–${rHigh.toFixed(1)}%`}
              </dd>
            </div>
            <div className="flex items-baseline justify-between">
              <dt className="body-xs min-w-0 truncate ct-text-muted">
                Stressed (bear) <span className="body-xs opacity-[var(--ct-opacity-70)]">(proxy)</span>
              </dt>
              <dd
                className={cn(
                  "tabular font-medium",
                  showZeroShell ? "ct-text-faint" : "ct-status-warning",
                )}
                aria-label={
                  showZeroShell
                    ? "Stressed bear scenario pending"
                    : `Stressed bear scenario ${sLow.toFixed(1)} to ${sHigh.toFixed(1)} percent`
                }
              >
                {showZeroShell ? "—" : `${sLow.toFixed(1)}–${sHigh.toFixed(1)}%`}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {!showZeroShell ? (
        <p className="pf-panel-footnote body-xs ct-text-faint" role="note">
          Conditional projection — not guaranteed ·{" "}
          {methodologyVersion.startsWith("v")
            ? methodologyVersion
            : `v${methodologyVersion}`}
        </p>
      ) : null}
    </PfCockpitPanel>
  );
}
