// Pure arithmetic helpers for the deposit wizard's TimeToTarget chart.
// Used by Client Components, so this module must NOT import "server-only"
// modules (incl. src/lib/engine/*). Replicates only the arithmetic needed
// for the area chart; the engine remains the single source of truth for
// full scenarios.
//
// Rule: no I/O, no env reads, no Date.now() here. Inputs are all numeric.

export interface ProjectionPoint {
  month: number;
  nav: number; // e.g. 100 = principal, 112.8 = +12.8%
}

/**
 * Build a simple monthly NAV series for the TimeToTargetChart.
 * Uses a blended monthly return derived from the vault APY midpoint.
 *
 * @param principal   - initial deposit in USDC
 * @param apyLow      - low bound APY (e.g. 9.4)
 * @param apyHigh     - high bound APY (e.g. 12.8)
 * @param months      - projection horizon
 */
export function buildProjectionSeries(
  principal: number,
  apyLow: number,
  apyHigh: number,
  months: number,
): { low: ProjectionPoint[]; mid: ProjectionPoint[]; high: ProjectionPoint[] } {
  const toMonthly = (apy: number) => apy / 100 / 12;
  const midApy = (apyLow + apyHigh) / 2;

  const rates = { low: toMonthly(apyLow), mid: toMonthly(midApy), high: toMonthly(apyHigh) };

  function buildLine(monthlyRate: number): ProjectionPoint[] {
    const pts: ProjectionPoint[] = [{ month: 0, nav: principal }];
    let nav = principal;
    for (let m = 1; m <= months; m++) {
      nav = nav * (1 + monthlyRate);
      pts.push({ month: m, nav: Math.round(nav) });
    }
    return pts;
  }

  return {
    low: buildLine(rates.low),
    mid: buildLine(rates.mid),
    high: buildLine(rates.high),
  };
}

/**
 * Estimate how many months a single compounding rate takes to reach a target
 * cumulative yield %. Returns null if never reached within the horizon.
 *
 * INTERNAL ONLY — not exported. A single rate produces a single milestone
 * month, which would publish a point estimate to the investor (non-negotiable
 * #1: figures are always a range). Callers must use `monthsToTargetRange`, which
 * derives the fast/slow bounds from the APY band and never leaks the midpoint.
 */
function monthsToTargetForRate(
  apy: number,
  targetCumulativePct: number,
  maxMonths: number,
): number | null {
  const monthlyRate = apy / 100 / 12;
  let nav = 1;
  for (let m = 1; m <= maxMonths; m++) {
    nav *= 1 + monthlyRate;
    if ((nav - 1) * 100 >= targetCumulativePct) return m;
  }
  return null;
}

/**
 * Number of months to reach a target cumulative yield %, expressed as a
 * FOURCHETTE (range), never a single point — non-negotiable #1.
 *
 * The high APY reaches the target sooner (`fast`); the low APY reaches it later
 * (`slow`). Either bound is null when that rate never reaches the target inside
 * `maxMonths`. Consumers render this as e.g. "6–9 months"; they must never
 * average the two into a single milestone month.
 *
 * @param apyLow   - low bound APY (e.g. 9.4)  → the SLOW milestone
 * @param apyHigh  - high bound APY (e.g. 12.8) → the FAST milestone
 * @param targetCumulativePct - cumulative yield % to reach (e.g. 10)
 * @param maxMonths - projection horizon
 */
export function monthsToTargetRange(
  apyLow: number,
  apyHigh: number,
  targetCumulativePct: number,
  maxMonths = 24,
): { fast: number | null; slow: number | null } {
  return {
    fast: monthsToTargetForRate(apyHigh, targetCumulativePct, maxMonths),
    slow: monthsToTargetForRate(apyLow, targetCumulativePct, maxMonths),
  };
}

/**
 * @deprecated Single-milestone-month helper — kept ONLY as a build-compat shim
 * for `time-to-target-chart.tsx`, which positions a marker/label from a single
 * rate. It publishes a point milestone (`+X% at M{n}`) that violates
 * non-negotiable #1 and is flagged for the same range treatment as invest-form.
 * NEW callers MUST use `monthsToTargetRange` and render a fourchette. Do not add
 * consumers of this export.
 */
export function monthsToTarget(
  apy: number,
  targetCumulativePct: number,
  maxMonths = 24,
): number | null {
  return monthsToTargetForRate(apy, targetCumulativePct, maxMonths);
}
