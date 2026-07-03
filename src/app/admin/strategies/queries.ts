import type { Prisma } from "@prisma/client";

import { prisma as db } from "@/lib/db";
import {
  PRODUCT_STRATEGIES,
  RISK_LABEL,
  type HorizonMonths,
  type Priority,
  type ProductFamily,
  type ProductStrategy,
  type ProductStrategyScenario,
  type RiskProfileKey,
  type StrategyStatus,
} from "@/lib/product-strategies";
import { LAB_BASE_COLLATERAL, LAB_BASE_RULES } from "@/lib/strategy-data-lab";
import type { CollateralConfig, RebalancingRule } from "@/lib/scenario-runner";

export interface StrategyWorkspaceData {
  strategy: ProductStrategy;
  collateral: CollateralConfig;
  rules: RebalancingRule[];
}

/**
 * On-read validation for raw Prisma `String`/`Int` columns.
 *
 * These columns are persisted as loose scalars (see `schema.prisma`), so a
 * partial save, a manual DB edit, or schema drift can leave a value that does
 * NOT belong to the app-level union. Rather than widen with an unchecked
 * `as` cast (which lies to the compiler and lets a bad value flow into the
 * pure engine), every field is parsed against an allow-list of the union's
 * members and coerced to a safe fallback — the same default the schema
 * declares (or the union's canonical neutral value) — when it doesn't match.
 */
const RISK_PROFILE_KEYS = ["safe", "balanced", "opportunistic"] as const;
const STRATEGY_STATUSES = ["draft", "active", "archived"] as const;
const PRODUCT_FAMILIES = [
  "btc_mining",
  "stable_income",
  "btc_upside",
  "defi_yield",
  "generic",
] as const;
const PRIORITIES = [
  "monthly_income",
  "capital_protection",
  "btc_upside",
  "total_return",
  "liquidity",
] as const;
const HORIZON_MONTHS = [12, 24, 36] as const;
const COLLATERAL_ASSETS = ["BTC"] as const;
const BORROW_ASSETS = ["USDC"] as const;
const RULE_TYPES = ["LIQUIDATE", "REPURCHASE"] as const;
const TRIGGER_METRICS = [
  "BTC_PRICE",
  "LTV",
  "LIQUIDATION_DISTANCE",
  "PORTFOLIO_DRAWDOWN",
  "TARGET_ENTRY_PRICE",
  "MONTH",
] as const;
const OPERATORS = ["<=", ">=", "<", ">", "=="] as const;
const ACTION_SIDES = ["SELL_BTC", "BUY_BTC", "REPAY_DEBT", "HOLD"] as const;
const SIZING_MODES = [
  "PERCENT_OF_BTC_COLLATERAL",
  "PERCENT_OF_USDC_RESERVE",
  "FIXED_BTC",
  "FIXED_USDC",
] as const;

/** Coerce a raw value to a member of `allowed`, or `fallback` when unknown. */
function coerce<const T extends readonly (string | number)[]>(
  raw: string | number,
  allowed: T,
  fallback: T[number],
): T[number] {
  return allowed.includes(raw) ? raw : fallback;
}

function toRiskProfileKey(raw: string): RiskProfileKey {
  return coerce(raw, RISK_PROFILE_KEYS, "balanced");
}

function toStrategyStatus(raw: string): StrategyStatus {
  return coerce(raw, STRATEGY_STATUSES, "draft");
}

function toProductFamily(raw: string): ProductFamily {
  return coerce(raw, PRODUCT_FAMILIES, "generic");
}

function toPriority(raw: string): Priority {
  return coerce(raw, PRIORITIES, "total_return");
}

function toHorizonMonths(raw: number): HorizonMonths {
  return coerce(raw, HORIZON_MONTHS, 24);
}

function toCollateralAsset(raw: string): CollateralConfig["collateralAsset"] {
  return coerce(raw, COLLATERAL_ASSETS, "BTC");
}

function toBorrowAsset(raw: string): CollateralConfig["borrowAsset"] {
  return coerce(raw, BORROW_ASSETS, "USDC");
}

function toRuleScenario(raw: string): RebalancingRule["scenario"] {
  return coerce(raw, RISK_PROFILE_KEYS, "balanced");
}

function toRuleType(raw: string): RebalancingRule["type"] {
  return coerce(raw, RULE_TYPES, "LIQUIDATE");
}

function toTriggerMetric(raw: string): RebalancingRule["triggerMetric"] {
  return coerce(raw, TRIGGER_METRICS, "LTV");
}

function toOperator(raw: string): RebalancingRule["operator"] {
  return coerce(raw, OPERATORS, ">=");
}

function toActionSide(raw: string): RebalancingRule["action"]["side"] {
  return coerce(raw, ACTION_SIDES, "HOLD");
}

function toSizingMode(raw: string): RebalancingRule["action"]["sizingMode"] {
  return coerce(raw, SIZING_MODES, "PERCENT_OF_BTC_COLLATERAL");
}

type StrategyConfigRow = Prisma.StrategyConfigGetPayload<{
  include: { scenarios: true; collateral: true; rules: true };
}>;

type ScenarioRow = StrategyConfigRow["scenarios"][number];

/**
 * narrativeBullets is a Json column that `saveStrategyWorkspace` writes as a
 * JSON-encoded string. Accept both encodings (string payload or real array)
 * and fall back to an empty list on anything malformed.
 */
