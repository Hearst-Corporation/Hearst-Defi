// Lock meter — pure helpers + props for HeroLiquidityRail.
// Server-safe: no I/O, no side effects.

/** Clamp a value between min and max (inclusive). */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Format basis-points as a locale percentage string, e.g. 150 → "1.5%". */
export function formatBps(bps: number): string {
  const pct = bps / 100;
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
