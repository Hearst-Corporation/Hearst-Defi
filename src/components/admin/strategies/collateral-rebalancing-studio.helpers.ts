import type { CollateralConfig, RebalancingRule } from "@/lib/scenario-runner";
import {
  LAB_BASE_PROJECTION,
  createBearBtcPath,
  createBullBtcPath,
  createFlashCrashBtcPath,
  createFlatBtcPath,
  createRecoveryBtcPath,
  createSidewaysHighVolatilityBtcPath,
  type CollateralOptimizerSearchConfig,
  type CollateralRebalancingInput,
  type CollateralValidationResult,
} from "@/lib/strategy-data-lab";

export type CollateralPathPresetId =
  | "flat"
  | "bear"
  | "flash_crash"
  | "recovery"
  | "bull"
  | "sideways_high_vol";

export interface CollateralPathPresetOption {
  value: CollateralPathPresetId;
  label: string;
  description: string;
}

export const COLLATERAL_PATH_PRESET_OPTIONS: ReadonlyArray<CollateralPathPresetOption> = [
  {
    value: "flat",
    label: "Flat",
    description: "BTC stays near spot across the full horizon.",
  },
  {
    value: "bear",
    label: "Bear",
    description: "Persistent drawdown with no strong recovery.",
  },
  {
    value: "flash_crash",
    label: "Flash crash",
    description: "Sharp early shock followed by partial recovery.",
  },
  {
    value: "recovery",
    label: "Recovery",
    description: "Drawdown first, then gradual recovery above spot.",
  },
  {
    value: "bull",
    label: "Bull",
    description: "Steady upside throughout the full horizon.",
  },
  {
    value: "sideways_high_vol",
    label: "Sideways vol",
    description: "High-volatility chop around spot with no clean trend.",
  },
] as const;

const DEFAULT_INVESTMENT_USDC = 1_000_000;
const DEFAULT_MINING_ALLOCATION_PCT = 0.45;
const DEFAULT_BTC_ALLOCATION_PCT = 0.45;
const DEFAULT_USDC_ALLOCATION_PCT = 0.1;
const DEFAULT_WBTC_YIELD_PCT = 0.02;
const DEFAULT_MINING_YIELD_PCT = 0.18;
const DEFAULT_BUY_SPACING_PCT = 0.1;
const DEFAULT_POST_SELL_TARGET_PCT = 0.25;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits: number = 4): number {
  return Number(value.toFixed(digits));
}

function findDeRiskRule(rules: readonly RebalancingRule[]): RebalancingRule | undefined {
  return rules.find(
    (rule) =>
      rule.enabled &&
      rule.type === "LIQUIDATE" &&
      rule.triggerMetric === "LTV" &&
      rule.action.side === "SELL_BTC",
  );
}

function findBuybackRule(rules: readonly RebalancingRule[]): RebalancingRule | undefined {
  return rules.find(
    (rule) =>
      rule.enabled &&
      rule.type === "REPURCHASE" &&
      rule.action.side === "BUY_BTC",
  );
}

export function resolveCollateralPathPreset(
  preset: CollateralPathPresetId,
  btcSpotPriceUsd: number,
  timelineMonths: number,
): number[] {
  if (preset === "flat") return createFlatBtcPath(btcSpotPriceUsd, timelineMonths);
  if (preset === "bear") return createBearBtcPath(btcSpotPriceUsd, timelineMonths);
  if (preset === "flash_crash") {
    return createFlashCrashBtcPath(btcSpotPriceUsd, timelineMonths);
  }
  if (preset === "bull") return createBullBtcPath(btcSpotPriceUsd, timelineMonths);
  if (preset === "sideways_high_vol") {
    return createSidewaysHighVolatilityBtcPath(btcSpotPriceUsd, timelineMonths);
  }
  return createRecoveryBtcPath(btcSpotPriceUsd, timelineMonths);
}

export function applyCollateralPathPreset(
  input: CollateralRebalancingInput,
  preset: CollateralPathPresetId,
): CollateralRebalancingInput {
  return {
    ...input,
    btcPath: resolveCollateralPathPreset(
      preset,
      input.btcSpotPriceUsd,
      input.timelineMonths,
    ),
  };
}

