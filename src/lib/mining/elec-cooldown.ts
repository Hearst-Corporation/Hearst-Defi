/**
 * Electricity payment cooldown — PURE derivation, no I/O, no clock of its own.
 *
 * `elecStatus()` gives the LAST payment timestamp; the product wants the
 * REMAINING cooldown. That subtraction is done here, server-side, and it is
 * explicitly **derived** — the route wraps it in a `status: "derived"` envelope
 * so it can never be mistaken for something the chain said. The chain said
 * `lastElecPaymentTime`. Everything below is arithmetic on top of it.
 *
 * `now` is injected rather than read from `Date.now()` so this stays pure and
 * unit-testable (same rule the engine lives under: no ungoverned clock).
 */

/** The contract's electricity cadence: one payment per 30-day window. */
export const ELEC_COOLDOWN_DAYS = 30;

/** The same window, in seconds — chain timestamps are unix seconds. */
export const ELEC_COOLDOWN_SECONDS = ELEC_COOLDOWN_DAYS * 24 * 60 * 60;

export interface ElecCooldown {
  /** Window length used for this derivation, so a caller never has to guess it. */
  cooldownDays: number;
  /** Unix seconds as a decimal string. `null` when never paid — NOT `"0"`. */
  lastPaymentTime: string | null;
  /** Unix seconds as a decimal string. `null` when never paid. */
  cooldownEndsAt: string | null;
  /** Seconds left in the window. `0` means the window is open. */
  remainingSeconds: number;
  /**
   * Derived HINT, not an authorization: it says the 30-day window has elapsed,
   * nothing more. The contract remains the only authority on whether
   * `payElectricity()` would actually succeed (it has its own guards — see
   * `isPaidThisMonth`, keeper role, pause state). Never gate a write on this.
   */
  canPay: boolean;
  /** No payment has ever been recorded (`lastElecPaymentTime == 0`). */
  neverPaid: boolean;
  /**
   * The last payment is stamped in the FUTURE relative to `now`. Surfaced
   * instead of being silently clamped away: it means the chain clock, the
   * server clock, or the decode disagree, and a caller deserves to know rather
   * than read a confident countdown built on a contradiction.
   */
  clockAnomaly: boolean;
}

/**
 * @param lastPaymentTimeSec `elecStatus().lastElecPaymentTime`, unix seconds.
 * @param nowSec             Current time, unix seconds (injected — see above).
 */
export function deriveElecCooldown(
  lastPaymentTimeSec: bigint,
  nowSec: bigint,
): ElecCooldown {
  // `0` is the contract's "never paid" sentinel. Rendering it as a 1970 date
  // with an elapsed cooldown would be a fabricated fact, so it gets its own
  // flag and null dates.
  if (lastPaymentTimeSec <= 0n) {
    return {
      cooldownDays: ELEC_COOLDOWN_DAYS,
      lastPaymentTime: null,
      cooldownEndsAt: null,
      remainingSeconds: 0,
      canPay: true,
      neverPaid: true,
      clockAnomaly: false,
    };
  }

  const windowSec = BigInt(ELEC_COOLDOWN_SECONDS);
  const endsAt = lastPaymentTimeSec + windowSec;
  const rawRemaining = endsAt > nowSec ? endsAt - nowSec : 0n;

  // A future timestamp yields a remainder larger than the window itself. Cap it
  // so `remainingSeconds` stays a sane `number` (an uncapped uint256 would lose
  // precision through `Number()`), and flag the contradiction rather than hide it.
  const clockAnomaly = lastPaymentTimeSec > nowSec;
  const remaining = rawRemaining > windowSec ? windowSec : rawRemaining;

  return {
    cooldownDays: ELEC_COOLDOWN_DAYS,
    lastPaymentTime: lastPaymentTimeSec.toString(),
    cooldownEndsAt: endsAt.toString(),
    remainingSeconds: Number(remaining),
    canPay: remaining === 0n,
    neverPaid: false,
    clockAnomaly,
  };
}
