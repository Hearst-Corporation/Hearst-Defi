/**
 * operator-economics.ts — the SEPARATE operator economic model (doc §16).
 *
 * The product delivers a defined performance BAND to the client; the operator is
 * remunerated on the EXCESS and on operational efficiency. **Operator spread is
 * kept strictly separate from the client distribution and never increases the
 * displayed client distribution** (doc §16). This module models the operator side
 * as its own structure — it is impossible to read these as part of the client
 * number, and it is impossible to read them as validated.
 *
 * STRICT pure-function contract (non-negotiable #6): no I/O, no process.env, no
 * Date.now(), no Math.random(), no module-level side effects, no argument mutation.
 *
 * Honesty: every operator value carries status 'CONFIGURED_NOT_VALIDATED'
 * AND `validated: false`. They are CONFIGURED modeling assumptions (doc §22),
 * subject to the same conditions as client returns — never investor-facing as fact.
 */

import type {
  BtcMiningPerformanceVault,
  ProductValueStatus,
} from "./btc-mining-performance-vault";

// ---------------------------------------------------------------------------
// Status — a dedicated literal so an operator value can NEVER read as validated.
// ---------------------------------------------------------------------------

/**
 * Operator values are configured but explicitly NOT validated. We use a distinct
 * status literal AND a `validated: false` flag — double-locked so no consumer can
 * mistake an operator modeling figure for a validated/contractual one.
 */
export type OperatorValueStatus = "CONFIGURED_NOT_VALIDATED";

export interface OperatorStatusedValue<T> {
  readonly value: T;
  readonly status: OperatorValueStatus;
  /** Always false — operator economics are modeled, never validated here. */
  readonly validated: false;
}

function operatorValue<T>(value: T): OperatorStatusedValue<T> {
  return { value, status: "CONFIGURED_NOT_VALIDATED", validated: false };
}

// ---------------------------------------------------------------------------
// Operator model (doc §16) — a SEPARATE structure from the client distribution.
// ---------------------------------------------------------------------------

export interface OperatorEconomics {
  /**
   * Performance spread the operator earns ABOVE the client target band. The
   * client's target band is the operator's hurdle, not the ceiling (doc §16).
   * Expressed as a fraction of return captured above the client total target.
   */
  readonly performanceSpreadAboveClientTarget: OperatorStatusedValue<number>;
  /** Management fee (fraction/yr) — Class A 100 bps default. */
  readonly managementFee: OperatorStatusedValue<number>;
  /** Performance fee (fraction) — Class A 1000 bps default, in ADDITION to spread. */
  readonly performanceFee: OperatorStatusedValue<number>;
  /** 15% machine markup on cost price. */
  readonly machineMarkup: OperatorStatusedValue<number>;
  /** 20% revenue-share on net mining income (client keeps 80%). */
  readonly revenueShare: OperatorStatusedValue<number>;
  /** Machine resale residual value (fraction of cost) — placeholder CONFIGURED. */
  readonly machineResaleValue: OperatorStatusedValue<number>;
  /** Machine redeploy residual value (fraction of cost) — placeholder CONFIGURED. */
  readonly machineRedeployValue: OperatorStatusedValue<number>;
  /** Residual mining production after client exit (fraction of a cycle's output). */
  readonly residualMiningProduction: OperatorStatusedValue<number>;
  /** Financing spread between the 6% borrow and the deployed use (fraction). */
  readonly financingSpread: OperatorStatusedValue<number>;
}

// ---------------------------------------------------------------------------
// Builder — derives the operator model from the product constant. Pure.
// ---------------------------------------------------------------------------

/**
 * Builds the operator economics from the product constant. The operator structure
 * is DERIVED from the same levers the client model uses (markup, revenue-share,
 * borrow APR) but is returned as its OWN object — it is never merged into, added
 * to, or able to change the client distribution number.
 *
 * Pure: same product → same operator economics; no I/O.
 */
export function buildOperatorEconomics(
  product: BtcMiningPerformanceVault,
): OperatorEconomics {
  const markup = product.levers.markupPct.value;
  const revShare = product.levers.revenueSharePct.value;
  const borrowApr = product.levers.borrowAprPct.value;

  return {
    // Spread above the client TOTAL target band's upper bound — the operator only
    // earns by BEATING the client band. Modeled as captured upside above 24%.
    performanceSpreadAboveClientTarget: operatorValue(
      Math.max(0, 1 - product.totalPerformanceTarget.max),
    ),
    // Class A defaults (doc §5, §16): 100 bps mgmt, 1000 bps perf.
    managementFee: operatorValue(0.01),
    performanceFee: operatorValue(0.1),
    machineMarkup: operatorValue(markup),
    revenueShare: operatorValue(revShare),
    // Residual-value placeholders (doc §15, §23 open question #9 — no model yet).
    machineResaleValue: operatorValue(0.2),
    machineRedeployValue: operatorValue(0.25),
    residualMiningProduction: operatorValue(0.3),
    // Financing spread = the deployed-use opportunity minus the borrow cost.
    // Modeled conservatively as the borrow APR itself (a CONFIGURED placeholder).
    financingSpread: operatorValue(borrowApr),
  };
}

// ---------------------------------------------------------------------------
// Helpers — make the separation explicit and testable.
// ---------------------------------------------------------------------------

/**
 * Returns the client distribution band UNCHANGED — proof that reading the operator
 * model does not (and cannot) alter the client number. The operator spread lives
 * in a separate object; the client band is read straight off the product.
 */
export function clientDistributionBand(product: BtcMiningPerformanceVault): {
  readonly min: number;
  readonly max: number;
  readonly status: ProductValueStatus;
} {
  const d = product.monthlyDistributionTargetAnnualized;
  return { min: d.min, max: d.max, status: d.status };
}
