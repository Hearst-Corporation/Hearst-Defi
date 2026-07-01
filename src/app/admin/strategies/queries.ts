import { prisma as db } from "@/lib/db";
import { PRODUCT_STRATEGIES } from "@/lib/product-strategies";
import { LAB_BASE_COLLATERAL, LAB_BASE_RULES } from "@/lib/strategy-data-lab";
import type { ProductStrategy } from "@/lib/product-strategies";
import type { CollateralConfig, RebalancingRule } from "@/lib/scenario-runner";

export interface StrategyWorkspaceData {
  strategy: ProductStrategy;
  collateral: CollateralConfig;
  rules: RebalancingRule[];
}

export async function getStrategiesFromDb(): Promise<StrategyWorkspaceData[]> {
  const configs = await db.strategyConfig.findMany({
    include: {
      scenarios: true,
      collateral: true,
      rules: true,
    },
  });

  if (configs.length === 0) {
    // If DB is empty, return the static ones combined with lab defaults
    return PRODUCT_STRATEGIES.map((strategy) => ({
      strategy,
      collateral: LAB_BASE_COLLATERAL,
      rules: LAB_BASE_RULES.map(r => ({ ...r, scenario: strategy.defaultRiskProfile })), // Approximate
    }));
  }

  return configs.map((c: any) => {
    // Map StrategyConfig back to ProductStrategy
    // We expect scenarios to have 'safe', 'balanced', 'opportunistic'
    const safeData = c.scenarios.find((s: any) => s.scenario === "safe")!;
    const balancedData = c.scenarios.find((s: any) => s.scenario === "balanced")!;
    const oppData = c.scenarios.find((s: any) => s.scenario === "opportunistic")!;

    const mapScenario = (data: typeof safeData) => ({
      label: data.scenario.charAt(0).toUpperCase() + data.scenario.slice(1) as any,
      allocation: {
        miningBps: data.miningBps,
        btcBps: data.btcBps,
        stableReserveBps: data.stableReserveBps,
        yieldOverlayBps: data.yieldOverlayBps,
      },
      assumptions: {
        horizonMonths: data.horizonMonths as any,
        btcAnnualVol: data.btcAnnualVolBps / 10000,
        volatilityMultiplier: data.volMultiplierBps / 10000,
        distributionTargetLowBps: data.distributionTargetLowBps ?? undefined,
        distributionTargetHighBps: data.distributionTargetHighBps ?? undefined,
        totalPerformanceLowBps: data.totalPerformanceLowBps ?? undefined,
        totalPerformanceHighBps: data.totalPerformanceHighBps ?? undefined,
        floorBps: data.floorBps ?? undefined,
      },
      constraints: {}, // Not persisted explicitly, can leave empty or map if added later
      narrativeBullets: JSON.parse(data.narrativeBullets as string) as string[],
    });

    const strategy: ProductStrategy = {
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      status: c.status as any,
      productFamily: c.productFamily as any,
      defaultRiskProfile: c.defaultRiskProfile as any,
      defaultHorizonMonths: c.defaultHorizonMonths as any,
      defaultPriority: c.defaultPriority as any,
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

    const rules: RebalancingRule[] = c.rules.map((r: any) => ({
      id: r.id,
      scenario: r.scenario as any,
      type: r.type as any,
      priority: r.priority,
      triggerMetric: r.triggerMetric as any,
      operator: r.operator as any,
      value: Number(r.value),
      action: {
        side: r.actionSide as any,
        sizingMode: r.sizingMode as any,
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
