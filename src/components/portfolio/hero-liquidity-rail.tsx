import {
  computeLockMeter,
  formatBps,
  type LockMeterProps,
} from "@/components/portfolio/lock-meter";
import { resolveLockMeterShell } from "@/lib/portfolio/hero-rail-state";
import { HeroRailGroup } from "@/components/portfolio/hero-rail-shell";
import { cn } from "@/lib/cn";

const unlockDateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export type HeroLiquidityRailProps = LockMeterProps & {
  previewZeros?: boolean;
};

/** Hero-rail slice for lock / liquidity — same inputs as LockMeter. */
export function HeroLiquidityRail({
  lockStart,
  softLockupDays,
  earlyExitPenaltyBps,
  asOf,
  source = "live",
  previewZeros = false,
}: HeroLiquidityRailProps) {
  const effectiveAsOf = asOf ?? new Date();
  const { showZeroShell, widgetProvenance, termsUnknown } = resolveLockMeterShell({
    previewZeros,
    source,
    softLockupDays,
  });

  const { progressPct, unlockDate, daysRemaining, isUnlocked } =
    computeLockMeter(lockStart, softLockupDays, effectiveAsOf);

  const progressRounded = showZeroShell ? 0 : Math.round(progressPct);
  const fillPct = showZeroShell ? 0 : progressPct;

  const progressLabel = showZeroShell
    ? termsUnknown
      ? "Lock terms unavailable until share-class data is wired."
      : "Liquidity terms pending until an active position is available."
    : termsUnknown
      ? "Lock terms unavailable until share-class data is wired."
      : `Lockup progress: ${progressRounded}% — ${
          isUnlocked
            ? "fully unlocked"
            : `${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining of ${softLockupDays}`
        }`;

  const metaText = showZeroShell
    ? termsUnknown
      ? "Terms pending"
      : `${softLockupDays}-day soft lock shown after deposit`
    : termsUnknown
      ? "Terms pending"
      : isUnlocked
        ? "Unlocked · Now"
        : `${daysRemaining}d left · Unlock ${unlockDateFmt.format(unlockDate)}`;

  return (
    <HeroRailGroup
      title="Liquidity"
      aria-label="Liquidity status"
      provenance={widgetProvenance}
    >
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
            !showZeroShell && isUnlocked
              ? "pf-progress-fill--success"
              : "pf-progress-fill--accent",
          )}
          style={{ width: `${fillPct}%` }}
        />
      </div>

      <p className="pf-hero-rail-meta tabular m-0">{metaText}</p>

      {!isUnlocked &&
      earlyExitPenaltyBps !== undefined &&
      !termsUnknown &&
      !showZeroShell ? (
        <p className="pf-hero-rail-note m-0">
          Early exit penalty {formatBps(earlyExitPenaltyBps)}
        </p>
      ) : null}
    </HeroRailGroup>
  );
}
