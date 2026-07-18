// time-to-cash.ts — Pure computation helper for the Time-to-Cash widget.
// Non-negotiable #6: no DB, no fetch, no I/O, no Date.now() — asOf injected.

/** All derived values from the time-to-cash calculation. */
export interface TimeToCashCalc {
  daysElapsed: number;
  daysRemaining: number;
  hoursRemaining: number;
  progressPct: number;
  nextDistributionAt: Date;
}

/** Clamp a value between min and max (inclusive). */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Pure computation — no side effects, no I/O.
 *
 * @param cycleStart  When the current monthly cycle started.
 * @param cycleDays   Cycle length in days (typically 30).
 * @param asOf        Reference timestamp (injected — never Date.now()).
 */
export function computeTimeToCash({
  cycleStart,
  cycleDays,
  asOf,
}: {
  cycleStart: Date;
  cycleDays: number;
  asOf: Date;
}): TimeToCashCalc {
  const MS_PER_DAY = 86_400_000;
  const MS_PER_HOUR = 3_600_000;

  const elapsedMs = asOf.getTime() - cycleStart.getTime();
  const daysElapsed = Math.floor(elapsedMs / MS_PER_DAY);

  const nextDistributionAt = new Date(
    cycleStart.getTime() + cycleDays * MS_PER_DAY,
  );

  const remainingMs = nextDistributionAt.getTime() - asOf.getTime();
  // Clamp to 0 so that an expired cycle reads 0d 0h remaining (non-negotiable #3 equivalent).
  const clampedRemainingMs = Math.max(0, remainingMs);

  const daysRemaining = Math.floor(clampedRemainingMs / MS_PER_DAY);
  const hoursRemaining = Math.floor(
    (clampedRemainingMs % MS_PER_DAY) / MS_PER_HOUR,
  );

  const rawProgress = cycleDays > 0 ? (daysElapsed / cycleDays) * 100 : 0;
  const progressPct = clamp(rawProgress, 0, 100);

  return {
    daysElapsed,
    daysRemaining,
    hoursRemaining,
    progressPct,
    nextDistributionAt,
  };
}
