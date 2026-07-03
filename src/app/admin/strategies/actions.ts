"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import { recordAdminAudit } from "@/lib/admin/audit";
import { prisma as db } from "@/lib/db";
import type { ProductStrategy } from "@/lib/product-strategies";
import type { CollateralConfig, RebalancingRule } from "@/lib/scenario-runner";

import type { Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// Input validation (Zod)
//
// saveStrategyWorkspace persists financial config — allocation bps, collateral
// LTV/APR bps, and rebalancing rules — straight into the prod DB inside a
// $transaction. Before ADR-parity this ran with ZERO shape validation: a caller
// could write a negative LTV, an allocation bps > 100%, or a NaN APR and it
// would land in `strategy_collateral_configs` / `strategy_scenarios` untouched.
//
// These schemas gate the whole payload BEFORE the transaction opens. A "use
// server" file may only export async functions, so the schemas stay MODULE-LOCAL
// (not exported). They validate SHAPE + BOUNDS only; deeper business rules
// (rule-set ordering, forbidden wording) are the scenario-runner validators'
// job and are unchanged here. The happy-path behaviour and public signature are
// untouched — valid input flows through exactly as before.
//
// Bounds rationale:
//  - Ratio bps (LTV, allocation, buffer, exposure) are 0..100_000 (0%..1000%).
//    LTV is typically ≤ 100% but we allow headroom up to 1000% rather than
//    hard-cap at 10_000 here — the tighter (0,100%] business bound on
//    liquidation LTV lives in `validateCollateralConfig`.
//  - APR bps can legitimately exceed 100% (e.g. 15000 = 150%), so its ceiling is
//    the same generous 0..100_000 integer envelope.
//  - Monetary/quantity fields (BTC collateral, USDC amounts) are finite,
//    non-negative reals — NOT bps — so they're `.nonnegative()` without the bps
//    integer/ceiling constraint.
// ---------------------------------------------------------------------------

/** A basis-points integer: whole number, 0..100_000 (0%..1000%). */
const bpsInt = z.number().int().min(0).max(100_000);

/** An optional bps integer (nullable targets in the schema). */
const bpsIntOptional = bpsInt.optional();

/** A finite, non-negative monetary/quantity real (USDC / BTC). */
const nonNegReal = z.number().finite().nonnegative();

const scenarioAllocationSchema = z.object({
  miningBps: bpsInt,
  btcBps: bpsInt,
  stableReserveBps: bpsInt,
  yieldOverlayBps: bpsInt,
});

const scenarioAssumptionsSchema = z.object({
  horizonMonths: z.union([z.literal(12), z.literal(24), z.literal(36)]),
  // Fractions (not bps): annualised vol and its multiplier. Bounded but real.
  btcAnnualVol: z.number().finite().min(0).max(100),
  volatilityMultiplier: z.number().finite().min(0).max(100),
  distributionTargetLowBps: bpsIntOptional,
  distributionTargetHighBps: bpsIntOptional,
  totalPerformanceLowBps: bpsIntOptional,
  totalPerformanceHighBps: bpsIntOptional,
  floorBps: bpsIntOptional,
});

const scenarioSchema = z.object({
  allocation: scenarioAllocationSchema,
  assumptions: scenarioAssumptionsSchema,
  narrativeBullets: z.array(z.string()),
});

const strategySchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  status: z.enum(["draft", "active", "archived"]),
  productFamily: z.enum([
    "btc_mining",
    "stable_income",
    "btc_upside",
    "defi_yield",
    "generic",
  ]),
  defaultRiskProfile: z.enum(["safe", "balanced", "opportunistic"]),
  defaultHorizonMonths: z.union([z.literal(12), z.literal(24), z.literal(36)]),
  defaultPriority: z.enum([
    "monthly_income",
    "capital_protection",
    "btc_upside",
    "total_return",
    "liquidity",
  ]),
  isFallback: z.boolean(),
  scenarios: z.object({
    safe: scenarioSchema,
    balanced: scenarioSchema,
    opportunistic: scenarioSchema,
  }),
});

