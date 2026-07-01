/**
 * Scenario runner types — a PURE, deterministic 24-month portfolio projection
 * for a BTC-collateralised, USDC-borrowing mining strategy. No I/O, no LLM, no
 * Math.random (a seeded PRNG is injected). Money in USDC, BTC in whole coins,
 * rates/ratios in BASIS POINTS (bps, 1% = 100).
 */

export type Scenario = "safe" | "balanced" | "opportunistic";

export type TriggerMetric =
  | "BTC_PRICE"
  | "LTV"
  | "LIQUIDATION_DISTANCE"
  | "PORTFOLIO_DRAWDOWN"
  | "TARGET_ENTRY_PRICE"
  | "MONTH";

export type Operator = "<=" | ">=" | "<" | ">" | "==";

export type ActionSide = "SELL_BTC" | "BUY_BTC" | "REPAY_DEBT" | "HOLD";

export type SizingMode =
  | "PERCENT_OF_BTC_COLLATERAL"
  | "PERCENT_OF_USDC_RESERVE"
  | "FIXED_BTC"
  | "FIXED_USDC";

export interface RebalancingAction {
  side: ActionSide;
  sizingMode: SizingMode;
  /** For PERCENT_* modes: bps (2500 = 25%). For FIXED_*: absolute BTC/USDC. */
  sizingValue: number;
  /** Fraction of freed USDC (bps) routed to debt repayment on a SELL. */
  repayDebtRatioBps?: number;
  /** For BUY: refuse the buy if the resulting LTV would exceed this (bps). */
  maxLtvAfterActionBps?: number;
}

export interface RebalancingRule {
  id: string;
  scenario: Scenario;
  type: "LIQUIDATE" | "REPURCHASE";
  /** Higher runs first within a month. */
  priority: number;
  triggerMetric: TriggerMetric;
  operator: Operator;
  value: number;
  action: RebalancingAction;
  cooldownMonths?: number;
  maxExecutions?: number;
  enabled: boolean;
}

export interface CollateralConfig {
  collateralAsset: "BTC";
  borrowAsset: "USDC";
  initialBtcCollateral: number;
  initialDebtUsdc: number;
  /** Starting USDC reserve (working capital). Defaults to minReserveUsdc when
   *  omitted, but a strategy that repurchases needs headroom above the floor. */
  initialReserveUsdc?: number;
  /** LTV at which the position is force-liquidated (bps). */
  liquidationLtvBps: number;
  targetSafetyBufferBps: number;
  targetRiskLtvBps: number;
  borrowAprBps: number;
  electricityMonthlyCostUsdc: number;
  minReserveUsdc: number;
  maxBtcExposureBps: number;
}

export interface ManualProjectionMarket {
  btcPriceStart: number;
  btcMonthlyDriftBps: number;
  btcMonthlyVolBps: number;
  stableYieldAprBps: number;
  overlayYieldAprBps: number;
  miningYieldAprBps: number;
  feeDragAprBps: number;
}

export interface ManualProjectionConfig extends ManualProjectionMarket {
  durationMonths: 24;
  interval: "MONTHLY";
}

/** The mutable portfolio state carried month to month. */
export interface PortfolioState {
  btcCollateral: number;
  debtUsdc: number;
  reserveUsdc: number;
  btcPrice: number;
}

export interface MonthlyEvent {
  ruleId: string;
  type: "LIQUIDATE" | "REPURCHASE";
  side: ActionSide;
  /** BTC moved (+bought / −sold). */
  btcDelta: number;
  /** USDC debt repaid this action. */
  debtRepaid: number;
  reason: string;
}

export interface MonthlySnapshot {
  month: number;
  btcPrice: number;
  btcCollateral: number;
  collateralValueUsdc: number;
  debtUsdc: number;
  reserveUsdc: number;
  /** debt / collateral value, bps. */
  ltvBps: number;
  /** how far (bps) LTV sits below the liquidation LTV — higher = safer. */
  liquidationDistanceBps: number;
  netEquityUsdc: number;
  events: MonthlyEvent[];
}

export interface ScenarioReport {
  scenario: Scenario;
  snapshots: MonthlySnapshot[];
  finalRoiBps: number;
  minLiquidationDistanceBps: number;
  totalBtcSold: number;
  totalBtcBought: number;
  totalDebtRepaidUsdc: number;
  liquidationCount: number;
  repurchaseCount: number;
  endedLiquidated: boolean;
}

/** A deterministic monthly BTC price series generator. */
export interface MarketModel {
  /** Return the BTC price at month `m` (m=0 is the start). Deterministic. */
  priceAt(month: number, prev: number): number;
}
