import { prisma as db } from "@/lib/db";
import { PRODUCT_STRATEGIES } from "@/lib/product-strategies";
import { LAB_BASE_COLLATERAL, LAB_BASE_RULES } from "@/lib/strategy-data-lab";
import type { ProductStrategy, HorizonMonths, Priority, ProductFamily, RiskProfileKey, StrategyStatus } from "@/lib/product-strategies";
import type { CollateralConfig, RebalancingRule, Scenario, TriggerMetric, Operator, ActionSide, SizingMode } from "@/lib/scenario-runner";

export interface StrategyWorkspaceData {
  strategy: ProductStrategy;
  collateral: CollateralConfig;
  rules: RebalancingRule[];
}

export async function getStrategiesFromDb(): Promise<StrategyWorkspaceData[]> {
  // The strategy_configs tables were added to the Prisma schema on this branch
  // but may not exist yet in the target database (no migration applied). Treat a
  // missing table / any query failure the same as an empty DB: fall back to the
  // static PRODUCT_STRATEGIES below instead of throwing a 500.
  // Typed through a helper so `configs` carries the INCLUDED relations —
  // typing it from a bare findMany() loses `scenarios`/`collateral`/`rules`
  // and the filters below stop compiling.
  const findConfigs = () =>
    db.strategyConfig.findMany({
      include: {
        scenarios: true,
        collateral: true,
        rules: true,
      },
    });
  let configs: Awaited<ReturnType<typeof findConfigs>> = [];
  try {
    configs = await findConfigs();
  } catch {
    configs = [];
  }

  if (configs.length === 0) {
    // If DB is empty, return the static ones combined with lab defaults
    return PRODUCT_STRATEGIES.map((strategy) => ({
      strategy,
      collateral: LAB_BASE_COLLATERAL,
      rules: LAB_BASE_RULES.map(r => ({ ...r, scenario: strategy.defaultRiskProfile })), // Approximate
    }));
  }

  const REQUIRED_SCENARIOS = ["safe", "balanced", "opportunistic"] as const;

  return configs
    .filter((c) =>
      REQUIRED_SCENARIOS.every((sc) => c.scenarios.some((s) => s.scenario === sc)),
    )
    .map((c) => {
    // Map StrategyConfig back to ProductStrategy
    const safeData = c.scenarios.find((s) => s.scenario === "safe")!;
    const balancedData = c.scenarios.find((s) => s.scenario === "balanced")!;
    const oppData = c.scenarios.find((s) => s.scenario === "opportunistic")!;

    const mapScenario = (data: typeof safeData) => ({
      label: (data.scenario.charAt(0).toUpperCase() + data.scenario.slice(1)) as "Safe" | "Balanced" | "Opportunistic",
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
      constraints: {}, // Not persisted explicitly, can leave empty or map if added later
      narrativeBullets: (() => {
        const v = data.narrativeBullets;
        if (Array.isArray(v)) return v as string[];
        if (typeof v === "string") return JSON.parse(v) as string[];
        return [];
      })(),
    });

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
    const collateral: CollateralConfig = collateralRow ? {
      collateralAsset: collateralRow.collateralAsset as "BTC",
      borrowAsset: collateralRow.borrowAsset as "USDC",
      initialBtcCollateral: Number(collateralRow.initialBtcCollateral),
      initialDebtUsdc: Number(collateralRow.initialDebtUsdc),
      initialReserveUsdc: collateralRow.initialReserveUsdc ? Number(collateralRow.initialReserveUsdc) : undefined,
      liquidationLtvBps: collateralRow.liquidationLtvBps,
      targetSafetyBufferBps: collateralRow.targetSafetyBufferBps,
      targetRiskLtvBps: collateralRow.targetRiskLtvBps,
      borrowAprBps: collateralRow.borrowAprBps,
      electricityMonthlyCostUsdc: Number(collateralRow.electricityMonthlyCostUsdc),
      minReserveUsdc: Number(collateralRow.minReserveUsdc),
      maxBtcExposureBps: collateralRow.maxBtcExposureBps,
    } : LAB_BASE_COLLATERAL;

    const rules: RebalancingRule[] = c.rules.map((r) => ({
      id: r.id,
      scenario: r.scenario as Scenario,
      type: r.type as "LIQUIDATE" | "REPURCHASE",
      priority: r.priority,
      triggerMetric: r.triggerMetric as TriggerMetric,
      operator: r.operator as Operator,
      value: Number(r.value),
      action: {
        side: r.actionSide as ActionSide,
        sizingMode: r.sizingMode as SizingMode,
        sizingValue: Number(r.sizingValue),
        repayDebtRatioBps: r.repayDebtRatioBps ?? undefined,
        maxLtvAfterActionBps: r.maxLtvAfterActionBps ?? undefined,
      },
      cooldownMonths: r.cooldownMonths ?? undefined,
      maxExecutions: r.maxExecutions ?? undefined,
      enabled: r.enabled,
    }));

    return { strategy, collateral, rules };
  });
}
