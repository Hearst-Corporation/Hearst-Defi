import {
  computeLockMeter,
  formatBps,
  type LockMeterProps,
} from "@/components/portfolio/lock-meter";
import { resolveLockMeterShell } from "@/lib/portfolio/hero-rail-state";
import { HeroRailGroup } from "@/components/portfolio/hero-rail-shell";

const unlockDateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export type HeroLiquidityRailProps = LockMeterProps & {
  previewZeros?: boolean;
};

/**
 * Hero rail — liquidity / soft-lock. Recoded from scratch: a thin progress
 * meter (lock elapsed) over a compact meta line, with an optional early-exit
 * penalty note. Honest zero-state. Same inputs as LockMeter.
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
  const { showZeroShell, widgetProvenance, termsUnknown } = resolveLockMeterShell({
    previewZeros,
    source,
    softLockupDays,
  });

  const { progressPct, unlockDate, daysRemaining, isUnlocked } = computeLockMeter(
    lockStart,
    softLockupDays,
    effectiveAsOf,
  );

  const progressRounded = showZeroShell ? 0 : Math.round(progressPct);
  const fillPct = showZeroShell ? 0 : progressPct;

  const meta = showZeroShell
    ? termsUnknown
      ? "Terms pending"
      : `${softLockupDays}-day soft lock shown after deposit`
    : termsUnknown
      ? "Terms pending"
      : isUnlocked
        ? "Unlocked · now"
        : `${daysRemaining}d left · unlock ${unlockDateFmt.format(unlockDate)}`;

  const showPenalty =
    !showZeroShell &&
    !termsUnknown &&
    !isUnlocked &&
    earlyExitPenaltyBps !== undefined;

  return (
    <HeroRailGroup
      title="Liquidity"
      aria-label="Liquidity status"
      provenance={widgetProvenance}
    >
      {/* Zero-state: a 0% bar is noise — show only the terms meta line. */}
      {showZeroShell ? null : (
        <div
          role="progressbar"
          aria-valuenow={progressRounded}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Lockup progress: ${progressRounded}% — ${
            isUnlocked
              ? "fully unlocked"
              : `${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining of ${softLockupDays}`
          }`}
          className="pf-meter"
        >
          <div
            className="pf-meter__fill"
            data-state={isUnlocked ? "done" : "active"}
            style={{ width: `${fillPct}%` }}
          />
        </div>
      )}

      <p className="pf-hero-rail-meta tabular m-0">{meta}</p>

      {showPenalty ? (
        <p className="pf-hero-rail-note m-0">
          Early exit penalty {formatBps(earlyExitPenaltyBps)}
        </p>
      ) : null}
    </HeroRailGroup>
  );
}
