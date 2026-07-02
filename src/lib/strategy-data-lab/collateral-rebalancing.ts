/**
 * Collateral rebalancing is a 3-bucket USDC-funded model.
 * Do not reuse the legacy 4-sleeve overlay allocation field here.
 *
 * The model is intentionally self-contained:
 * - pure
 * - deterministic
 * - no React
 * - no I/O
 * - no global mutation
 */

const EPSILON = 1e-9;
const MINING_FLOOR_PCT = 0.3;
const DEFAULT_LADDER_MAX_STEPS = 12;
const RESERVE_COVERAGE_MONTHS = 6;

export const COLLATERAL_BUCKETS = ["MINING", "BTC_WBTC_RC20", "USDC"] as const;

export type CollateralBucket = (typeof COLLATERAL_BUCKETS)[number];

export type CollateralRebalancingInput = {
  investmentUsdc: number;

  miningAllocationPct: number;
  btcAllocationPct: number;
  usdcAllocationPct: number;

  btcSpotPriceUsd: number;
  openingLtvPct: number;

  liquidationLtvPct: number;
  deRiskTriggerLtvPct: number;
  postSellTargetLtvPct: number;
  reRiskTriggerDistancePct: number;
  maxLtvAfterBuyPct: number;

  repayRatioPct: number;
  sellStepPctOfCollateral?: number;
  sellMode: "AUTO_TO_TARGET" | "FIXED_STEP";

  buyStepPctOfReserve: number;
  buySpacingPct: number;
  minimumReserveUsdc: number;

  borrowAprPct: number;
  usdcReserveYieldPct: number;
  wbtcYieldPct: number;
  miningYieldPct: number;
  electricityMonthlyUsdc: number;

  timelineMonths: number;
  btcPath?: number[];
};

export type CollateralBasePosition = {
  investmentUsdc: number;

  miningAllocatedUsdc: number;
  btcAllocatedUsdc: number;
  reserveAllocatedUsdc: number;

  wbtcCollateralAmount: number;
  debtUsdc: number;
  workingReserveUsdc: number;

  collateralValueUsdc: number;
  currentLtvPct: number;
  liquidationPriceUsd: number;
  distanceToLiquidationPct: number;
};

export type SellStep = {
  step: number;
  triggerPriceUsd: number;
  ltvBeforePct: number;
  btcSold: number;
  usdcReceived: number;
  debtRepaidUsdc: number;
  debtAfterUsdc: number;
  wbtcCollateralAfter: number;
  workingReserveAfterUsdc: number;
  ltvAfterPct: number;
  liquidationPriceAfterUsd: number;
  bufferRestoredPct: number;
  feasible: boolean;
  reason: string;
};

export type BuybackStep = {
  step: number;
  triggerPriceUsd: number;
  distanceBeforePct: number;
  usdcDeployed: number;
  btcBought: number;
  workingReserveAfterUsdc: number;
  wbtcCollateralAfter: number;
  ltvAfterPct: number;
  reserveFloorOk: boolean;
  maxLtvOk: boolean;
  distanceOk: boolean;
  allowed: boolean;
  reason: string;
};

export type CollateralTimelineRow = {
  month: number;
  btcPriceUsd: number;
  debtUsdc: number;
  workingReserveUsdc: number;
  wbtcCollateralAmount: number;
  collateralValueUsdc: number;
  ltvPct: number;
  liquidationPriceUsd: number;
  distanceToLiquidationPct: number;
  eventType: "NONE" | "SELL" | "BUYBACK" | "LIQUIDATION";
  event?: {
    btcSold?: number;
    btcBought?: number;
    usdcReceived?: number;
    usdcDeployed?: number;
    debtRepaidUsdc?: number;
  };
  riskZone: "SAFE" | "WATCH" | "DERISK" | "LIQUIDATED";
};

export type CollateralOptimizationSummary = {
  base: CollateralBasePosition;
  sellLadder: SellStep[];
  buybackLadder: BuybackStep[];
  timeline: CollateralTimelineRow[];

  liquidationAvoided: boolean;
  liquidationMonth: number | null;

  totalBtcSold: number;
  totalUsdcFromSales: number;
  totalDebtRepaidUsdc: number;
  totalBtcBought: number;
  totalUsdcDeployedForBuyback: number;

  finalDebtUsdc: number;
  finalWorkingReserveUsdc: number;
  finalWbtcCollateralAmount: number;
  finalNetEquityUsdc: number;
  modelledRoiPct: number;

  minimumReserveRequiredUsdc: number;
  maximumSafeBuybackBtc: number;

  objectiveScore: number;
  objectiveBreakdown: {
    liquidationPenalty: number;
    drawdownPenalty: number;
    debtPenalty: number;
    reservePenalty: number;
    btcRetentionScore: number;
    roiScore: number;
  };
};

export type CollateralOptimizerSearchConfig = {
  btcPaths: Array<{
    id: string;
    label: string;
    prices: number[];
    weight: number;
  }>;

  candidateRanges: {
    deRiskTriggerLtvPct: number[];
    postSellTargetLtvPct: number[];
    reRiskTriggerDistancePct: number[];
    maxLtvAfterBuyPct: number[];
    repayRatioPct: number[];
    buyStepPctOfReserve: number[];
    buySpacingPct: number[];
    minimumReserveUsdc: number[];
  };

  objectiveWeights: {
    liquidationAvoidance: number;
    maxDrawdown: number;
    debtReduction: number;
    reserveSafety: number;
    btcRetention: number;
    modelledRoi: number;
  };

  maxCandidates?: number;
};

export type CollateralOptimizerResult = {
  bestInput: CollateralRebalancingInput;
  bestSummary: CollateralOptimizationSummary;
  rankedCandidates: Array<{
    rank: number;
    input: CollateralRebalancingInput;
    summary: CollateralOptimizationSummary;
    pathScores: Array<{
      pathId: string;
      score: number;
      liquidationAvoided: boolean;
      modelledRoiPct: number;
      finalDebtUsdc: number;
      finalWbtcCollateralAmount: number;
      finalWorkingReserveUsdc: number;
    }>;
  }>;
  rejectedCandidates: Array<{
    reason: string;
    count: number;
  }>;
};

export type CollateralValidationIssue = {
  code: string;
  message: string;
  field?: string;
};

export type CollateralValidationResult = {
  normalizedInput: CollateralRebalancingInput;
  warnings: CollateralValidationIssue[];
  errors: CollateralValidationIssue[];
  isValid: boolean;
};

export type CollateralValidationOptions = {
  allowUnderMiningFloorForTesting?: boolean;
};

type PositionState = {
  debtUsdc: number;
  workingReserveUsdc: number;
  wbtcCollateralAmount: number;
};

type BuybackAnchorState = PositionState & {
  anchorSellPriceUsd: number;
  distanceSafePriceUsd: number;
};

type PercentField =
  | "miningAllocationPct"
  | "btcAllocationPct"
  | "usdcAllocationPct"
  | "openingLtvPct"
  | "liquidationLtvPct"
  | "deRiskTriggerLtvPct"
  | "postSellTargetLtvPct"
  | "reRiskTriggerDistancePct"
  | "maxLtvAfterBuyPct"
  | "repayRatioPct"
  | "sellStepPctOfCollateral"
  | "buyStepPctOfReserve"
  | "buySpacingPct"
  | "borrowAprPct"
  | "usdcReserveYieldPct"
  | "wbtcYieldPct"
  | "miningYieldPct";

