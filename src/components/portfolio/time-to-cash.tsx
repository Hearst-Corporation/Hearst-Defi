// TimeToCash — "Time to Cash" widget for LP dashboard.
// Server Component (pure — no I/O, no side effects beyond effectiveAsOf fallback).
// Non-negotiable #1: projected USDC shown as estimate (no guarantee).
// Non-negotiable #2: dual ProvenanceBadge Live (cycle) + Estimate (projected USDC).

import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { ApyRange } from "@/components/ui/apy-range";
import { cn } from "@/lib/cn";
import { computeTimeToCash } from "@/lib/data/time-to-cash";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TimeToCashProps {
  /** When the current monthly cycle started (typically 1st of month). */
  cycleStart: Date;
  /** Cycle length in days (typically 30). */
  cycleDays: number;
  /** Projected USDC amount based on current pool yield. */
  projectedUsdc: number;
  /** Pool current APR range for the disclosure. */
  aprLow: number;
  /** Pool current APR range for the disclosure. */
  aprHigh: number;
  /** As-of timestamp. Defaults to new Date(). */
  asOf?: Date;
  /** Provenance of the underlying data. "stale" when no investor / no position / no yield. */
  source?: "live" | "stale";
}

// ── Formatters ────────────────────────────────────────────────────────────────

const usdcFmt = new Intl.NumberFormat("en-US", {
  style: "decimal",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
  useGrouping: true,
});

function formatUsdc(amount: number): string {
  return usdcFmt.format(Math.round(amount));
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Time-to-Cash widget.
 *
 * Displays:
 *   - Countdown to next distribution (days + hours remaining)
 *   - Cycle progress bar with aria-progressbar semantics
 *   - Projected USDC amount (estimate, not a guarantee)
 *   - Dual provenance: Live (cycle clock) + Estimate (projected USDC)
 */
export function TimeToCash({
  cycleStart,
  cycleDays,
  projectedUsdc,
  aprLow,
  aprHigh,
  asOf,
  source,
}: TimeToCashProps) {
  const effectiveAsOf = asOf ?? new Date();

  // No-data guard: stale source OR no projected payout OR flat 0 APR range.
  // When triggered, both the cycle badge and the APY range provenance flip to
  // "Stale" so we don't badge "Live" on top of meaningless zeroes.
  const isStale =
    source === "stale" || projectedUsdc === 0 || aprLow + aprHigh === 0;
  const cycleBadgeKind = isStale ? "stale" : "live";
  const apyBadgeKind = isStale ? "stale" : "estimated";

  const { daysElapsed, daysRemaining, hoursRemaining, progressPct } =
    computeTimeToCash({ cycleStart, cycleDays, asOf: effectiveAsOf });

  const progressRounded = Math.round(progressPct);

  const progressLabel = `Distribution cycle progress: ${progressRounded}% — Day ${daysElapsed} of ${cycleDays}. ${
    daysRemaining === 0 && hoursRemaining === 0
      ? "Distribution period reached."
      : `${daysRemaining}d ${hoursRemaining}h remaining.`
  }`;

  const countdownText =
    daysRemaining === 0 && hoursRemaining === 0
      ? "Distribution reached"
      : `~${usdcFmt.format(Math.round(projectedUsdc))} USDC in ${daysRemaining}d ${hoursRemaining}h`;

  return (
    <article
      className="dash-cell dash-cell-premium flex flex-col gap-3"
      aria-label="Time to next distribution"
    >
      {/* Header row -------------------------------------------------------- */}
      <div className="flex items-center justify-between gap-2 relative z-10">
        <span className="dash-label mb-0">
          TIME TO CASH
        </span>
        <div className="flex items-center gap-1.5">
          <ProvenanceBadge kind={cycleBadgeKind} />
          <ProvenanceBadge kind={apyBadgeKind} />
        </div>
      </div>

      {/* Next distribution row --------------------------------------------- */}
      <div className="flex flex-col gap-0.5 relative z-10 min-w-0">
        <span className="text-micro font-medium text-[var(--ct-text-muted)] tracking-widest uppercase">
          Next distribution
        </span>
        {/* Countdown — aria-live so JS can update it client-side if hydrated */}
        <p
          className={cn(
            "mono tabular-nums text-xl font-semibold leading-tight break-words",
            daysRemaining === 0 && hoursRemaining === 0
              ? "text-[var(--ct-status-success)]"
              : "text-[var(--ct-text-primary)]",
          )}
          aria-live="polite"
          aria-atomic="true"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {countdownText}
        </p>
      </div>

      {/* Progress bar ------------------------------------------------------ */}
      <div className="flex flex-col gap-1.5 relative z-10">
        <div
          role="progressbar"
          aria-valuenow={progressRounded}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={progressLabel}
          className="relative h-2 w-full overflow-hidden rounded-full bg-black/20 border border-[var(--ct-border-soft)]"
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-[var(--ct-dur-base)]"
            style={{
              width: `${progressPct}%`,
              background: "var(--ct-accent)",
              boxShadow: "0 0 8px var(--ct-accent)",
            }}
          />
        </div>

        {/* Day counter label */}
        <div className="flex items-center justify-between">
          <span
            className="body-xs tabular mono text-[var(--ct-text-muted)]"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            Day {daysElapsed} of {cycleDays}
          </span>
          <span
            className="body-xs tabular mono text-[var(--ct-text-muted)]"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {progressRounded}%
          </span>
        </div>
      </div>

      {/* Disclosure -------------------------------------------------------- */}
      <p
        className="body-xs italic relative z-10"
        style={{ color: "var(--ct-text-faint)" }}
      >
        Projected from current pool yield <ApyRange low={aprLow} high={aprHigh} className="text-inherit font-inherit" suffix="%" /> APR.{" "}
        <span aria-label="Not guaranteed">Not guaranteed — estimate only.</span>
      </p>

      {/* Settings CTA ------------------------------------------------------ */}
      <div className="flex items-center justify-between border-t border-[var(--ct-border-soft)] pt-2 mt-auto relative z-10">
        <span className="body-xs text-[var(--ct-text-muted)]">
          {formatUsdc(projectedUsdc)} USDC projected
        </span>
        <button
          type="button"
          className="body-xs text-[var(--ct-text-muted)] flex items-center gap-1 hover:text-[var(--ct-text-primary)] transition-colors"
          aria-label="Open distribution notification settings"
        >
          Settings{" "}
          <span aria-hidden>→</span>
          <span className="sr-only">notify me 24h before</span>
        </button>
      </div>
    </article>
  );
}
