import {
  computeLockMeter,
  formatBps,
  type LockMeterProps,
} from "@/components/portfolio/lock-meter";
import { cn } from "@/lib/cn";

const unlockDateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export type HeroLiquidityRailProps = LockMeterProps & {
  previewZeros?: boolean;
};

/**
 * Compact hero-rail slice for lock / liquidity — same inputs as LockMeter,
 * native rail DOM (no ModuleChrome / dashboard widget shell).
 */
export function HeroLiquidityRail({
  lockStart,
  softLockupDays,
  earlyExitPenaltyBps,
  asOf,
  source = "live",
  previewZeros = false,
}: HeroLiquidityRailProps) {
  const effectiveAsOf = asOf ?? new Date();
  const termsUnknown = softLockupDays <= 0;
  const showZeroShell = previewZeros || termsUnknown || source === "stale";

  const { progressPct, unlockDate, daysRemaining, isUnlocked } =
    computeLockMeter(lockStart, softLockupDays, effectiveAsOf);

  const progressRounded = Math.round(progressPct);
  const progressLabel = termsUnknown
    ? "Lock terms unavailable until share-class data is wired."
    : `Lockup progress: ${progressRounded}% — ${
        isUnlocked
          ? "fully unlocked"
          : `${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining of ${softLockupDays}`
      }`;

  const metaText = termsUnknown
    ? "Terms pending"
    : isUnlocked
      ? "Unlocked · Now"
      : `${daysRemaining}d left · Unlock ${unlockDateFmt.format(unlockDate)}`;

  return (
    <section
      className="pf-hero-rail-group pf-hero-rail-group--liquidity"
      aria-label="Liquidity status"
    >
      <h3 className="pf-hero-rail-title">Liquidity</h3>

      <div
        role="progressbar"
        aria-valuenow={progressRounded}
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

      <p className="pf-hero-rail-meta m-0">{metaText}</p>

      {!isUnlocked && earlyExitPenaltyBps !== undefined && !termsUnknown ? (
        <p className="pf-hero-rail-note m-0">
          Early exit penalty {formatBps(earlyExitPenaltyBps)}
        </p>
      ) : null}

      {showZeroShell && termsUnknown ? (
        <p className="pf-hero-rail-note m-0">After first active position.</p>
      ) : null}
    </section>
  );
}