export function buildCollateralStudioInitialInput(
  collateral: CollateralConfig,
  rules: readonly RebalancingRule[],
  btcSpotPriceUsdOverride?: number,
): { input: CollateralRebalancingInput; preset: CollateralPathPresetId } {
  const deRiskRule = findDeRiskRule(rules);
  const buybackRule = findBuybackRule(rules);
  const btcSpotPriceUsd = Math.max(
    1,
    btcSpotPriceUsdOverride ?? LAB_BASE_PROJECTION.btcPriceStart,
  );
  const openingLtvPct =
    collateral.initialBtcCollateral > 0
      ? collateral.initialDebtUsdc /
        (collateral.initialBtcCollateral * btcSpotPriceUsd)
      : 0.3;

  const input: CollateralRebalancingInput = {
    investmentUsdc: DEFAULT_INVESTMENT_USDC,
    miningAllocationPct: DEFAULT_MINING_ALLOCATION_PCT,
    btcAllocationPct: DEFAULT_BTC_ALLOCATION_PCT,
    usdcAllocationPct: DEFAULT_USDC_ALLOCATION_PCT,
    btcSpotPriceUsd,
    openingLtvPct: round(clamp(openingLtvPct, 0.05, 0.9)),
    liquidationLtvPct: round(
      clamp(collateral.liquidationLtvBps / 10_000, 0.1, 0.99),
    ),
    deRiskTriggerLtvPct: round(
      clamp((deRiskRule?.value ?? 4500) / 10_000, 0.05, 0.98),
    ),
    postSellTargetLtvPct: DEFAULT_POST_SELL_TARGET_PCT,
    reRiskTriggerDistancePct: round(
      clamp((buybackRule?.value ?? 4500) / 10_000, 0.05, 0.95),
    ),
    maxLtvAfterBuyPct: round(
      clamp(
        (buybackRule?.action.maxLtvAfterActionBps ?? 5500) / 10_000,
        0.05,
        0.95,
      ),
    ),
    repayRatioPct: round(
      clamp((deRiskRule?.action.repayDebtRatioBps ?? 10_000) / 10_000, 0.05, 1),
    ),
    sellStepPctOfCollateral: round(
      clamp((deRiskRule?.action.sizingValue ?? 2700) / 10_000, 0.01, 0.95),
    ),
    sellMode: "AUTO_TO_TARGET",
    buyStepPctOfReserve: round(
      clamp((buybackRule?.action.sizingValue ?? 2500) / 10_000, 0.05, 1),
    ),
    buySpacingPct: DEFAULT_BUY_SPACING_PCT,
    minimumReserveUsdc: Math.max(0, collateral.minReserveUsdc),
    borrowAprPct: round(clamp(collateral.borrowAprBps / 10_000, 0, 1)),
    usdcReserveYieldPct: round(
      clamp(LAB_BASE_PROJECTION.stableYieldAprBps / 10_000, 0, 1),
    ),
    wbtcYieldPct: DEFAULT_WBTC_YIELD_PCT,
    miningYieldPct: DEFAULT_MINING_YIELD_PCT,
    electricityMonthlyUsdc: Math.max(0, collateral.electricityMonthlyCostUsdc),
    timelineMonths: LAB_BASE_PROJECTION.durationMonths,
  };

  const preset: CollateralPathPresetId = "recovery";
  return {
    input: applyCollateralPathPreset(input, preset),
    preset,
  };
}

export function buildCollateralOptimizerSearchConfig(
  input: CollateralRebalancingInput,
): CollateralOptimizerSearchConfig {
  const reserveFloorCandidate = Math.max(
    input.minimumReserveUsdc,
    input.electricityMonthlyUsdc * 6,
  );

  return {
    btcPaths: [
      {
        id: "flat",
        label: "Flat",
        prices: resolveCollateralPathPreset(
          "flat",
          input.btcSpotPriceUsd,
          input.timelineMonths,
        ),
        weight: 0.1,
      },
      {
        id: "bear",
        label: "Bear",
        prices: resolveCollateralPathPreset(
          "bear",
          input.btcSpotPriceUsd,
          input.timelineMonths,
        ),
        weight: 0.18,
      },
      {
        id: "flash-crash",
        label: "Flash crash",
        prices: resolveCollateralPathPreset(
          "flash_crash",
          input.btcSpotPriceUsd,
          input.timelineMonths,
        ),
        weight: 0.24,
      },
      {
        id: "recovery",
        label: "Recovery",
        prices: resolveCollateralPathPreset(
          "recovery",
          input.btcSpotPriceUsd,
          input.timelineMonths,
        ),
        weight: 0.22,
      },
      {
        id: "bull",
        label: "Bull",
        prices: resolveCollateralPathPreset(
          "bull",
          input.btcSpotPriceUsd,
          input.timelineMonths,
        ),
        weight: 0.14,
      },
      {
        id: "sideways",
        label: "Sideways high vol",
        prices: resolveCollateralPathPreset(
          "sideways_high_vol",
          input.btcSpotPriceUsd,
          input.timelineMonths,
        ),
        weight: 0.12,
      },
    ],
    candidateRanges: {
      deRiskTriggerLtvPct: [
        round(clamp(input.deRiskTriggerLtvPct - 0.05, 0.1, 0.9)),
        input.deRiskTriggerLtvPct,
        round(clamp(input.deRiskTriggerLtvPct + 0.05, 0.1, 0.9)),
      ],
      postSellTargetLtvPct: [
        round(clamp(input.postSellTargetLtvPct - 0.05, 0.05, 0.75)),
        input.postSellTargetLtvPct,
      ],
      reRiskTriggerDistancePct: [
        round(clamp(input.reRiskTriggerDistancePct - 0.1, 0.05, 0.9)),
        input.reRiskTriggerDistancePct,
      ],
      maxLtvAfterBuyPct: [
        round(clamp(input.maxLtvAfterBuyPct - 0.05, 0.1, 0.9)),
        input.maxLtvAfterBuyPct,
      ],
      repayRatioPct: [
        round(clamp(input.repayRatioPct - 0.15, 0.1, 1)),
        input.repayRatioPct,
        1,
      ],
      buyStepPctOfReserve: [
        round(clamp(input.buyStepPctOfReserve / 2, 0.05, 1)),
        input.buyStepPctOfReserve,
      ],
      buySpacingPct: [
        round(clamp(input.buySpacingPct / 2, 0.02, 0.5)),
        input.buySpacingPct,
      ],
      minimumReserveUsdc: [
        input.minimumReserveUsdc,
        reserveFloorCandidate,
      ],
    },
    objectiveWeights: {
      liquidationAvoidance: 10,
      maxDrawdown: 2,
      debtReduction: 2,
      reserveSafety: 3,
      btcRetention: 2,
      modelledRoi: 1,
    },
    maxCandidates: 192,
  };
}

export function flattenCollateralValidationMessages(
  validation: CollateralValidationResult,
): string[] {
  return [
    ...validation.errors.map((issue) => issue.message),
    ...validation.warnings.map((issue) => issue.message),
  ];
}