function parseNarrativeBullets(raw: Prisma.JsonValue): string[] {
  let value: unknown = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function mapScenario(data: ScenarioRow): ProductStrategyScenario {
  const scenarioKey = toRiskProfileKey(data.scenario);
  return {
    label: RISK_LABEL[scenarioKey] ?? "Balanced",
    allocation: {
      miningBps: data.miningBps,
      btcBps: data.btcBps,
      stableReserveBps: data.stableReserveBps,
      yieldOverlayBps: data.yieldOverlayBps,
    },
    assumptions: {
      horizonMonths: toHorizonMonths(data.horizonMonths),
      btcAnnualVol: data.btcAnnualVolBps / 10000,
      volatilityMultiplier: data.volMultiplierBps / 10000,
      distributionTargetLowBps: data.distributionTargetLowBps ?? undefined,
      distributionTargetHighBps: data.distributionTargetHighBps ?? undefined,
      totalPerformanceLowBps: data.totalPerformanceLowBps ?? undefined,
      totalPerformanceHighBps: data.totalPerformanceHighBps ?? undefined,
      floorBps: data.floorBps ?? undefined,
    },
    constraints: {}, // Not persisted explicitly, can map here if added later
    narrativeBullets: parseNarrativeBullets(data.narrativeBullets),
  };
}

function mapConfig(c: StrategyConfigRow): StrategyWorkspaceData | null {
  // A well-formed config carries exactly the three scenarios. A partial row
  // (interrupted save, manual edit) must NOT crash the page — skip it and let
  // the caller fall back.
  const safeData = c.scenarios.find((s) => s.scenario === "safe");
  const balancedData = c.scenarios.find((s) => s.scenario === "balanced");
  const oppData = c.scenarios.find((s) => s.scenario === "opportunistic");
  if (!safeData || !balancedData || !oppData) return null;

  const strategy: ProductStrategy = {
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description,
    status: toStrategyStatus(c.status),
    productFamily: toProductFamily(c.productFamily),
    defaultRiskProfile: toRiskProfileKey(c.defaultRiskProfile),
    defaultHorizonMonths: toHorizonMonths(c.defaultHorizonMonths),
    defaultPriority: toPriority(c.defaultPriority),
    isFallback: c.isFallback,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    scenarios: {
      safe: mapScenario(safeData),
      balanced: mapScenario(balancedData),
      opportunistic: mapScenario(oppData),
    },
    selectionRules: {
      keywords: [],
      productFamilies: [],
      riskProfiles: [],
      priorities: [],
      minConfidence: 0,
    }, // Assuming not fully persisted or we use a default
    disclaimers: [],
  };

  const collateralRow = c.collateral[0];
  const collateral: CollateralConfig = collateralRow
    ? {
        collateralAsset: toCollateralAsset(collateralRow.collateralAsset),
        borrowAsset: toBorrowAsset(collateralRow.borrowAsset),
        initialBtcCollateral: Number(collateralRow.initialBtcCollateral),
        initialDebtUsdc: Number(collateralRow.initialDebtUsdc),
        initialReserveUsdc:
          collateralRow.initialReserveUsdc !== null
            ? Number(collateralRow.initialReserveUsdc)
            : undefined,
        liquidationLtvBps: collateralRow.liquidationLtvBps,
        targetSafetyBufferBps: collateralRow.targetSafetyBufferBps,
        targetRiskLtvBps: collateralRow.targetRiskLtvBps,
        borrowAprBps: collateralRow.borrowAprBps,
        electricityMonthlyCostUsdc: Number(collateralRow.electricityMonthlyCostUsdc),
        minReserveUsdc: Number(collateralRow.minReserveUsdc),
        maxBtcExposureBps: collateralRow.maxBtcExposureBps,
      }
    : LAB_BASE_COLLATERAL;

  const rules: RebalancingRule[] = c.rules.map((r) => ({
    id: r.id,
    scenario: toRuleScenario(r.scenario),
    type: toRuleType(r.type),
    priority: r.priority,
    triggerMetric: toTriggerMetric(r.triggerMetric),
    operator: toOperator(r.operator),
    value: Number(r.value),
    action: {
      side: toActionSide(r.actionSide),
      sizingMode: toSizingMode(r.sizingMode),
      sizingValue: Number(r.sizingValue),
      repayDebtRatioBps: r.repayDebtRatioBps ?? undefined,
      maxLtvAfterActionBps: r.maxLtvAfterActionBps ?? undefined,
    },
    cooldownMonths: r.cooldownMonths ?? undefined,
    maxExecutions: r.maxExecutions ?? undefined,
    enabled: r.enabled,
  }));

  return { strategy, collateral, rules };
}

export async function getStrategiesFromDb(): Promise<StrategyWorkspaceData[]> {
  // The strategy_configs tables were added to the Prisma schema on this branch
  // but may not exist yet in the target database (no migration applied). Treat a
  // missing table / any query failure the same as an empty DB: fall back to the
  // static PRODUCT_STRATEGIES below instead of throwing a 500.
  let configs: StrategyConfigRow[] = [];
  try {
    configs = await db.strategyConfig.findMany({
      include: {
        scenarios: true,
        collateral: true,
        rules: true,
      },
    });
  } catch {
    configs = [];
  }

  const mapped = configs
    .map(mapConfig)
    .filter((w): w is StrategyWorkspaceData => w !== null);

  if (mapped.length === 0) {
    // If DB is empty (or every row was malformed), return the static ones
    // combined with lab defaults.
    return PRODUCT_STRATEGIES.map((strategy) => ({
      strategy,
      collateral: LAB_BASE_COLLATERAL,
      rules: LAB_BASE_RULES.map((r) => ({
        ...r,
        scenario: strategy.defaultRiskProfile,
      })),
    }));
  }

  return mapped;
}
