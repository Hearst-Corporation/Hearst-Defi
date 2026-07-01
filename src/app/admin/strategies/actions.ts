"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { recordAdminAudit } from "@/lib/admin/audit";
import { prisma as db } from "@/lib/db";
import type { ProductStrategy } from "@/lib/product-strategies";
import type { CollateralConfig, RebalancingRule } from "@/lib/scenario-runner";

import type { Prisma } from "@prisma/client";

export async function saveStrategyWorkspace(
  strategy: ProductStrategy,
  collateral: CollateralConfig,
  rules: RebalancingRule[],
) {
  const admin = await requireAdmin();

  const scenarios = [
    { key: "safe", data: strategy.scenarios.safe },
    { key: "balanced", data: strategy.scenarios.balanced },
    { key: "opportunistic", data: strategy.scenarios.opportunistic },
  ] as const;

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const upsertedStrategy = await tx.strategyConfig.upsert({
      where: { slug: strategy.slug },
      update: {
        name: strategy.name,
        description: strategy.description,
        status: strategy.status,
        productFamily: strategy.productFamily,
        defaultRiskProfile: strategy.defaultRiskProfile,
        defaultHorizonMonths: strategy.defaultHorizonMonths,
        defaultPriority: strategy.defaultPriority,
        isFallback: strategy.isFallback,
        updatedAt: new Date(),
      },
      create: {
        id: strategy.id,
        slug: strategy.slug,
        name: strategy.name,
        description: strategy.description,
        status: strategy.status,
        productFamily: strategy.productFamily,
        defaultRiskProfile: strategy.defaultRiskProfile,
        defaultHorizonMonths: strategy.defaultHorizonMonths,
        defaultPriority: strategy.defaultPriority,
        isFallback: strategy.isFallback,
      },
    });

    for (const { key, data } of scenarios) {
      const scenarioData = {
        miningBps: data.allocation.miningBps,
        btcBps: data.allocation.btcBps,
        stableReserveBps: data.allocation.stableReserveBps,
        yieldOverlayBps: data.allocation.yieldOverlayBps,
        horizonMonths: data.assumptions.horizonMonths,
        btcAnnualVolBps: Math.round(data.assumptions.btcAnnualVol * 10000), // bps format
        volMultiplierBps: Math.round(data.assumptions.volatilityMultiplier * 10000),
        distributionTargetLowBps: data.assumptions.distributionTargetLowBps,
        distributionTargetHighBps: data.assumptions.distributionTargetHighBps,
        totalPerformanceLowBps: data.assumptions.totalPerformanceLowBps,
        totalPerformanceHighBps: data.assumptions.totalPerformanceHighBps,
        floorBps: data.assumptions.floorBps,
        narrativeBullets: JSON.stringify(data.narrativeBullets),
      };

      await tx.strategyScenario.upsert({
        where: { strategyId_scenario: { strategyId: upsertedStrategy.id, scenario: key } },
        update: scenarioData,
        create: {
          ...scenarioData,
          strategyId: upsertedStrategy.id,
          scenario: key,
        },
      });
    }

    // Upsert collateral config. Since there's one per strategy, we can just delete and recreate or update by strategyId.
    // However there's no unique constraint on strategyId alone in the schema. Wait, let's check schema.prisma
    await tx.strategyCollateralConfig.deleteMany({
      where: { strategyId: upsertedStrategy.id },
    });

    await tx.strategyCollateralConfig.create({
      data: {
        strategyId: upsertedStrategy.id,
        collateralAsset: collateral.collateralAsset,
        borrowAsset: collateral.borrowAsset,
        initialBtcCollateral: collateral.initialBtcCollateral,
        initialDebtUsdc: collateral.initialDebtUsdc,
        initialReserveUsdc: collateral.initialReserveUsdc,
        liquidationLtvBps: collateral.liquidationLtvBps,
        targetSafetyBufferBps: collateral.targetSafetyBufferBps,
        targetRiskLtvBps: collateral.targetRiskLtvBps,
        borrowAprBps: collateral.borrowAprBps,
        electricityMonthlyCostUsdc: collateral.electricityMonthlyCostUsdc,
        minReserveUsdc: collateral.minReserveUsdc,
        maxBtcExposureBps: collateral.maxBtcExposureBps,
      },
    });

    // Upsert rules
    await tx.strategyRebalancingRule.deleteMany({
      where: { strategyId: upsertedStrategy.id },
    });

    for (const rule of rules) {
      await tx.strategyRebalancingRule.create({
        data: {
          id: rule.id,
          strategyId: upsertedStrategy.id,
          scenario: rule.scenario,
          type: rule.type,
          priority: rule.priority,
          triggerMetric: rule.triggerMetric,
          operator: rule.operator,
          value: rule.value,
          actionSide: rule.action.side,
          sizingMode: rule.action.sizingMode,
          sizingValue: rule.action.sizingValue,
          repayDebtRatioBps: rule.action.repayDebtRatioBps,
          maxLtvAfterActionBps: rule.action.maxLtvAfterActionBps,
          cooldownMonths: rule.cooldownMonths,
          maxExecutions: rule.maxExecutions,
          enabled: rule.enabled,
        },
      });
    }

    await recordAdminAudit(
      {
        actorWallet: admin.userId,
        action: "strategy.upsert",
        entityType: "StrategyConfig",
        entityId: upsertedStrategy.id,
        after: { slug: strategy.slug },
      },
      tx
    );
  });

  revalidatePath("/admin/strategies");
  revalidatePath(`/admin/strategies/${strategy.slug}`);
}

export async function archiveStrategy(id: string) {
  const admin = await requireAdmin();

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.strategyConfig.update({
      where: { id },
      data: { status: "archived" },
    });
    await recordAdminAudit(
      {
        actorWallet: admin.userId,
        action: "strategy.archive",
        entityType: "StrategyConfig",
        entityId: id,
      },
      tx
    );
  });

  revalidatePath("/admin/strategies");
}

export async function publishStrategy(id: string) {
  const admin = await requireAdmin();

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.strategyConfig.update({
      where: { id },
      data: { status: "active" },
    });
    await recordAdminAudit(
      {
        actorWallet: admin.userId,
        action: "strategy.publish",
        entityType: "StrategyConfig",
        entityId: id,
      },
      tx
    );
  });

  revalidatePath("/admin/strategies");
}
