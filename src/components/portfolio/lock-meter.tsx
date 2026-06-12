// LockMeter — Lock / Liquidity progress widget for LP dashboard.
// Server Component (pure — no I/O, no side effects).
// Non-negotiable #2: ProvenanceBadge kind="live" (CLAUDE.md).

import { AwaitingMetricState } from "@/components/portfolio/awaiting-metric-state";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
// ── Internal helpers (exported for unit tests) ────────────────────────────────

/** Clamp a value between min and max (inclusive). */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Format basis-points as a locale percentage string, e.g. 150 → "1.5%". */
export function formatBps(bps: number): string {
  const pct = bps / 100;
  // Avoid trailing zeros only when they are irrelevant (e.g. 200bps → "2%").
  const formatted = pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1);
  return `${formatted}%`;
}

/** All derived values from the lock-meter calculation. */
export interface LockMeterCalc {
  daysElapsed: number;
  progressPct: number;
  unlockDate: Date;
  daysRemaining: number;
  isUnlocked: boolean;
}

/** Pure calculation — no Date.now(), only the injected `asOf` param. */
export function computeLockMeter(
  lockStart: Date,
  softLockupDays: number,
  asOf: Date,
): LockMeterCalc {
  const MS_PER_DAY = 86_400_000;
  const daysElapsed = Math.floor(
    (asOf.getTime() - lockStart.getTime()) / MS_PER_DAY,
  );
  // softLockupDays <= 0 means the share class terms are not yet known (loader
  // returns 0 when no `Position.shareClass` is wired). Surface a neutral state
  // rather than dividing by zero and emitting NaN%.
  if (softLockupDays <= 0) {
    return {
      daysElapsed,
      progressPct: 0,
      unlockDate: lockStart,
      daysRemaining: 0,
      isUnlocked: false,
    };
  }
  const progressPct = clamp((daysElapsed / softLockupDays) * 100, 0, 100);
  const unlockDate = new Date(lockStart.getTime() + softLockupDays * MS_PER_DAY);
  const daysRemaining = Math.max(0, softLockupDays - daysElapsed);
  const isUnlocked = daysRemaining === 0;

  return { daysElapsed, progressPct, unlockDate, daysRemaining, isUnlocked };
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface LockMeterProps {
  /** Date the lockup started (typically tx confirmation). */
  lockStart: Date;
  /** Soft-lockup duration in days (e.g. 60 for class A). */
  softLockupDays: number;
  /** Early-exit penalty in basis points (e.g. 150 = 1.5%). */
  earlyExitPenaltyBps?: number;
  /** As-of timestamp for the rendering (server time). Defaults to new Date(). */
  asOf?: Date;
  /** Provenance metadata from the loader. */
  source?: "live" | "stale";
  updatedAt?: Date;
}

const unlockDateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/**
 * Lock · Liquidity meter widget.
 *
 * Displays the lockup progress for a vault position:
 *   - Progress bar with aria-progressbar semantics
 *   - Unlock date + days remaining
 *   - Early-exit penalty (when applicable)
 *   - ProvenanceBadge derived from loader state (CLAUDE.md non-negotiable #2)
 */
export function LockMeter({
  lockStart,
  softLockupDays,
  earlyExitPenaltyBps,
  asOf,
  source = "live",
}: LockMeterProps) {
  const effectiveAsOf = asOf ?? new Date();

  // When share-class terms are not wired, render a neutral "no data" state
  // instead of a fabricated progress bar.
  const termsUnknown = softLockupDays <= 0;

  if (termsUnknown || source === "stale") {
    return (
      <AwaitingMetricState
        message="Lock and liquidity terms appear after your first active position."
        detail="Soft lock-up progress and unlock dates populate once share-class terms are tied to a confirmed deposit."
      />
    );
  }

  const { progressPct, unlockDate, daysRemaining, isUnlocked } =
    computeLockMeter(lockStart, softLockupDays, effectiveAsOf);

  const badgeKind = "live";

  // Penalty text color: faint when more than 50% elapsed (less urgent),
  // warning when less than 50% elapsed (early-exit risk is high).
  const penaltyHalfPassed = progressPct >= 50;

  const progressLabel = `Lockup progress: ${Math.floor(progressPct)}% — ${
    isUnlocked
      ? "fully unlocked"
      : `${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining of ${softLockupDays}`
  }`;

  return (
    <article
      className="dash-cell dash-cell-premium flex flex-col gap-3"
      aria-label="Lock and liquidity status"
    >
      {/* Header row -------------------------------------------------------- */}
      <div className="pf-widget-header relative z-10">
        <Tooltip content="Progress towards your 60-day soft lockup period">
          <h3 className="h3 cursor-help border-b border-dotted border-(--ct-border-soft)">
            Lock · liquidity
          </h3>
        </Tooltip>
        <ProvenanceBadge kind={badgeKind} />
      </div>

      {/* Progress bar ------------------------------------------------------ */}
      <div className="flex flex-col gap-1.5 relative z-10">
        {/* Bar */}
        <div
          role="progressbar"
          aria-valuenow={Math.round(progressPct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={progressLabel}
          className="pf-progress-track"
        >
          <div
            className={cn(
              "pf-progress-fill",
              isUnlocked ? "pf-progress-fill--success" : "pf-progress-fill--accent",
            )}
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Percentage label */}
        <div className="flex items-center justify-between">
          <span
            className={cn(
              "body-xs tabular mono",
              termsUnknown
                ? "ct-text-faint"
                : isUnlocked
                  ? "ct-status-success"
                  : "ct-text-primary",
            )}
          >
            {termsUnknown ? "—" : `${Math.round(progressPct)}%`}
          </span>
          {!termsUnknown && !isUnlocked && (
            <span className="body-xs tabular mono ct-text-muted">
              {daysRemaining}d left
            </span>
          )}
        </div>
      </div>

      {/* Metadata ---------------------------------------------------------- */}
      <dl className="flex flex-col gap-1 relative z-10 mt-auto">
        {/* Unlock date */}
        <div className="flex items-center justify-between gap-2">
          <dt className="body-xs ct-text-muted">
            {termsUnknown ? "Lock terms" : isUnlocked ? "Unlocked" : "Unlock"}
          </dt>
          <dd
            className={cn(
              "body-xs tabular mono m-0",
              termsUnknown
                ? "ct-text-faint"
                : isUnlocked
                  ? "ct-status-success"
                  : "ct-text-primary",
            )}
          >
            {termsUnknown ? "—" : isUnlocked ? "Now" : unlockDateFmt.format(unlockDate)}
          </dd>
        </div>

        {/* Early-exit penalty (only shown when still locked) */}
        {!isUnlocked && earlyExitPenaltyBps !== undefined && (
          <div className="flex items-center justify-between gap-2">
            <Tooltip content="Early-exit penalty applied to withdrawals before the lockup period ends">
              <dt className="body-xs ct-text-muted cursor-help border-b border-dotted border-(--ct-border-soft)">Penalty</dt>
            </Tooltip>
            <dd
              className={cn(
                "body-xs tabular mono m-0",
                penaltyHalfPassed ? "ct-text-faint" : "ct-status-warning",
              )}
            >
              {formatBps(earlyExitPenaltyBps)}{" "}
              <span className="ct-text-faint">(early exit)</span>
            </dd>
          </div>
        )}
      </dl>
    </article>
  );
}