const collateralSchema = z.object({
  collateralAsset: z.literal("BTC"),
  borrowAsset: z.literal("USDC"),
  initialBtcCollateral: nonNegReal,
  initialDebtUsdc: nonNegReal,
  initialReserveUsdc: nonNegReal.optional(),
  liquidationLtvBps: bpsInt,
  targetSafetyBufferBps: bpsInt,
  targetRiskLtvBps: bpsInt,
  borrowAprBps: bpsInt,
  electricityMonthlyCostUsdc: nonNegReal,
  minReserveUsdc: nonNegReal,
  maxBtcExposureBps: bpsInt,
});

const ruleSchema = z.object({
  id: z.string().min(1),
  scenario: z.enum(["safe", "balanced", "opportunistic"]),
  type: z.enum(["LIQUIDATE", "REPURCHASE"]),
  priority: z.number().int(),
  triggerMetric: z.enum([
    "BTC_PRICE",
    "LTV",
    "LIQUIDATION_DISTANCE",
    "PORTFOLIO_DRAWDOWN",
    "TARGET_ENTRY_PRICE",
    "MONTH",
  ]),
  operator: z.enum(["<=", ">=", "<", ">", "=="]),
  value: z.number().finite(),
  action: z.object({
    side: z.enum(["SELL_BTC", "BUY_BTC", "REPAY_DEBT", "HOLD"]),
    sizingMode: z.enum([
      "PERCENT_OF_BTC_COLLATERAL",
      "PERCENT_OF_USDC_RESERVE",
      "FIXED_BTC",
      "FIXED_USDC",
    ]),
    sizingValue: z.number().finite().nonnegative(),
    repayDebtRatioBps: bpsIntOptional,
    maxLtvAfterActionBps: bpsIntOptional,
  }),
  cooldownMonths: z.number().int().nonnegative().optional(),
  maxExecutions: z.number().int().nonnegative().optional(),
  enabled: z.boolean(),
});

const rulesSchema = z.array(ruleSchema);

export async function saveStrategyWorkspace(
  strategy: ProductStrategy,
  collateral: CollateralConfig,
  rules: RebalancingRule[],
) {
  const admin = await requireAdmin();

  // Validate SHAPE + BOUNDS before opening the DB transaction. Anything
  // malformed (out-of-range bps, negative money, bad enum) is rejected here so
  // it never reaches the prod financial tables. `.parse` throws a ZodError
  // (surfaced as an Error) — matching this file's existing throw-on-failure
  // convention. Valid input is passed through unchanged (`.parse` returns the
  // same values), so the happy path is untouched.
  strategySchema.parse(strategy);
  collateralSchema.parse(collateral);
  rulesSchema.parse(rules);

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
        narrativeBullets: data.narrativeBullets,
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

    // Replace the collateral config. Confirmed against prisma/schema.prisma:
    // `StrategyCollateralConfig` has only `@@index([strategyId])`, NOT a unique
    // constraint on strategyId — so `upsert({ where: { strategyId } })` is not
    // possible (upsert needs a unique selector). We therefore delete-then-create
    // to guarantee exactly one row per strategy. Both statements run inside the
    // same `tx`, so the swap is atomic — a reader never sees zero rows.
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

    // Replace the rule set. Same story as collateral: `StrategyRebalancingRule`
    // is keyed on its own `id`, with only `@@index([strategyId])` /
    // `@@index([strategyId, scenario])` — no unique on strategyId — so we delete
    // the strategy's rules and recreate the incoming set atomically within `tx`.
    await tx.strategyRebalancingRule.deleteMany({
      where: { strategyId: upsertedStrategy.id },
    });

    for (const rule of rules) {
      await tx.strategyRebalancingRule.create({
        data: {
          id: `${upsertedStrategy.id}::${rule.id}`,
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
