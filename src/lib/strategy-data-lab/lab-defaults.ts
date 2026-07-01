/**
 * Lab defaults — canonical base constants for the Strategy Data Lab (TD.1 fix).
 * Single source of truth: replaces the divergent inline constants that existed
 * independently in strategy-data-lab.tsx (drift 100 / vol 800) and
 * manual-projection-panel.tsx (drift 150 / vol 900).
 *
 * The data-lab values are chosen as canonical per the spec. Pure consts — no I/O.
 */

import type {
  CollateralConfig,
  ManualProjectionConfig,
  RebalancingRule,
} from "@/lib/scenario-runner";

export const LAB_BASE_COLLATERAL: CollateralConfig = {
  collateralAsset: "BTC",
  borrowAsset: "USDC",
  initialBtcCollateral: 10,
  initialDebtUsdc: 200_000,
  initialReserveUsdc: 120_000,
  liquidationLtvBps: 8000,
  targetSafetyBufferBps: 2000,
  targetRiskLtvBps: 6000,
  borrowAprBps: 600,
  electricityMonthlyCostUsdc: 3000,
  minReserveUsdc: 40_000,
  maxBtcExposureBps: 9000,
};

export const LAB_BASE_PROJECTION: ManualProjectionConfig = {
  durationMonths: 24,
  interval: "MONTHLY",
  btcPriceStart: 60_000,
  btcMonthlyDriftBps: 100,
  btcMonthlyVolBps: 800,
  stableYieldAprBps: 500,
  overlayYieldAprBps: 900,
  miningYieldAprBps: 400,
  feeDragAprBps: 200,
};

/**
 * Canonical rebalancing rule pair: LTV-triggered liquidation (liq-ltv) +
 * distance-triggered repurchase (rep-dist). Scenario = "balanced" as default;
 * callers that run other scenarios must remap the `scenario` field accordingly
 * (the forward runner already does this via its rules.map override).
 */
export const LAB_BASE_RULES: RebalancingRule[] = [
  {
    id: "liq-ltv",
    scenario: "balanced",
    type: "LIQUIDATE",
    priority: 100,
    triggerMetric: "LTV",
    operator: ">=",
    value: 6500,
    action: {
      side: "SELL_BTC",
      sizingMode: "PERCENT_OF_BTC_COLLATERAL",
      sizingValue: 3000,
      repayDebtRatioBps: 10_000,
    },
    cooldownMonths: 1,
    enabled: true,
  },
  {
    id: "rep-dist",
    scenario: "balanced",
    type: "REPURCHASE",
    priority: 10,
    triggerMetric: "LIQUIDATION_DISTANCE",
    operator: ">=",
    value: 4000,
    action: {
      side: "BUY_BTC",
      sizingMode: "PERCENT_OF_USDC_RESERVE",
      sizingValue: 2500,
      maxLtvAfterActionBps: 5500,
    },
    cooldownMonths: 2,
    enabled: true,
  },
];
