/**
 * Canonical monthly-return formula for the Hearst Yield Vault.
 *
 * SINGLE SOURCE OF TRUTH for the period return of an LP-facing vault series.
 *
 * Three modules previously coexisted with subtly different formulas
 * (cf. `docs/audit/coherence-2026-05-26/10-portfolio-lp-metrics.md` § P0-2):
 *   - `src/lib/data/advanced-metrics.ts`    → NAV + distribution add-back (correct)
 *   - `src/lib/engine/lp-pnl.ts`            → simple annualisation linéaire
 *
 * The financially correct formula for a period return on an investable fund
 * series is the "modified Dietz / NAV + distribution add-back" form:
 *
 *     r_t = (nav_t - nav_{t-1} + dist_t) / nav_{t-1}
 *
 * Distributions paid out during the period are added to the ending NAV so the
 * return reflects the realised yield the LP got as cash *plus* the mark-to-market
 * move of the residual NAV. Without this add-back, every month with a paid
 * distribution looks artificially worse than it actually was.
 *
 * Purity: this function has no I/O, no `Date.now()`, no `Math.random()`.
 * It is safe to import from any layer (engine, server data loaders, client
 * components if needed). All callers must pass in their own observations.
 */

export interface MonthlyReturnInputs {
  /** Beginning-of-period NAV (USDC). Must be > 0 for the return to be defined. */
  navStart: number;
  /** End-of-period NAV (USDC). */
  navEnd: number;
  /**
   * Distributions paid OUT of the vault during the period (USDC). Positive
   * value. Defaults to 0 when the upstream series does not carry distribution
   * data — in that mode the formula degrades to a pure NAV ratio (TWR-only).
   *
   * NOTE: defaulting to 0 is acceptable for callers that genuinely have no
   * distribution series (e.g. raw `VaultSnapshot` rows without monthly totals).
   */
  distribution?: number;
}

/**
 * Returns the period return as a decimal (e.g. 0.012 = 1.2%).
 *
 * Edge cases:
 *  - `navStart <= 0`         → return 0 (cannot compute a meaningful ratio).
 *  - `navStart`/`navEnd` NaN → return 0.
 *  - Negative distribution   → clamped to 0 (a distribution is, by definition,
 *                              a positive outflow; negative values are caller
 *                              errors and must not flip the sign).
 */
export function monthlyReturn(
  navStart: number,
  navEnd: number,
  distribution: number = 0,
): number {
  if (!Number.isFinite(navStart) || !Number.isFinite(navEnd)) return 0;
  if (navStart <= 0) return 0;
  const dist = Number.isFinite(distribution) && distribution > 0 ? distribution : 0;
  return (navEnd - navStart + dist) / navStart;
}

/**
 * Object-form alias for callers that prefer named inputs. Identical semantics.
 */
export function monthlyReturnFromInputs(inputs: MonthlyReturnInputs): number {
  return monthlyReturn(inputs.navStart, inputs.navEnd, inputs.distribution ?? 0);
}
