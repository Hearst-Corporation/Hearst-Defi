export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function formatBps(bps: number): string {
  const pct = bps / 100;
  const formatted = pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1);
  return `${formatted}%`;
}

export interface LockMeterCalc {
  daysElapsed: number;
  progressPct: number;
  unlockDate: Date;
  daysRemaining: number;
  isUnlocked: boolean;
}

export interface LockMeterProps {
  lockStart: Date;
  softLockupDays: number;
  earlyExitPenaltyBps?: number;
  asOf?: Date;
  source?: "live" | "stale";
  updatedAt?: Date;
}

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