const PERCENT_FIELDS: readonly PercentField[] = [
  "miningAllocationPct",
  "btcAllocationPct",
  "usdcAllocationPct",
  "openingLtvPct",
  "liquidationLtvPct",
  "deRiskTriggerLtvPct",
  "postSellTargetLtvPct",
  "reRiskTriggerDistancePct",
  "maxLtvAfterBuyPct",
  "repayRatioPct",
  "sellStepPctOfCollateral",
  "buyStepPctOfReserve",
  "buySpacingPct",
  "borrowAprPct",
  "usdcReserveYieldPct",
  "wbtcYieldPct",
  "miningYieldPct",
];

const DEFAULT_OBJECTIVE_WEIGHTS = {
  liquidationAvoidance: 8,
  maxDrawdown: 2,
  debtReduction: 2,
  reserveSafety: 3,
  btcRetention: 2,
  modelledRoi: 1,
} as const;

function cloneInput(input: CollateralRebalancingInput): CollateralRebalancingInput {
  return {
    ...input,
    ...(input.btcPath ? { btcPath: [...input.btcPath] } : {}),
  };
}

function approxEqual(a: number, b: number, tolerance: number = EPSILON): boolean {
  return Math.abs(a - b) <= tolerance;
}

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

function positiveOrZero(value: number): number {
  return value < 0 ? 0 : value;
}

