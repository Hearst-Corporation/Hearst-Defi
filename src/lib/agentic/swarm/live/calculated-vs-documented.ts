/**
 * calculated-vs-documented.ts — PROMPT 17 Phase A.
 *
 * The report must be HONEST about which parts of the product are actually
 * computed by the pipeline and which are only documented. This module is the
 * single source of that disclosure: a static, audited manifest the report renders
 * and the diagnostic asserts is present. After PROMPT 17 wired the funding /
 * exit-recovery / waterfalls / operator engines, those move from the "documented"
 * column into "calculated" (scenario-level), and the only remaining gap is
 * path-dependent Monte-Carlo rebalancing.
 *
 * Pure: a const + accessor only. No I/O.
 */

export interface CalculatedVsDocumented {
  /** Computed by the pipeline this run, from live data + the product engines. */
  readonly calculated: readonly string[];
  /**
   * Documented in the product but NOT computed here. After PROMPT 17 the only
   * item left is full path-dependent Monte-Carlo rebalancing (disclosed in §7).
   */
  readonly documentedOnly: readonly string[];
  /**
   * Items computed but only at the SCENARIO level (not path-by-path). Surfaced so
   * "calculated" never over-claims fidelity.
   */
  readonly scenarioLevelOnly: readonly string[];
}

/**
 * The manifest reflecting the post-PROMPT-17 pipeline. Keep this in lockstep with
 * what `buildProductEngineOutputs` actually produces — the diagnostic cross-checks
 * that the named outputs exist on the draft.
 */
export const CALCULATED_VS_DOCUMENTED: CalculatedVsDocumented = {
  calculated: [
    "Machine pricing (landed cost)",
    "BTC spot",
    "Hashprice",
    "USDC yield",
    "Mining yield net",
    "Canonical allocation",
    "Raw vs adjusted economics",
    "Monte-Carlo APY range (p5 / p50 / p95)",
    "Scenario cards",
    "Charts",
    "Write-up",
    "Stable Funding Engine decision",
    "Exit / Recovery state",
    "Waterfalls (normal / early / recovery)",
    "Operator economics (separate from client APY)",
  ],
  scenarioLevelOnly: [
    "Stable Funding Engine decision (scenario level, not path-by-path)",
    "Exit / Recovery state (construction-time triggers only)",
  ],
  documentedOnly: [
    "Dynamic funding/rebalancing inside Monte-Carlo (path-dependent)",
    "Live position-driven coverage, LTV, power-runway inputs",
  ],
} as const;

export function getCalculatedVsDocumented(): CalculatedVsDocumented {
  return CALCULATED_VS_DOCUMENTED;
}
