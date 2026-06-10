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

import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";

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
}

// ── Pure helpers (also exported for unit tests) ───────────────────────────────

/** CSS custom property for each bucket's bar colour (token-only, no hex).
 *  Vert canonique = accent uniquement. Tout autre bucket utilise un token
 *  non-vert pour rester distinct visuellement (cohérence allocation-colors.ts). */
export const BUCKET_COLOR: Record<YieldSource["bucket"], string> = {
  mining:          "var(--ct-accent)",         // vert canonique #A7FB90
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
  methodologyVersion = "1.0",
  source = "estimated",
}: YieldStackProps) {
  // ... (rest of normalization)
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

  return (
    <article
      className="dash-cell dash-cell-premium h-full flex flex-col"
      aria-label="Yield source stack — 12 month forward projection"
    >
      {/* Header */}
      <div className="dash-label relative z-10">
        <span className="body-xs uppercase tracking-[var(--ct-tracking-wide)] text-[var(--ct-text-muted)]">
          Yield Source Stack (12m fwd)
        </span>
        <ProvenanceBadge kind={source} />
      </div>

      {/* Visual bar stack */}
      <div
        className="mt-3 flex flex-col gap-2 relative z-10"
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
                      ? "text-[var(--ct-status-warning)]"
                      : "text-[var(--ct-text-body)]",
                  )}
                >
                  {s.label}
                </span>
                <span
                  className={cn(
                    "tabular text-[length:var(--ct-text-xs)] font-medium",
                    isNegative
                      ? "text-[var(--ct-status-danger)]"
                      : s.isVolatile
                        ? "text-[var(--ct-status-warning)]"
                        : "text-[var(--ct-text-strong)]",
                  )}
                >
                  {contribution}
                </span>
              </div>

              {/* Bar track */}
              <div
                className="relative h-1.5 rounded-[var(--ct-radius-full)] overflow-hidden"
                style={{ background: "var(--ct-surface-2)" }}
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-[var(--ct-radius-full)] transition-[width] duration-300"
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

      {/* Empty state — no allocation snapshot in DB yet. */}
      {!hasData && (
        <p className="body-sm text-[var(--ct-text-muted)] mt-3 relative z-10" role="note">
          No yield source data yet — awaiting first vault snapshot.
        </p>
      )}

      {/* Divider */}
      {hasData && (
        <hr
          className="my-4 border-0 border-t border-[var(--ct-border-soft)] relative z-10"
          aria-hidden="true"
        />
      )}

      {/* Summary metrics — only when we have a snapshot. */}
      {hasData && (
        <dl className="flex flex-col gap-2 relative z-10">
          {/* Blended forward range */}
          <div className="flex items-baseline justify-between">
            <dt className="body-xs min-w-0 truncate text-[var(--ct-text-muted)]">
              Blended fwd range
            </dt>
            <dd
              className="tabular font-semibold text-[var(--ct-text-primary)]"
              aria-label={`Blended forward range ${rangeLow.toFixed(1)} to ${rangeHigh.toFixed(1)} percent`}
            >
              {rangeLow.toFixed(1)}–{rangeHigh.toFixed(1)}%
            </dd>
          </div>

          {/* Stressed bear scenario — range per CLAUDE.md #1, never single point. */}
          <div className="flex items-baseline justify-between">
            <dt className="body-xs min-w-0 truncate text-[var(--ct-text-muted)]">
              Stressed (bear)
            </dt>
            <dd
              className="tabular font-medium text-[var(--ct-status-warning)]"
              aria-label={`Stressed bear scenario ${stressedLow.toFixed(1)} to ${stressedHigh.toFixed(1)} percent`}
            >
              {stressedLow.toFixed(1)}–{stressedHigh.toFixed(1)}%
            </dd>
          </div>
        </dl>
      )}

      {/* Disclaimer — visible, not tooltip-only (CLAUDE.md non-negotiable #10) */}
      <p
        className="mt-auto pt-4 body-xs italic text-[var(--ct-text-faint)] relative z-10"
        role="note"
      >
        not guaranteed · methodology v{methodologyVersion} · projections show
        assumptions only
      </p>
    </article>
  );
}
