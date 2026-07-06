/**
 * value-projection — deterministic value-trajectory projection for a single LP
 * position. PURE: no I/O, no PRNG, no `Date.now()`. The clock is INJECTED via
 * `nowMs` so the same inputs always yield the same trajectory (engine purity
 * #6/#7). Powers the Position Overview "Value Trajectory" hero.
 *
 * Honesty model:
 * - The REALIZED segment (subscription → now) is real: cumulative economic value
 *   the position has actually reached. Callers pass anchors; the default is the
 *   two honest endpoints (principal at subscription → current value now).
 * - The FORWARD segment (now → horizon) is a PROJECTION bounded by the vault's
 *   own realized APY RANGE — a low path and a high path, with a muted midline.
 *   It is NEVER a promise: simple (non-compounded) annualisation, distributions
 *   not reinvested, edges are the real APY range (not fabricated percentiles).
 */

const DAY_MS = 86_400_000;
const YEAR_DAYS = 365;

export interface ValueProjectionInputs {
  /** Net principal contributed, USDC. */
  principalUsdc: number;
  /** Current economic value = principal + accrued, USDC. */
  currentValueUsdc: number;
  /** Low edge of the vault's realized APY range, percent (e.g. 8). */
  realizedApyLowPct: number;
  /** High edge of the vault's realized APY range, percent (e.g. 15). */
  realizedApyHighPct: number;
  subscribedAt: Date;
  /** Injected clock — the "today" divider. */
  now: Date;
  /** Maturity date if known; else derived from soft lock-up. */
  maturityAt: Date | null;
  /** Soft lock-up length, days (0 when none). */
  softLockupDays: number;
  /**
   * Optional finer realized path (e.g. from real deposit/distribution anchors).
   * Defaults to [{subscribed → principal}, {now → currentValue}].
   */
  realizedAnchors?: readonly { at: Date; value: number }[];
  /** Forward resolution (number of projected points). Default 12. */
  steps?: number;
}

export interface ValueRealizedPoint {
  /** Epoch ms. */
  at: number;
  value: number;
}

export interface ValueForwardPoint {
  /** Epoch ms. */
  at: number;
  lo: number;
  mid: number;
  hi: number;
}

export interface ValueProjection {
  realized: ValueRealizedPoint[];
  forward: ValueForwardPoint[];
  nowMs: number;
  nowValue: number;
  horizonMs: number;
  /** Projected value at horizon, low APY edge. */
  maturityLo: number;
  /** Projected value at horizon, high APY edge. */
  maturityHi: number;
  /** True when the position is past horizon (matured) → no forward cone. */
  matured: boolean;
}

function clampFinite(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

/**
 * Build a realized + forward value trajectory. Deterministic in `now`.
 */
export function projectValueTrajectory(
  inputs: ValueProjectionInputs,
): ValueProjection {
  const principal = Math.max(0, clampFinite(inputs.principalUsdc));
  const currentValue = Math.max(0, clampFinite(inputs.currentValueUsdc));
  const apyLow = clampFinite(inputs.realizedApyLowPct);
  const apyHigh = clampFinite(inputs.realizedApyHighPct);
  const steps = Math.max(2, Math.floor(inputs.steps ?? 12));

  const subscribedMs = inputs.subscribedAt.getTime();
  const nowMs = inputs.now.getTime();
  const maturityMs = inputs.maturityAt ? inputs.maturityAt.getTime() : null;

  const horizonMs =
    maturityMs ??
    (inputs.softLockupDays > 0
      ? subscribedMs + inputs.softLockupDays * DAY_MS
      : nowMs + YEAR_DAYS * DAY_MS);

  // Realized path (default: two honest endpoints).
  const realized: ValueRealizedPoint[] = (
    inputs.realizedAnchors && inputs.realizedAnchors.length >= 1
      ? inputs.realizedAnchors.map((a) => ({
          at: a.at.getTime(),
          value: Math.max(0, clampFinite(a.value)),
        }))
      : [
          { at: subscribedMs, value: principal },
          { at: nowMs, value: currentValue },
        ]
  )
    .filter((p) => p.at <= nowMs + DAY_MS)
    .sort((a, b) => a.at - b.at);

  // Ensure the realized path always ends at "now / currentValue".
  const lastRealized = realized[realized.length - 1];
  if (!lastRealized || lastRealized.at < nowMs) {
    realized.push({ at: nowMs, value: currentValue });
  }

  const matured = horizonMs <= nowMs;

  const forward: ValueForwardPoint[] = [];
  if (!matured) {
    const span = horizonMs - nowMs;
    for (let i = 0; i <= steps; i++) {
      const at = nowMs + (span * i) / steps;
      const years = (at - nowMs) / (YEAR_DAYS * DAY_MS);
      const lo = currentValue + (principal * apyLow * years) / 100;
      const hi = currentValue + (principal * apyHigh * years) / 100;
      forward.push({ at, lo, mid: (lo + hi) / 2, hi });
    }
  }

  const last = forward[forward.length - 1];
  return {
    realized,
    forward,
    nowMs,
    nowValue: currentValue,
    horizonMs,
    maturityLo: last ? last.lo : currentValue,
    maturityHi: last ? last.hi : currentValue,
    matured,
  };
}
