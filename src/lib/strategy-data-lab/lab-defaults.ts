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
 * Canonical rebalancing rule pair — the HOUSE collateral strategy (owner
 * decision, 2026-07-02): the vault posts (w)BTC — including mined BTC — as
 * collateral to borrow/mint stablecoin on lending protocols.
 *
 *  - DELEVER at LTV ≥ 45%: sell ~27% of the wBTC collateral and repay debt,
 *    winning back ~20 points of over-collateralisation (45% → ~25% LTV).
 *  - BUY BACK on recovery: when liquidation distance is comfortable again,
 *    redeploy 25% of the USDC reserve into wBTC — but NEVER above 55% LTV
 *    post-action (maxLtvAfterActionBps).
 *  - The protocol's hard liquidation stays at 80% LTV (collateral config).
 *
 * Scenario = "balanced" as default; callers that run other scenarios must
 * remap the `scenario` field accordingly (the forward runner already does
 * this via its rules.map override).
 */
export const LAB_BASE_RULES: RebalancingRule[] = [
  {
    id: "delever-ltv-45",
    scenario: "balanced",
    type: "LIQUIDATE",
    priority: 100,
    triggerMetric: "LTV",
    operator: ">=",
    value: 4500,
    action: {
      side: "SELL_BTC",
      // f = (0.45 − 0.25) / (1 − 0.25) ≈ 26.7% of collateral brings
      // LTV 45% → 25% when proceeds fully repay debt.
      sizingMode: "PERCENT_OF_BTC_COLLATERAL",
      sizingValue: 2700,
      repayDebtRatioBps: 10_000,
    },
    cooldownMonths: 1,
    enabled: true,
  },
  {
    id: "buyback-55cap",
    scenario: "balanced",
    type: "REPURCHASE",
    priority: 10,
    triggerMetric: "LIQUIDATION_DISTANCE",
    operator: ">=",
    value: 4500,
    action: {
      side: "BUY_BTC",
      sizingMode: "PERCENT_OF_USDC_RESERVE",
      sizingValue: 2500,
      maxLtvAfterActionBps: 5500,
    },
    cooldownMonths: 2,
    enabled: true,
  },
  {
    // REVERSE DCA (owner, 2026-07-02): when BTC performs, secure the position
    // in stages — sell 10% of the (w)BTC per +25% price step and park the
    // proceeds in the USDC reserve (repayDebtRatioBps 0 → nothing goes to
    // debt, everything de-risks into stable). Max 4 steps, 2-month spacing.
    // Modelling note: expressed as type LIQUIDATE (the engine's only SELL
    // type) — it is a take-profit, not a distress sale.
    id: "reverse-dca-secure",
    scenario: "balanced",
    type: "LIQUIDATE",
    priority: 50,
    triggerMetric: "BTC_PRICE",
    operator: ">=",
    value: 75_000,
    action: {
      side: "SELL_BTC",
      sizingMode: "PERCENT_OF_BTC_COLLATERAL",
      sizingValue: 1000,
      repayDebtRatioBps: 0,
    },
    cooldownMonths: 2,
    maxExecutions: 4,
    enabled: true,
  },
];
