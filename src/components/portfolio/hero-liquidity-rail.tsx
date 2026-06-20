import {
  computeLockMeter,
  formatBps,
  type LockMeterProps,
} from "@/components/portfolio/lock-meter";
import { HeroRailGroup } from "@/components/portfolio/hero-rail-shell";

const unlockDateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export type HeroLiquidityRailProps = LockMeterProps;

/**
 * Hero rail — liquidity / soft-lock. A thin progress meter (lock elapsed)
 * over a compact meta line, with an optional early-exit penalty note.
 * When terms are unknown/stale: shows "Terms pending" (honest placeholder).
 */
export function HeroLiquidityRail({
  lockStart,
  softLockupDays,
  earlyExitPenaltyBps,
  asOf,
  source = "live",
}: HeroLiquidityRailProps) {
  const effectiveAsOf = asOf ?? new Date();

  const termsUnknown = softLockupDays <= 0;
  const isStale = termsUnknown || source === "stale";
  const widgetProvenance = isStale ? undefined : ("live" as const);

  const { progressPct, unlockDate, daysRemaining, isUnlocked } = computeLockMeter(
    lockStart,
    softLockupDays,
    effectiveAsOf,
  );

  const progressRounded = isStale ? 0 : Math.round(progressPct);
  const fillPct = isStale ? 0 : progressPct;

  const meta = isStale
    ? termsUnknown
      ? "Terms pending"
      : `${softLockupDays}-day soft lock shown after deposit`
    : isUnlocked
      ? "Unlocked · now"
      : `${daysRemaining}d left · unlock ${unlockDateFmt.format(unlockDate)}`;

  const showPenalty =
    !isStale &&
    !termsUnknown &&
    !isUnlocked &&
    earlyExitPenaltyBps !== undefined;

  return (
    <HeroRailGroup
      title="Liquidity"
      aria-label="Liquidity status"
      provenance={widgetProvenance}
    >
      {/* When stale: a 0% bar is noise — show only the terms meta line. */}
      {isStale ? null : (
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
