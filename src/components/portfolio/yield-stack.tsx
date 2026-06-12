/**
 * YieldStack — Yield Source Stack (12 m forward) widget for LP dashboard.
 *
 * Pure Server Component. No I/O, no Date.now(), no Math.random().
 * ProvenanceBadge: "estimated" (closest available kind — "Hypothesis" is not
 * a valid Provenance kind in this codebase).
 *
 * CLAUDE.md non-negotiables enforced:
 *  #1  APY always as range.
 *  #2  Every metric has a provenance badge.
 *  #5  Forbidden words absent (guarantee excluded by "not guaranteed" phrase).
 */

import {
  PfCockpitPanel,
  PfCockpitPanelHeader,
} from "@/components/portfolio/pf-cockpit-panel";
import { cn } from "@/lib/cn";
import { resolveProvenance } from "@/lib/portfolio/provenance";
import { METHODOLOGY_VERSION } from "@/lib/engine/methodology";

// ── Types ────────────────────────────────────────────────────────────────────

export interface YieldSource {
  bucket: "mining" | "usdc_base" | "btc_tactical" | "stable_reserve";
  label: string;
  contributionPct: number; // may be negative for tactical
  isVolatile?: boolean;    // if true, render ± prefix
}

export interface YieldStackProps {
  sources: YieldSource[];
  blendedLow: number;   // e.g. 9.4
  blendedHigh: number;  // e.g. 12.8
  /** Stressed (bear) APY as a range — CLAUDE.md #1, never single point. */
  stressedBearRange: { low: number; high: number };
  methodologyVersion?: string;
  /** Provenance for the badge — defaults to "estimated" when omitted. */
  source?: "live" | "estimated" | "stale";
  updatedAt?: Date;
  /** Render full widget shell at 0% (layout preview). */
  previewZeros?: boolean;
}

// ── Pure helpers (also exported for unit tests) ───────────────────────────────

/** CSS custom property for each bucket's bar colour (token-only, no hex).
 *  Vert canonique = accent uniquement. Tout autre bucket utilise un token
 *  non-vert pour rester distinct visuellement (cohérence allocation-colors.ts). */
export const BUCKET_COLOR: Record<YieldSource["bucket"], string> = {
  mining:          "var(--ct-accent)",         // vert canonique var(--ct-accent)
  usdc_base:       "var(--ct-status-info)",    // bleu — base stable
  btc_tactical:    "var(--ct-status-warning)", // orange — volatile
  stable_reserve:  "var(--ct-text-faint)",     // gris
};

/**
 * Compute bar width as a percentage of the maximum absolute contribution.
 * Returns a value 0–100.
 */
export function barWidthPct(
  contributionPct: number,
  maxAbsPct: number,
): number {
  if (maxAbsPct <= 0) return 0;
  return Math.min(100, (Math.abs(contributionPct) / maxAbsPct) * 100);
}

/**
 * Format a contribution value with sign.
 * isVolatile=true → "±1.5%", positive → "+4.8%", negative → "−1.5%".
 */
export function formatContribution(
  contributionPct: number,
  isVolatile: boolean,
): string {
  const abs = Math.abs(contributionPct).toFixed(1);
  if (isVolatile) return `±${abs}%`;
  if (contributionPct < 0) return `−${abs}%`;
  return `+${abs}%`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function YieldStack({
  sources,
  blendedLow,
  blendedHigh,
  stressedBearRange,
  methodologyVersion = METHODOLOGY_VERSION,
  source = "estimated",
  updatedAt,
  previewZeros = false,
}: YieldStackProps) {
  // ...
  const [stressedLow, stressedHigh] =
    stressedBearRange.low <= stressedBearRange.high
      ? [stressedBearRange.low, stressedBearRange.high]
      : [stressedBearRange.high, stressedBearRange.low];
  const maxAbsPct = sources.reduce(
    (acc, s) => Math.max(acc, Math.abs(s.contributionPct)),
    0,
  );

  // Normalise low/high so range is always low → high.
  const [rangeLow, rangeHigh] =
    blendedLow <= blendedHigh
      ? [blendedLow, blendedHigh]
      : [blendedHigh, blendedLow];

  const hasData = sources.length > 0;

  const showZeroShell = previewZeros || !hasData || maxAbsPct === 0;
  const badgeKind = showZeroShell
    ? undefined
    : resolveProvenance(source, updatedAt, "estimated");

  return (
    <PfCockpitPanel
      variant="wide"
      aria-label="Yield source stack — 12 month forward projection"
    >
      <PfCockpitPanelHeader
        title="Yield source stack"
        subtitle="12m forward"
        provenance={badgeKind}
      />

      {/* Visual bar stack */}
      <div
        className="flex flex-col gap-2"
        aria-hidden="true"
        role="presentation"
      >
        {sources.map((s) => {
          const widthPct = barWidthPct(s.contributionPct, maxAbsPct);
          const color = BUCKET_COLOR[s.bucket];
          const contribution = formatContribution(
            s.contributionPct,
            s.isVolatile ?? false,
          );
          const isNegative = s.contributionPct < 0;

          return (
            <div key={s.bucket} className="yield-stack-row">
              {/* Label row */}
              <div className="flex items-center justify-between gap-2 mb-1">
                <span
                  className={cn(
                    "body-xs min-w-0 truncate",
                    s.isVolatile
                      ? "ct-status-warning"
                      : "ct-text-body",
                  )}
                >
                  {s.label}
                </span>
                <span
                  className={cn(
                    "tabular body-xs font-medium",
                    isNegative
                      ? "ct-status-danger"
                      : s.isVolatile
                        ? "ct-status-warning"
                        : "ct-text-strong",
                  )}
                >
                  {contribution}
                </span>
              </div>

              {/* Bar track */}
              <div
                className="relative h-1.5 rounded-full overflow-hidden ct-surface-2"
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-(--ct-dur-base)"
                  style={{
                    width: `${widthPct.toFixed(1)}%`,
                    background: color,
                    opacity: isNegative ? 0.6 : 1,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <hr className="my-2 border-0 border-t border-(--ct-border-soft)" aria-hidden />

      <dl className="flex flex-col gap-1.5">
          {/* Blended forward range */}
          <div className="flex items-baseline justify-between">
            <dt className="body-xs min-w-0 truncate ct-text-muted">
              Blended fwd range
            </dt>
            <dd
              className="tabular font-semibold ct-text-primary"
              aria-label={`Blended forward range ${rangeLow.toFixed(1)} to ${rangeHigh.toFixed(1)} percent`}
            >
              {rangeLow.toFixed(1)}–{rangeHigh.toFixed(1)}%
            </dd>
          </div>

          {/* Stressed bear scenario — range per CLAUDE.md #1, never single point. */}
          <div className="flex items-baseline justify-between">
            <dt className="body-xs min-w-0 truncate ct-text-muted">
              Stressed (bear) <span className="text-micro opacity-70">(proxy)</span>
            </dt>
            <dd
              className="tabular font-medium ct-status-warning"
              aria-label={`Stressed bear scenario ${stressedLow.toFixed(1)} to ${stressedHigh.toFixed(1)} percent`}
            >
              {stressedLow.toFixed(1)}–{stressedHigh.toFixed(1)}%
            </dd>
          </div>
        </dl>

      <p className="mt-auto pt-2 body-xs ct-text-faint m-0" role="note">
        Conditional projection — not guaranteed · {methodologyVersion.startsWith("v") ? methodologyVersion : `v${methodologyVersion}`}
      </p>
    </PfCockpitPanel>
  );
}
