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
  const scenarioKey = data.scenario as RiskProfileKey;
  return {
    label: RISK_LABEL[scenarioKey] ?? "Balanced",
    allocation: {
      miningBps: data.miningBps,
      btcBps: data.btcBps,
      stableReserveBps: data.stableReserveBps,
      yieldOverlayBps: data.yieldOverlayBps,
    },
    assumptions: {
      horizonMonths: data.horizonMonths as HorizonMonths,
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
    status: c.status as StrategyStatus,
    productFamily: c.productFamily as ProductFamily,
    defaultRiskProfile: c.defaultRiskProfile as RiskProfileKey,
    defaultHorizonMonths: c.defaultHorizonMonths as HorizonMonths,
    defaultPriority: c.defaultPriority as Priority,
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
        collateralAsset: collateralRow.collateralAsset as CollateralConfig["collateralAsset"],
        borrowAsset: collateralRow.borrowAsset as CollateralConfig["borrowAsset"],
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
    scenario: r.scenario as RebalancingRule["scenario"],
    type: r.type as RebalancingRule["type"],
    priority: r.priority,
    triggerMetric: r.triggerMetric as RebalancingRule["triggerMetric"],
    operator: r.operator as RebalancingRule["operator"],
    value: Number(r.value),
    action: {
      side: r.actionSide as RebalancingRule["action"]["side"],
      sizingMode: r.sizingMode as RebalancingRule["action"]["sizingMode"],
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