function ratioToDisplay(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function pctMaybeToRatio(
  field: PercentField,
  value: number | undefined,
  warnings: CollateralValidationIssue[],
): number | undefined {
  if (value === undefined) return undefined;
  if (!isFiniteNumber(value)) return value;
  if (Math.abs(value) > 1 + EPSILON) {
    warnings.push({
      code: "normalized_percent_scale",
      field,
      message: `${field} was provided on a 0..100 scale and normalized to 0..1.`,
    });
    return value / 100;
  }
  return value;
}

function validateNumberField(
  errors: CollateralValidationIssue[],
  field: string,
  value: number,
): void {
  if (!isFiniteNumber(value)) {
    errors.push({
      code: "non_finite_number",
      field,
      message: `${field} must be a finite number.`,
    });
  }
}

function assertValid(
  input: CollateralRebalancingInput,
  options?: CollateralValidationOptions,
): CollateralRebalancingInput {
  const result = validateCollateralInput(input, options);
  if (result.isValid) return result.normalizedInput;
  throw new Error(result.errors.map((issue) => issue.message).join(" | "));
}

function collateralValueUsd(
  wbtcCollateralAmount: number,
  btcPriceUsd: number,
): number {
  return wbtcCollateralAmount * btcPriceUsd;
}

function ltvPctFromState(state: PositionState, btcPriceUsd: number): number {
  const collateralValueUsdc = collateralValueUsd(
    state.wbtcCollateralAmount,
    btcPriceUsd,
  );
  if (state.debtUsdc <= 0 || collateralValueUsdc <= 0) return 0;
  return state.debtUsdc / collateralValueUsdc;
}

function liquidationPriceUsdFromState(
  state: PositionState,
  liquidationLtvPct: number,
): number {
  if (state.debtUsdc <= 0 || state.wbtcCollateralAmount <= 0 || liquidationLtvPct <= 0) {
    return 0;
  }
  return state.debtUsdc / (state.wbtcCollateralAmount * liquidationLtvPct);
}

function distanceToLiquidationPctFromState(
  state: PositionState,
  btcPriceUsd: number,
  liquidationLtvPct: number,
): number {
  return liquidationLtvPct - ltvPctFromState(state, btcPriceUsd);
}

function classifyRiskZone(
  ltvPct: number,
  distanceToLiquidationPct: number,
  input: CollateralRebalancingInput,
  eventType: CollateralTimelineRow["eventType"],
): CollateralTimelineRow["riskZone"] {
  if (eventType === "LIQUIDATION" || ltvPct >= input.liquidationLtvPct) {
    return "LIQUIDATED";
  }
  if (ltvPct >= input.deRiskTriggerLtvPct) {
    return "DERISK";
  }
  if (distanceToLiquidationPct >= input.reRiskTriggerDistancePct) {
    return "SAFE";
  }
  return "WATCH";
}

function createTimelineRow(
  month: number,
  btcPriceUsd: number,
  state: PositionState,
  input: CollateralRebalancingInput,
  eventType: CollateralTimelineRow["eventType"],
  event?: CollateralTimelineRow["event"],
): CollateralTimelineRow {
  const collateralValueUsdc = collateralValueUsd(
    state.wbtcCollateralAmount,
    btcPriceUsd,
  );
  const ltvPct = ltvPctFromState(state, btcPriceUsd);
  const liquidationPriceUsd = liquidationPriceUsdFromState(
    state,
    input.liquidationLtvPct,
  );
  const distanceToLiquidationPct = input.liquidationLtvPct - ltvPct;
  return {
    month,
    btcPriceUsd,
    debtUsdc: state.debtUsdc,
    workingReserveUsdc: state.workingReserveUsdc,
    wbtcCollateralAmount: state.wbtcCollateralAmount,
    collateralValueUsdc,
    ltvPct,
    liquidationPriceUsd,
    distanceToLiquidationPct,
    eventType,
    ...(event ? { event } : {}),
    riskZone: classifyRiskZone(ltvPct, distanceToLiquidationPct, input, eventType),
  };
}

function monthFactor(aprPct: number): number {
  return aprPct / 12;
}

function getStaticSellFraction(
  ltvBeforePct: number,
  input: CollateralRebalancingInput,
): { fraction: number | null; reason: string } {
  if (input.repayRatioPct <= ltvBeforePct + EPSILON) {
    return {
      fraction: null,
      reason:
        "Infeasible sell: repayRatioPct must stay above ltvBeforePct or a sale worsens LTV.",
    };
  }

  if (input.sellMode === "FIXED_STEP") {
    const fraction = input.sellStepPctOfCollateral ?? 0;
    if (fraction <= 0) {
      return {
        fraction: null,
        reason: "Infeasible sell: sellStepPctOfCollateral must be > 0 in FIXED_STEP mode.",
      };
    }
    if (fraction >= 1) {
      return {
        fraction: null,
        reason: "Infeasible sell: sellStepPctOfCollateral must be < 100% of collateral.",
      };
    }
    return {
      fraction,
      reason: `Fixed-step sell of ${ratioToDisplay(fraction)} of collateral.`,
    };
  }

  const numerator = ltvBeforePct - input.postSellTargetLtvPct;
  const denominator = input.repayRatioPct - input.postSellTargetLtvPct;
  if (denominator <= EPSILON) {
    return {
      fraction: null,
      reason: "Infeasible sell: repayRatioPct must stay above postSellTargetLtvPct.",
    };
  }
  const fraction = numerator / denominator;
  if (fraction <= 0) {
    return {
      fraction: null,
      reason: "Infeasible sell: AUTO_TO_TARGET produced a non-positive sale fraction.",
    };
  }
  if (fraction >= 1) {
    return {
      fraction: null,
      reason: "Infeasible sell: AUTO_TO_TARGET would consume all collateral or more.",
    };
  }
  return {
    fraction,
    reason: `Auto-to-target sell sized to restore LTV toward ${ratioToDisplay(
      input.postSellTargetLtvPct,
    )}.`,
  };
}

function simulateSellAtPrice(
  state: PositionState,
  btcPriceUsd: number,
  input: CollateralRebalancingInput,
): {
  stepState: PositionState;
  ltvBeforePct: number;
  step: Omit<SellStep, "step" | "triggerPriceUsd">;
} {
  const ltvBeforePct = ltvPctFromState(state, btcPriceUsd);
  const fraction = getStaticSellFraction(ltvBeforePct, input);
  if (fraction.fraction === null) {
    return {
      stepState: state,
      ltvBeforePct,
      step: {
        ltvBeforePct,
        btcSold: 0,
        usdcReceived: 0,
        debtRepaidUsdc: 0,
        debtAfterUsdc: state.debtUsdc,
        wbtcCollateralAfter: state.wbtcCollateralAmount,
        workingReserveAfterUsdc: state.workingReserveUsdc,
        ltvAfterPct: ltvBeforePct,
        liquidationPriceAfterUsd: liquidationPriceUsdFromState(
          state,
          input.liquidationLtvPct,
        ),
        bufferRestoredPct: 0,
        feasible: false,
        reason: fraction.reason,
      },
    };
  }

  const btcSold = state.wbtcCollateralAmount * fraction.fraction;
  const usdcReceived = btcSold * btcPriceUsd;
  const debtRepaidUsdc = Math.min(
    usdcReceived * input.repayRatioPct,
    state.debtUsdc,
  );
  const debtAfterUsdc = positiveOrZero(state.debtUsdc - debtRepaidUsdc);
  const wbtcCollateralAfter = positiveOrZero(state.wbtcCollateralAmount - btcSold);
  const workingReserveAfterUsdc =
    state.workingReserveUsdc + (usdcReceived - debtRepaidUsdc);
  const stepState = {
    debtUsdc: debtAfterUsdc,
    workingReserveUsdc: workingReserveAfterUsdc,
    wbtcCollateralAmount: wbtcCollateralAfter,
  };
  const ltvAfterPct = ltvPctFromState(stepState, btcPriceUsd);
  const feasible =
    btcSold > EPSILON &&
    debtRepaidUsdc >= 0 &&
    ltvAfterPct + EPSILON < ltvBeforePct &&
    wbtcCollateralAfter > EPSILON;
  return {
    stepState,
    ltvBeforePct,
    step: {
      ltvBeforePct,
      btcSold,
      usdcReceived,
      debtRepaidUsdc,
      debtAfterUsdc,
      wbtcCollateralAfter,
      workingReserveAfterUsdc,
      ltvAfterPct,
      liquidationPriceAfterUsd: liquidationPriceUsdFromState(
        stepState,
        input.liquidationLtvPct,
      ),
      bufferRestoredPct: ltvBeforePct - ltvAfterPct,
      feasible,
      reason: feasible
        ? fraction.reason
        : "Infeasible sell: resulting sale does not reduce LTV enough to improve safety.",
    },
  };
}

function deriveBuybackAnchorState(
  base: CollateralBasePosition,
  sellLadder: readonly SellStep[],
  input: CollateralRebalancingInput,
): BuybackAnchorState {
  const feasibleSells = sellLadder.filter((step) => step.feasible);
  const lastFeasibleSell = feasibleSells[feasibleSells.length - 1];
  const state: PositionState = lastFeasibleSell
    ? {
        debtUsdc: lastFeasibleSell.debtAfterUsdc,
        workingReserveUsdc: lastFeasibleSell.workingReserveAfterUsdc,
        wbtcCollateralAmount: lastFeasibleSell.wbtcCollateralAfter,
      }
    : {
        debtUsdc: base.debtUsdc,
        workingReserveUsdc: base.workingReserveUsdc,
        wbtcCollateralAmount: base.wbtcCollateralAmount,
      };
  const anchorSellPriceUsd = lastFeasibleSell
    ? lastFeasibleSell.triggerPriceUsd
    : input.btcSpotPriceUsd;
  const safeLtv = input.liquidationLtvPct - input.reRiskTriggerDistancePct;
  const distanceSafePriceUsd =
    state.debtUsdc > 0 && state.wbtcCollateralAmount > 0 && safeLtv > EPSILON
      ? state.debtUsdc / (state.wbtcCollateralAmount * safeLtv)
      : 0;
  return {
    ...state,
    anchorSellPriceUsd,
    distanceSafePriceUsd,
  };
}

function nextBuybackExecutionTriggerUsd(
  anchorSellPriceUsd: number,
  buySpacingPct: number,
  step: number,
): number {
  return anchorSellPriceUsd * Math.pow(1 + buySpacingPct, step);
}

function timelineNetEquityUsdc(
  row: CollateralTimelineRow,
  miningAllocatedUsdc: number,
): number {
  return (
    miningAllocatedUsdc +
    row.workingReserveUsdc +
    row.collateralValueUsdc -
    row.debtUsdc
  );
}

function computeMaxDrawdownPct(
  rows: readonly CollateralTimelineRow[],
  miningAllocatedUsdc: number,
): number {
  let peak = Number.NEGATIVE_INFINITY;
  let maxDrawdown = 0;
  for (const row of rows) {
    const equity = timelineNetEquityUsdc(row, miningAllocatedUsdc);
    peak = Math.max(peak, equity);
    if (peak <= EPSILON) continue;
    const drawdown = (peak - equity) / peak;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
  }
  return maxDrawdown;
}

function minimumReserveSeen(rows: readonly CollateralTimelineRow[]): number {
  return rows.reduce(
    (minValue, row) => Math.min(minValue, row.workingReserveUsdc),
    Number.POSITIVE_INFINITY,
  );
}

function computeSummaryObjectiveScore(
  summary: Omit<
    CollateralOptimizationSummary,
    "objectiveScore" | "objectiveBreakdown"
  >,
): {
  objectiveScore: number;
  objectiveBreakdown: CollateralOptimizationSummary["objectiveBreakdown"];
} {
  const maxDrawdownPct = computeMaxDrawdownPct(
    summary.timeline,
    summary.base.miningAllocatedUsdc,
  );
  const initialDebtUsdc = summary.base.debtUsdc;
  const debtPenalty =
    initialDebtUsdc > EPSILON ? summary.finalDebtUsdc / initialDebtUsdc : 0;
  const reserveFloorBreachUsdc = Math.max(
    0,
    summary.minimumReserveRequiredUsdc - minimumReserveSeen(summary.timeline),
  );
  const reservePenalty =
    summary.minimumReserveRequiredUsdc > EPSILON
      ? reserveFloorBreachUsdc / summary.minimumReserveRequiredUsdc
      : 0;
  const btcRetentionScore =
    summary.base.wbtcCollateralAmount > EPSILON
      ? summary.finalWbtcCollateralAmount / summary.base.wbtcCollateralAmount
      : 0;
  const roiScore = summary.modelledRoiPct;
  const liquidationPenalty = summary.liquidationAvoided ? 0 : 1;
  const objectiveScore =
    (summary.liquidationAvoided ? 1 : -1) * 10_000 -
    liquidationPenalty * 10_000 -
    maxDrawdownPct * 1_000 -
    debtPenalty * 400 -
    reservePenalty * 2_000 +
    btcRetentionScore * 300 +
    roiScore * 800;
  return {
    objectiveScore,
    objectiveBreakdown: {
      liquidationPenalty,
      drawdownPenalty: maxDrawdownPct,
      debtPenalty,
      reservePenalty,
      btcRetentionScore,
      roiScore,
    },
  };
}

export function normalizeCollateralInput(
  input: CollateralRebalancingInput,
): Pick<CollateralValidationResult, "normalizedInput" | "warnings"> {
  const warnings: CollateralValidationIssue[] = [];
  const cloned = cloneInput(input);
  const clonedPercentFields = cloned as Record<PercentField, number | undefined>;
  for (const field of PERCENT_FIELDS) {
    const normalized = pctMaybeToRatio(field, clonedPercentFields[field], warnings);
    if (normalized !== undefined) {
      clonedPercentFields[field] = normalized;
    }
  }
  if (cloned.btcPath) {
    cloned.btcPath = [...cloned.btcPath];
  }
  return {
    normalizedInput: cloned,
    warnings,
  };
}

export function validateCollateralInput(
  input: CollateralRebalancingInput,
  options?: CollateralValidationOptions,
): CollateralValidationResult {
  const { normalizedInput, warnings } = normalizeCollateralInput(input);
  const errors: CollateralValidationIssue[] = [];

  validateNumberField(errors, "investmentUsdc", normalizedInput.investmentUsdc);
  validateNumberField(errors, "btcSpotPriceUsd", normalizedInput.btcSpotPriceUsd);
  validateNumberField(errors, "timelineMonths", normalizedInput.timelineMonths);
  validateNumberField(errors, "minimumReserveUsdc", normalizedInput.minimumReserveUsdc);
  validateNumberField(
    errors,
    "electricityMonthlyUsdc",
    normalizedInput.electricityMonthlyUsdc,
  );

  if (normalizedInput.btcPath) {
    normalizedInput.btcPath.forEach((price, index) => {
      validateNumberField(errors, `btcPath[${index}]`, price);
    });
  }

  if (normalizedInput.investmentUsdc <= 0) {
    errors.push({
      code: "investment_positive",
      field: "investmentUsdc",
      message: "investmentUsdc must be > 0.",
    });
  }
  if (normalizedInput.btcSpotPriceUsd <= 0) {
    errors.push({
      code: "btc_price_positive",
      field: "btcSpotPriceUsd",
      message: "btcSpotPriceUsd must be > 0.",
    });
  }
  if (!Number.isInteger(normalizedInput.timelineMonths) || normalizedInput.timelineMonths < 1) {
    errors.push({
      code: "timeline_months",
      field: "timelineMonths",
      message: "timelineMonths must be an integer >= 1.",
    });
  }

  const allocationSum =
    normalizedInput.miningAllocationPct +
    normalizedInput.btcAllocationPct +
    normalizedInput.usdcAllocationPct;
  if (!approxEqual(allocationSum, 1, 1e-6)) {
    errors.push({
      code: "allocations_sum",
      message:
        "Allocations must sum exactly to 100% (1.0 in normalized ratio units).",
    });
  }
  if (!options?.allowUnderMiningFloorForTesting && normalizedInput.miningAllocationPct < MINING_FLOOR_PCT) {
    errors.push({
      code: "mining_floor",
      field: "miningAllocationPct",
      message: "miningAllocationPct must be >= 30% for the house collateral model.",
    });
  }
  if (COLLATERAL_BUCKETS.length !== 3) {
    errors.push({
      code: "bucket_count",
      message: "Collateral rebalancing must keep exactly 3 buckets.",
    });
  }
  if (normalizedInput.openingLtvPct <= 0 || normalizedInput.openingLtvPct >= 1) {
    errors.push({
      code: "opening_ltv_range",
      field: "openingLtvPct",
      message: "openingLtvPct must stay within (0, 100%).",
    });
  }
  if (normalizedInput.liquidationLtvPct <= normalizedInput.deRiskTriggerLtvPct) {
    errors.push({
      code: "ltv_order_liq_derisk",
      field: "liquidationLtvPct",
      message: "liquidationLtvPct must be strictly above deRiskTriggerLtvPct.",
    });
  }
  if (normalizedInput.deRiskTriggerLtvPct <= normalizedInput.postSellTargetLtvPct) {
    errors.push({
      code: "ltv_order_derisk_target",
      field: "deRiskTriggerLtvPct",
      message: "deRiskTriggerLtvPct must be strictly above postSellTargetLtvPct.",
    });
  }
  if (normalizedInput.maxLtvAfterBuyPct >= normalizedInput.liquidationLtvPct) {
    errors.push({
      code: "buy_cap_below_liq",
      field: "maxLtvAfterBuyPct",
      message: "maxLtvAfterBuyPct must stay below liquidationLtvPct.",
    });
  }
  if (normalizedInput.minimumReserveUsdc < 0) {
    errors.push({
      code: "reserve_floor_non_negative",
      field: "minimumReserveUsdc",
      message: "minimumReserveUsdc must be >= 0.",
    });
  }
  if (normalizedInput.repayRatioPct <= 0 || normalizedInput.repayRatioPct > 1) {
    errors.push({
      code: "repay_ratio_range",
      field: "repayRatioPct",
      message: "repayRatioPct must stay within (0, 100%].",
    });
  }
  if (normalizedInput.sellMode === "FIXED_STEP") {
    if (normalizedInput.sellStepPctOfCollateral === undefined) {
      errors.push({
        code: "sell_step_required",
        field: "sellStepPctOfCollateral",
        message: "sellStepPctOfCollateral is required in FIXED_STEP mode.",
      });
    } else if (
      normalizedInput.sellStepPctOfCollateral <= 0 ||
      normalizedInput.sellStepPctOfCollateral >= 1
    ) {
      errors.push({
        code: "sell_step_range",
        field: "sellStepPctOfCollateral",
        message: "sellStepPctOfCollateral must stay within (0, 100%).",
      });
    }
  }
  if (
    normalizedInput.buyStepPctOfReserve <= 0 ||
    normalizedInput.buyStepPctOfReserve > 1
  ) {
    errors.push({
      code: "buy_step_range",
      field: "buyStepPctOfReserve",
      message: "buyStepPctOfReserve must stay within (0, 100%].",
    });
  }
  if (normalizedInput.buySpacingPct <= 0) {
    errors.push({
      code: "buy_spacing_positive",
      field: "buySpacingPct",
      message: "buySpacingPct must be > 0.",
    });
  }
  if (normalizedInput.reRiskTriggerDistancePct <= 0) {
    errors.push({
      code: "rerisk_distance_positive",
      field: "reRiskTriggerDistancePct",
      message: "reRiskTriggerDistancePct must be > 0.",
    });
  }
  if (
    normalizedInput.reRiskTriggerDistancePct >= normalizedInput.liquidationLtvPct
  ) {
    errors.push({
      code: "rerisk_distance_bound",
      field: "reRiskTriggerDistancePct",
      message: "reRiskTriggerDistancePct must stay below liquidationLtvPct.",
    });
  }

  if (normalizedInput.btcPath) {
    if (normalizedInput.btcPath.length !== normalizedInput.timelineMonths + 1) {
      errors.push({
        code: "btc_path_length",
        field: "btcPath",
        message:
          "btcPath must contain timelineMonths + 1 prices, including month 0 spot.",
      });
    } else if (
      normalizedInput.btcPath.length > 0 &&
      !approxEqual(normalizedInput.btcPath[0] ?? 0, normalizedInput.btcSpotPriceUsd, 1e-6)
    ) {
      errors.push({
        code: "btc_path_anchor",
        field: "btcPath",
        message: "btcPath[0] must equal btcSpotPriceUsd.",
      });
    }
  }

  return {
    normalizedInput,
    warnings,
    errors,
    isValid: errors.length === 0,
  };
}

export function buildBasePosition(
  input: CollateralRebalancingInput,
  options?: CollateralValidationOptions,
): CollateralBasePosition {
  const normalized = assertValid(input, options);
  const miningAllocatedUsdc =
    normalized.investmentUsdc * normalized.miningAllocationPct;
  const btcAllocatedUsdc = normalized.investmentUsdc * normalized.btcAllocationPct;
  const reserveAllocatedUsdc =
    normalized.investmentUsdc * normalized.usdcAllocationPct;

  const wbtcCollateralAmount = btcAllocatedUsdc / normalized.btcSpotPriceUsd;
  const debtUsdc = btcAllocatedUsdc * normalized.openingLtvPct;
  const workingReserveUsdc = reserveAllocatedUsdc + debtUsdc;

  const collateralValueUsdc = collateralValueUsd(
    wbtcCollateralAmount,
    normalized.btcSpotPriceUsd,
  );
  const currentLtvPct =
    collateralValueUsdc > 0 ? debtUsdc / collateralValueUsdc : 0;
  const liquidationPriceUsd =
    debtUsdc > 0 && wbtcCollateralAmount > 0
      ? debtUsdc / (wbtcCollateralAmount * normalized.liquidationLtvPct)
      : 0;
  const distanceToLiquidationPct =
    normalized.liquidationLtvPct - currentLtvPct;

  return {
    investmentUsdc: normalized.investmentUsdc,
    miningAllocatedUsdc,
    btcAllocatedUsdc,
    reserveAllocatedUsdc,
    wbtcCollateralAmount,
    debtUsdc,
    workingReserveUsdc,
    collateralValueUsdc,
    currentLtvPct,
    liquidationPriceUsd,
    distanceToLiquidationPct,
  };
}

export function buildSellLadder(
  input: CollateralRebalancingInput,
  base: CollateralBasePosition,
): SellStep[] {
  const normalized = assertValid(input);
  let state: PositionState = {
    debtUsdc: base.debtUsdc,
    workingReserveUsdc: base.workingReserveUsdc,
    wbtcCollateralAmount: base.wbtcCollateralAmount,
  };
  const rows: SellStep[] = [];
  let previousTriggerPriceUsd = Number.POSITIVE_INFINITY;
  const maxSteps = Math.min(DEFAULT_LADDER_MAX_STEPS, normalized.timelineMonths + 4);

  for (let step = 1; step <= maxSteps; step += 1) {
    if (state.debtUsdc <= EPSILON || state.wbtcCollateralAmount <= EPSILON) {
      break;
    }
    let triggerPriceUsd =
      state.debtUsdc /
      (state.wbtcCollateralAmount * normalized.deRiskTriggerLtvPct);
    const currentLtvPct = ltvPctFromState(state, normalized.btcSpotPriceUsd);
    if (step === 1 && currentLtvPct >= normalized.deRiskTriggerLtvPct) {
      triggerPriceUsd = normalized.btcSpotPriceUsd;
    }
    if (triggerPriceUsd <= EPSILON) break;
    if (triggerPriceUsd >= previousTriggerPriceUsd - EPSILON) break;

    const simulated = simulateSellAtPrice(state, triggerPriceUsd, normalized);
    const row: SellStep = {
      step,
      triggerPriceUsd,
      ...simulated.step,
    };
    rows.push(row);
    previousTriggerPriceUsd = triggerPriceUsd;

    if (!row.feasible) {
      break;
    }
    state = {
      debtUsdc: row.debtAfterUsdc,
      workingReserveUsdc: row.workingReserveAfterUsdc,
      wbtcCollateralAmount: row.wbtcCollateralAfter,
    };
  }

  return rows;
}

export function buildBuybackLadder(
  input: CollateralRebalancingInput,
  base: CollateralBasePosition,
  sellLadder: readonly SellStep[],
): BuybackStep[] {
  const normalized = assertValid(input);
  const anchorState = deriveBuybackAnchorState(base, sellLadder, normalized);
  let state: PositionState = {
    debtUsdc: anchorState.debtUsdc,
    workingReserveUsdc: anchorState.workingReserveUsdc,
    wbtcCollateralAmount: anchorState.wbtcCollateralAmount,
  };
  const rows: BuybackStep[] = [];
  const maxSteps = Math.min(DEFAULT_LADDER_MAX_STEPS, normalized.timelineMonths + 4);

  for (let step = 1; step <= maxSteps; step += 1) {
    if (state.debtUsdc <= EPSILON) break;
    const triggerPriceUsd = nextBuybackExecutionTriggerUsd(
      anchorState.anchorSellPriceUsd,
      normalized.buySpacingPct,
      step,
    );
    const distanceBeforePct = distanceToLiquidationPctFromState(
      state,
      triggerPriceUsd,
      normalized.liquidationLtvPct,
    );
    const headroomUsdc = Math.max(
      0,
      state.workingReserveUsdc - normalized.minimumReserveUsdc,
    );
    const desiredDeployUsdc =
      state.workingReserveUsdc * normalized.buyStepPctOfReserve;
    const usdcDeployed = Math.min(desiredDeployUsdc, headroomUsdc);
    const btcBought = usdcDeployed > 0 ? usdcDeployed / triggerPriceUsd : 0;
    const nextState: PositionState = {
      debtUsdc: state.debtUsdc,
      workingReserveUsdc: state.workingReserveUsdc - usdcDeployed,
      wbtcCollateralAmount: state.wbtcCollateralAmount + btcBought,
    };
    const ltvAfterPct = ltvPctFromState(nextState, triggerPriceUsd);
    const reserveFloorOk =
      nextState.workingReserveUsdc + EPSILON >= normalized.minimumReserveUsdc;
    const maxLtvOk = ltvAfterPct <= normalized.maxLtvAfterBuyPct + EPSILON;
    const distanceOk =
      distanceBeforePct + EPSILON >= normalized.reRiskTriggerDistancePct;
    const allowed =
      usdcDeployed > EPSILON && reserveFloorOk && maxLtvOk && distanceOk;
    let reason = "";
    if (!distanceOk) {
      reason = `Waiting for distanceSafePriceUsd ${anchorState.distanceSafePriceUsd.toFixed(
        2,
      )}; execution trigger ${triggerPriceUsd.toFixed(2)} is still too early.`;
    } else if (headroomUsdc <= EPSILON) {
      reason = "Reserve floor reached: no deployable USDC remains above minimumReserveUsdc.";
    } else if (!maxLtvOk) {
      reason = "Blocked: post-buy LTV would exceed maxLtvAfterBuyPct.";
    } else if (!reserveFloorOk) {
      reason = "Blocked: buyback would push the working reserve below minimumReserveUsdc.";
    } else {
      reason =
        "Allowed: execution trigger reached, liquidation distance is healthy, and reserve floor remains respected.";
    }

    rows.push({
      step,
      triggerPriceUsd,
      distanceBeforePct,
      usdcDeployed: allowed ? usdcDeployed : 0,
      btcBought: allowed ? btcBought : 0,
      workingReserveAfterUsdc: allowed
        ? nextState.workingReserveUsdc
        : state.workingReserveUsdc,
      wbtcCollateralAfter: allowed
        ? nextState.wbtcCollateralAmount
        : state.wbtcCollateralAmount,
      ltvAfterPct: allowed ? ltvAfterPct : ltvPctFromState(state, triggerPriceUsd),
      reserveFloorOk,
      maxLtvOk,
      distanceOk,
      allowed,
      reason,
    });

    if (allowed) {
      state = nextState;
    }
  }

  return rows;
}

export function simulateCollateralTimeline(
  input: CollateralRebalancingInput,
  base: CollateralBasePosition,
  sellLadder: readonly SellStep[],
  buybackLadder: readonly BuybackStep[],
): CollateralTimelineRow[] {
  const normalized = assertValid(input);
  const path =
    normalized.btcPath ?? createFlatBtcPath(normalized.btcSpotPriceUsd, normalized.timelineMonths);

  const rows: CollateralTimelineRow[] = [];
  let state: PositionState = {
    debtUsdc: base.debtUsdc,
    workingReserveUsdc: base.workingReserveUsdc,
    wbtcCollateralAmount: base.wbtcCollateralAmount,
  };
  let lastExecutedSellPriceUsd: number | null = null;
  let executedBuybacks = 0;

  rows.push(
    createTimelineRow(0, path[0] ?? normalized.btcSpotPriceUsd, state, normalized, "NONE"),
  );

  for (let month = 1; month <= normalized.timelineMonths; month += 1) {
    const btcPriceUsd = path[month] ?? path[path.length - 1] ?? normalized.btcSpotPriceUsd;

    // Monthly economics accrue before policy actions.
    state = {
      debtUsdc: state.debtUsdc * (1 + monthFactor(normalized.borrowAprPct)),
      workingReserveUsdc:
        state.workingReserveUsdc *
          (1 + monthFactor(normalized.usdcReserveYieldPct)) +
        base.miningAllocatedUsdc * monthFactor(normalized.miningYieldPct) -
        normalized.electricityMonthlyUsdc,
      wbtcCollateralAmount:
        state.wbtcCollateralAmount *
        (1 + monthFactor(normalized.wbtcYieldPct)),
    };

    if (state.workingReserveUsdc < 0) {
      // House rule: any reserve deficit becomes additional debt; the strategy
      // remains fully USDC-denominated from the investor's perspective.
      state = {
        ...state,
        debtUsdc: state.debtUsdc + Math.abs(state.workingReserveUsdc),
        workingReserveUsdc: 0,
      };
    }

    const ltvBeforeActions = ltvPctFromState(state, btcPriceUsd);
    const eventStateBefore = { ...state };

    if (ltvBeforeActions >= normalized.liquidationLtvPct) {
      const seizedBtc = Math.min(
        state.wbtcCollateralAmount,
        (state.debtUsdc / btcPriceUsd) * 1.05,
      );
      state = {
        debtUsdc: 0,
        workingReserveUsdc: state.workingReserveUsdc,
        wbtcCollateralAmount: positiveOrZero(state.wbtcCollateralAmount - seizedBtc),
      };
      rows.push(
        createTimelineRow(month, btcPriceUsd, state, normalized, "LIQUIDATION", {
          btcSold: seizedBtc,
          debtRepaidUsdc: eventStateBefore.debtUsdc,
        }),
      );
      continue;
    }

    if (ltvBeforeActions >= normalized.deRiskTriggerLtvPct) {
      const simulated = simulateSellAtPrice(state, btcPriceUsd, normalized);
      if (simulated.step.feasible) {
        state = simulated.stepState;
        lastExecutedSellPriceUsd = btcPriceUsd;
        executedBuybacks = 0;
        rows.push(
          createTimelineRow(month, btcPriceUsd, state, normalized, "SELL", {
            btcSold: simulated.step.btcSold,
            usdcReceived: simulated.step.usdcReceived,
            debtRepaidUsdc: simulated.step.debtRepaidUsdc,
          }),
        );
        continue;
      }
    }

    if (lastExecutedSellPriceUsd !== null && state.debtUsdc > EPSILON) {
      const executionTriggerUsd = nextBuybackExecutionTriggerUsd(
        lastExecutedSellPriceUsd,
        normalized.buySpacingPct,
        executedBuybacks + 1,
      );
      const distanceBeforePct = distanceToLiquidationPctFromState(
        state,
        btcPriceUsd,
        normalized.liquidationLtvPct,
      );
      if (btcPriceUsd + EPSILON >= executionTriggerUsd) {
        const headroomUsdc = Math.max(
          0,
          state.workingReserveUsdc - normalized.minimumReserveUsdc,
        );
        const desiredDeployUsdc =
          state.workingReserveUsdc * normalized.buyStepPctOfReserve;
        const usdcDeployed = Math.min(desiredDeployUsdc, headroomUsdc);
        const btcBought = usdcDeployed > 0 ? usdcDeployed / btcPriceUsd : 0;
        const nextState: PositionState = {
          debtUsdc: state.debtUsdc,
          workingReserveUsdc: state.workingReserveUsdc - usdcDeployed,
          wbtcCollateralAmount: state.wbtcCollateralAmount + btcBought,
        };
        const ltvAfterPct = ltvPctFromState(nextState, btcPriceUsd);
        const allowed =
          usdcDeployed > EPSILON &&
          distanceBeforePct + EPSILON >= normalized.reRiskTriggerDistancePct &&
          ltvAfterPct <= normalized.maxLtvAfterBuyPct + EPSILON &&
          nextState.workingReserveUsdc + EPSILON >= normalized.minimumReserveUsdc;
        if (allowed) {
          state = nextState;
          executedBuybacks += 1;
          rows.push(
            createTimelineRow(month, btcPriceUsd, state, normalized, "BUYBACK", {
              btcBought,
              usdcDeployed,
            }),
          );
          continue;
        }
      }
    }

    rows.push(createTimelineRow(month, btcPriceUsd, state, normalized, "NONE"));
  }

  // Keep the unused parameter visible for later UI cross-checking.
  void sellLadder;
  void buybackLadder;

  return rows;
}

export function summarizeCollateralOptimization(
  input: CollateralRebalancingInput,
): CollateralOptimizationSummary {
  const normalized = assertValid(input);
  const base = buildBasePosition(normalized);
  const sellLadder = buildSellLadder(normalized, base);
  const buybackLadder = buildBuybackLadder(normalized, base, sellLadder);
  const timeline = simulateCollateralTimeline(
    normalized,
    base,
    sellLadder,
    buybackLadder,
  );

  const liquidationRow =
    timeline.find((row) => row.eventType === "LIQUIDATION") ?? null;
  const lastRow = timeline[timeline.length - 1]!;
  const totalBtcSold = timeline.reduce(
    (sum, row) => sum + (row.event?.btcSold ?? 0),
    0,
  );
  const totalUsdcFromSales = timeline.reduce(
    (sum, row) => sum + (row.event?.usdcReceived ?? 0),
    0,
  );
  const totalDebtRepaidUsdc = timeline.reduce(
    (sum, row) => sum + (row.event?.debtRepaidUsdc ?? 0),
    0,
  );
  const totalBtcBought = timeline.reduce(
    (sum, row) => sum + (row.event?.btcBought ?? 0),
    0,
  );
  const totalUsdcDeployedForBuyback = timeline.reduce(
    (sum, row) => sum + (row.event?.usdcDeployed ?? 0),
    0,
  );

  const finalNetEquityUsdc =
    base.miningAllocatedUsdc +
    lastRow.workingReserveUsdc +
    lastRow.collateralValueUsdc -
    lastRow.debtUsdc;
  const modelledRoiPct = finalNetEquityUsdc / normalized.investmentUsdc - 1;
  const minimumReserveRequiredUsdc = Math.max(
    normalized.minimumReserveUsdc,
    normalized.electricityMonthlyUsdc * RESERVE_COVERAGE_MONTHS,
  );

  const buybackAnchor = deriveBuybackAnchorState(base, sellLadder, normalized);
  const earliestBuybackTriggerUsd = nextBuybackExecutionTriggerUsd(
    buybackAnchor.anchorSellPriceUsd,
    normalized.buySpacingPct,
    1,
  );
  const maximumSafeBuybackBtc =
    Math.max(
      0,
      buybackAnchor.workingReserveUsdc - normalized.minimumReserveUsdc,
    ) /
    Math.max(
      earliestBuybackTriggerUsd,
      buybackAnchor.distanceSafePriceUsd,
      EPSILON,
    );

  const summaryWithoutObjective = {
    base,
    sellLadder,
    buybackLadder,
    timeline,
    liquidationAvoided: liquidationRow === null,
    liquidationMonth: liquidationRow?.month ?? null,
    totalBtcSold,
    totalUsdcFromSales,
    totalDebtRepaidUsdc,
    totalBtcBought,
    totalUsdcDeployedForBuyback,
    finalDebtUsdc: lastRow.debtUsdc,
    finalWorkingReserveUsdc: lastRow.workingReserveUsdc,
    finalWbtcCollateralAmount: lastRow.wbtcCollateralAmount,
    finalNetEquityUsdc,
    modelledRoiPct,
    minimumReserveRequiredUsdc,
    maximumSafeBuybackBtc,
  };

  const objective = computeSummaryObjectiveScore(summaryWithoutObjective);
  return {
    ...summaryWithoutObjective,
    objectiveScore: objective.objectiveScore,
    objectiveBreakdown: objective.objectiveBreakdown,
  };
}

function candidatePathScore(
  summary: CollateralOptimizationSummary,
  weights: CollateralOptimizerSearchConfig["objectiveWeights"],
): number {
  const maxDrawdownPct = computeMaxDrawdownPct(
    summary.timeline,
    summary.base.miningAllocatedUsdc,
  );
  const debtReductionScore =
    summary.base.debtUsdc > EPSILON
      ? 1 - summary.finalDebtUsdc / summary.base.debtUsdc
      : 1;
  const reserveSafetyScore =
    summary.minimumReserveRequiredUsdc > EPSILON
      ? Math.min(
          1,
          minimumReserveSeen(summary.timeline) / summary.minimumReserveRequiredUsdc,
        )
      : 1;
  const btcRetentionScore =
    summary.base.wbtcCollateralAmount > EPSILON
      ? summary.finalWbtcCollateralAmount / summary.base.wbtcCollateralAmount
      : 0;
  const liquidationScore = summary.liquidationAvoided ? 1 : -1;

  return (
    liquidationScore * weights.liquidationAvoidance * 10_000 -
    maxDrawdownPct * weights.maxDrawdown * 1_000 +
    debtReductionScore * weights.debtReduction * 800 +
    reserveSafetyScore * weights.reserveSafety * 700 +
    btcRetentionScore * weights.btcRetention * 600 +
    summary.modelledRoiPct * weights.modelledRoi * 900
  );
}

function* cartesianProduct(
  ranges: CollateralOptimizerSearchConfig["candidateRanges"],
): Generator<Partial<CollateralRebalancingInput>> {
  for (const deRiskTriggerLtvPct of ranges.deRiskTriggerLtvPct) {
    for (const postSellTargetLtvPct of ranges.postSellTargetLtvPct) {
      for (const reRiskTriggerDistancePct of ranges.reRiskTriggerDistancePct) {
        for (const maxLtvAfterBuyPct of ranges.maxLtvAfterBuyPct) {
          for (const repayRatioPct of ranges.repayRatioPct) {
            for (const buyStepPctOfReserve of ranges.buyStepPctOfReserve) {
              for (const buySpacingPct of ranges.buySpacingPct) {
                for (const minimumReserveUsdc of ranges.minimumReserveUsdc) {
                  yield {
                    deRiskTriggerLtvPct,
                    postSellTargetLtvPct,
                    reRiskTriggerDistancePct,
                    maxLtvAfterBuyPct,
                    repayRatioPct,
                    buyStepPctOfReserve,
                    buySpacingPct,
                    minimumReserveUsdc,
                  };
                }
              }
            }
          }
        }
      }
    }
  }
}

function countReason(
  rejected: Map<string, number>,
  reason: string,
): void {
  rejected.set(reason, (rejected.get(reason) ?? 0) + 1);
}

export function optimizeCollateralStrategy(
  input: CollateralRebalancingInput,
  searchConfig: CollateralOptimizerSearchConfig,
): CollateralOptimizerResult {
  const normalizedBase = assertValid(input);
  const rejected = new Map<string, number>();
  const ranked: CollateralOptimizerResult["rankedCandidates"] = [];
  const weights = {
    ...DEFAULT_OBJECTIVE_WEIGHTS,
    ...searchConfig.objectiveWeights,
  };
  const pathWeightTotal =
    searchConfig.btcPaths.reduce((sum, path) => sum + path.weight, 0) || 1;
  const maxCandidates = searchConfig.maxCandidates ?? Number.POSITIVE_INFINITY;

  for (const candidatePatch of cartesianProduct(searchConfig.candidateRanges)) {
    if (ranked.length >= maxCandidates) {
      countReason(rejected, "maxCandidates limit reached");
      break;
    }

    const candidateInput: CollateralRebalancingInput = {
      ...normalizedBase,
      ...candidatePatch,
    };
    const validation = validateCollateralInput(candidateInput);
    if (!validation.isValid) {
      countReason(rejected, validation.errors[0]?.message ?? "invalid candidate");
      continue;
    }

    const pathScores: Array<{
      pathId: string;
      score: number;
      liquidationAvoided: boolean;
      modelledRoiPct: number;
      finalDebtUsdc: number;
      finalWbtcCollateralAmount: number;
      finalWorkingReserveUsdc: number;
    }> = [];

    let weightedScore = 0;
    let representativeSummary: CollateralOptimizationSummary | null = null;
    let bestWeight = Number.NEGATIVE_INFINITY;

    for (const path of searchConfig.btcPaths) {
      const pathInput: CollateralRebalancingInput = {
        ...validation.normalizedInput,
        timelineMonths: path.prices.length - 1,
        btcSpotPriceUsd: path.prices[0] ?? validation.normalizedInput.btcSpotPriceUsd,
        btcPath: [...path.prices],
      };
      const pathSummary = summarizeCollateralOptimization(pathInput);
      const score = candidatePathScore(pathSummary, weights);
      weightedScore += score * path.weight;
      pathScores.push({
        pathId: path.id,
        score,
        liquidationAvoided: pathSummary.liquidationAvoided,
        modelledRoiPct: pathSummary.modelledRoiPct,
        finalDebtUsdc: pathSummary.finalDebtUsdc,
        finalWbtcCollateralAmount: pathSummary.finalWbtcCollateralAmount,
        finalWorkingReserveUsdc: pathSummary.finalWorkingReserveUsdc,
      });
      if (path.weight > bestWeight) {
        bestWeight = path.weight;
        representativeSummary = pathSummary;
      }
    }

    if (representativeSummary === null) {
      countReason(rejected, "no BTC paths supplied");
      continue;
    }

    ranked.push({
      rank: 0,
      input: validation.normalizedInput,
      summary: {
        ...representativeSummary,
        objectiveScore: weightedScore / pathWeightTotal,
      },
      pathScores,
    });
  }

  ranked.sort((a, b) => b.summary.objectiveScore - a.summary.objectiveScore);
  ranked.forEach((candidate, index) => {
    candidate.rank = index + 1;
  });

  if (ranked.length === 0) {
    throw new Error("No valid collateral optimizer candidate could be evaluated.");
  }

  return {
    bestInput: ranked[0]!.input,
    bestSummary: ranked[0]!.summary,
    rankedCandidates: ranked,
    rejectedCandidates: [...rejected.entries()].map(([reason, count]) => ({
      reason,
      count,
    })),
  };
}

export function createFlatBtcPath(
  btcSpotPriceUsd: number,
  timelineMonths: number,
): number[] {
  return Array.from({ length: timelineMonths + 1 }, () => btcSpotPriceUsd);
}

export function createBearBtcPath(
  btcSpotPriceUsd: number,
  timelineMonths: number,
): number[] {
  return Array.from({ length: timelineMonths + 1 }, (_, month) => {
    const progress = month / timelineMonths;
    return btcSpotPriceUsd * (1 - 0.45 * progress);
  });
}

export function createBullBtcPath(
  btcSpotPriceUsd: number,
  timelineMonths: number,
): number[] {
  return Array.from({ length: timelineMonths + 1 }, (_, month) => {
    const progress = month / timelineMonths;
    return btcSpotPriceUsd * (1 + 0.6 * progress);
  });
}

export function createRecoveryBtcPath(
  btcSpotPriceUsd: number,
  timelineMonths: number,
): number[] {
  const troughMonth = Math.max(1, Math.round(timelineMonths * 0.35));
  const troughPrice = btcSpotPriceUsd * 0.6;
  return Array.from({ length: timelineMonths + 1 }, (_, month) => {
    if (month <= troughMonth) {
      const progress = month / troughMonth;
      return btcSpotPriceUsd + (troughPrice - btcSpotPriceUsd) * progress;
    }
    const progress = (month - troughMonth) / Math.max(1, timelineMonths - troughMonth);
    return troughPrice + (btcSpotPriceUsd * 1.15 - troughPrice) * progress;
  });
}

export function createFlashCrashBtcPath(
  btcSpotPriceUsd: number,
  timelineMonths: number,
): number[] {
  return Array.from({ length: timelineMonths + 1 }, (_, month) => {
    if (month === 0) return btcSpotPriceUsd;
    if (month === 1) return btcSpotPriceUsd * 0.52;
    const recoveryProgress = (month - 1) / Math.max(1, timelineMonths - 1);
    return btcSpotPriceUsd * (0.52 + 0.53 * recoveryProgress);
  });
}

export function createSidewaysHighVolatilityBtcPath(
  btcSpotPriceUsd: number,
  timelineMonths: number,
): number[] {
  return Array.from({ length: timelineMonths + 1 }, (_, month) => {
    const swing =
      0.18 * Math.sin((month * Math.PI) / 2) -
      0.09 * Math.cos((month * Math.PI) / 3);
    return Math.max(btcSpotPriceUsd * 0.4, btcSpotPriceUsd * (1 + swing));
  });
}

export type CollateralStudioViewModel = {
  topSummary: {
    liquidationAvoided: boolean;
    liquidationMonth: number | null;
    modelledRoiPct: number;
    objectiveScore: number;
  };
  bucketCards: Array<{
    bucket: CollateralBucket;
    allocatedUsdc: number;
    notes: string[];
  }>;
  sellRows: SellStep[];
  buybackRows: BuybackStep[];
  timelineRows: CollateralTimelineRow[];
  optimizationCards: Array<{
    key: string;
    label: string;
    value: number;
  }>;
  chartSeries: {
    btcPriceUsd: Array<{ month: number; value: number }>;
    ltvPct: Array<{ month: number; value: number }>;
    liquidationPriceUsd: Array<{ month: number; value: number }>;
    debtUsdc: Array<{ month: number; value: number }>;
    workingReserveUsdc: Array<{ month: number; value: number }>;
    wbtcCollateralAmount: Array<{ month: number; value: number }>;
  };
  warnings: string[];
};

export function toCollateralStudioViewModel(
  summary: CollateralOptimizationSummary,
): CollateralStudioViewModel {
  const warnings: string[] = [];
  if (!summary.liquidationAvoided) {
    warnings.push(
      `Liquidation occurs in month ${summary.liquidationMonth ?? "unknown"} in the current model.`,
    );
  }
  if (summary.sellLadder.some((step) => !step.feasible)) {
    warnings.push("At least one sell rung is infeasible and cannot improve LTV.");
  }
  if (!summary.buybackLadder.some((step) => step.allowed)) {
    warnings.push("No buyback rung is currently allowed under the configured safety rules.");
  }

  return {
    topSummary: {
      liquidationAvoided: summary.liquidationAvoided,
      liquidationMonth: summary.liquidationMonth,
      modelledRoiPct: summary.modelledRoiPct,
      objectiveScore: summary.objectiveScore,
    },
    bucketCards: [
      {
        bucket: "MINING",
        allocatedUsdc: summary.base.miningAllocatedUsdc,
        notes: ["Mining yield stays inside the mining bucket."],
      },
      {
        bucket: "BTC_WBTC_RC20",
        allocatedUsdc: summary.base.btcAllocatedUsdc,
        notes: ["USDC buys BTC/wBTC, then wBTC is posted as collateral."],
      },
      {
        bucket: "USDC",
        allocatedUsdc: summary.base.reserveAllocatedUsdc,
        notes: ["Working USDC reserve includes allocated reserve plus borrowed USDC liquidity."],
      },
    ],
    sellRows: [...summary.sellLadder],
    buybackRows: [...summary.buybackLadder],
    timelineRows: [...summary.timeline],
    optimizationCards: [
      {
        key: "finalDebtUsdc",
        label: "Final debt",
        value: summary.finalDebtUsdc,
      },
      {
        key: "finalWorkingReserveUsdc",
        label: "Final working reserve",
        value: summary.finalWorkingReserveUsdc,
      },
      {
        key: "finalNetEquityUsdc",
        label: "Final net equity",
        value: summary.finalNetEquityUsdc,
      },
      {
        key: "maximumSafeBuybackBtc",
        label: "Maximum safe buyback BTC",
        value: summary.maximumSafeBuybackBtc,
      },
    ],
    chartSeries: {
      btcPriceUsd: summary.timeline.map((row) => ({
        month: row.month,
        value: row.btcPriceUsd,
      })),
      ltvPct: summary.timeline.map((row) => ({
        month: row.month,
        value: row.ltvPct,
      })),
      liquidationPriceUsd: summary.timeline.map((row) => ({
        month: row.month,
        value: row.liquidationPriceUsd,
      })),
      debtUsdc: summary.timeline.map((row) => ({
        month: row.month,
        value: row.debtUsdc,
      })),
      workingReserveUsdc: summary.timeline.map((row) => ({
        month: row.month,
        value: row.workingReserveUsdc,
      })),
      wbtcCollateralAmount: summary.timeline.map((row) => ({
        month: row.month,
        value: row.wbtcCollateralAmount,
      })),
    },
    warnings,
  };
}
