// TimeToCash — "Time to Cash" widget for LP dashboard.
// Server Component (pure — no I/O, no side effects beyond effectiveAsOf fallback).
// Non-negotiable #1: projected USDC shown as estimate (no guarantee).
// Non-negotiable #2: dual ProvenanceBadge Live (cycle) + Estimate (projected USDC).

import { AwaitingMetricState } from "@/components/ui/awaiting-metric-state";
import { ModuleChrome } from "@/components/ui/module-chrome";
import { WidgetPanelHeader } from "@/components/ui/widget-panel-header";
import { ApyRange } from "@/components/ui/apy-range";
import { cn } from "@/lib/cn";
import { computeTimeToCash } from "@/lib/data/time-to-cash";
import { PreviewModeChip } from "@/components/portfolio/layout-preview-banner";
import { resolveProvenance } from "@/lib/portfolio/provenance";

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
  /** Provenance metadata from the loader. */
  source?: "live" | "stale";
  updatedAt?: Date;
  /** Layout preview at zero — awaiting surface only (DS §9.3). */
  previewZeros?: boolean;
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
  updatedAt,
  previewZeros = false,
}: TimeToCashProps) {
  const effectiveAsOf = asOf ?? new Date();

  // No-data guard: stale source OR no projected payout OR flat 0 APR range.
  // When triggered, both the cycle badge and the APY range provenance flip to
  // "Stale" so we don't badge "Live" on top of meaningless zeroes.
  const isStale =
    !previewZeros &&
    (source === "stale" || projectedUsdc === 0 || aprLow + aprHigh === 0);

  const widgetProvenance = previewZeros
    ? undefined
    : resolveProvenance(source ?? "live", updatedAt, "estimated");

  if (isStale) {
    return (
      <AwaitingMetricState
        message="Distribution cycle starts after your first active position."
        detail="Payout timing and projected USDC appear once deposited capital is confirmed and yield data is live."
      />
    );
  }

  const { daysElapsed, daysRemaining, hoursRemaining, progressPct } =
    computeTimeToCash({ cycleStart, cycleDays, asOf: effectiveAsOf });

  const progressRounded = Math.round(progressPct);
  const displayedProgressPct = previewZeros ? 0 : isStale ? 0 : progressPct;
  const displayedProgressLabel =
    previewZeros || isStale ? "Pending" : `${progressRounded}%`;

  const progressLabel =
    previewZeros || isStale
    ? "Distribution cycle unavailable until an active position and current yield are available."
    : `Distribution cycle progress: ${progressRounded}% — Day ${daysElapsed} of ${cycleDays}. ${
        daysRemaining === 0 && hoursRemaining === 0
          ? "Distribution period reached."
          : `${daysRemaining}d ${hoursRemaining}h remaining.`
      }`;

  const countdownText =
    previewZeros
      ? "$0 USDC projected"
      : isStale
        ? "Payout starts after activation"
        : daysRemaining === 0 && hoursRemaining === 0
          ? "Distribution reached"
          : `~${usdcFmt.format(Math.round(projectedUsdc))} USDC in ${daysRemaining}d ${hoursRemaining}h`;

  return (
    <ModuleChrome aria-label="Time to next distribution" className="gap-3">
      <WidgetPanelHeader
        title="Time to cash"
        provenance={widgetProvenance}
        trailing={
          previewZeros ? (
            <PreviewModeChip label="Awaiting first position" />
          ) : undefined
        }
      />

      {/* Next distribution row --------------------------------------------- */}
      <div className="flex flex-col gap-0.5 relative z-10 min-w-0">
        <span className="stat-label">Next distribution</span>
        <p
          className={cn(
            "stat-value tabular-nums mono break-words",
            previewZeros || isStale
              ? "ct-text-primary"
              : daysRemaining === 0 && hoursRemaining === 0
                ? "ct-status-success"
                : "ct-text-primary",
          )}
          aria-live="polite"
          aria-atomic="true"
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
          className="pf-progress-track"
        >
          <div
            className="pf-progress-fill pf-progress-fill--accent"
            style={{ width: `${displayedProgressPct}%` }}
          />
        </div>

        {/* Day counter label */}
        <div className="flex items-center justify-between">
          <span className="body-xs tabular mono ct-text-muted ct-tabular-nums">
            {previewZeros || isStale ? "Cycle pending" : `Day ${daysElapsed} of ${cycleDays}`}
          </span>
          <span className="body-xs tabular mono ct-text-muted ct-tabular-nums">
            {displayedProgressLabel}
          </span>
        </div>
      </div>

      {/* Disclosure -------------------------------------------------------- */}
      <p className="body-xs italic relative z-10 ct-text-faint">
        {previewZeros || isStale ? (
          <>No payout projection until the first active position has current yield data.</>
        ) : (
          <>
            Projected from current pool yield <ApyRange low={aprLow} high={aprHigh} className="text-inherit font-inherit" suffix="%" /> APR.{" "}
            <span aria-label="Not guaranteed">Not guaranteed — estimate only.</span>
          </>
        )}
      </p>

      {/* Settings CTA ------------------------------------------------------ */}
      <div className="flex items-center justify-between border-t border-(--ct-border-soft) pt-2 mt-auto relative z-10">
        <span className="body-xs ct-text-muted">
          {previewZeros || isStale
            ? "Projection pending"
            : `${formatUsdc(projectedUsdc)} USDC projected`}
        </span>
        <span className="body-xs ct-text-faint">Notifications after first payout</span>
      </div>
    </ModuleChrome>
  );
}
