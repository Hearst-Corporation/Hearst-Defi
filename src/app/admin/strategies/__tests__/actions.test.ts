/**
 * Unit tests for src/app/admin/strategies/actions.ts
 *
 * saveStrategyWorkspace persists financial config (allocation bps, collateral
 * LTV/APR bps, rebalancing rules) into the prod DB inside a $transaction. These
 * tests pin the P0 behaviours:
 *   - Zod SHAPE + BOUNDS validation runs BEFORE the transaction; a malformed
 *     input (out-of-range bps) is REJECTED and never touches the DB.
 *   - bps conversions round-trip (annualised vol / multiplier fraction → bps).
 *   - all three scenarios (safe / balanced / opportunistic) are upserted.
 *   - collateral + rules are replaced atomically (deleteMany then create) inside
 *     the SAME tx.
 *   - an admin audit row is recorded inside the tx.
 *   - archiveStrategy / publishStrategy flip status + record audit.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (declared before module import) ────────────────────────────────────

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    strategyConfig: {
      upsert: vi.fn(),
      update: vi.fn(),
    },
    strategyScenario: {
      upsert: vi.fn(),
    },
    strategyCollateralConfig: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    strategyRebalancingRule: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    // Pass the mocked prisma proxy into the callback so every tx.* call routes
    // back to the spies above.
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const { prisma: p } = await import("@/lib/db");
      return fn(p);
    }),
  },
}));

vi.mock("@/lib/admin/audit", () => ({
  recordAdminAudit: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { recordAdminAudit } from "@/lib/admin/audit";
import type { ProductStrategy } from "@/lib/product-strategies";
import type { CollateralConfig, RebalancingRule } from "@/lib/scenario-runner";
import {
  saveStrategyWorkspace,
  archiveStrategy,
  publishStrategy,
} from "../actions";

// ── Fixtures ───────────────────────────────────────────────────────────────────

const ADMIN = { userId: "admin_strat" } as const;

function buildScenario(
  label: "Safe" | "Balanced" | "Opportunistic",
): ProductStrategy["scenarios"]["safe"] {
  return {
    label,
    allocation: {
      miningBps: 4500,
      btcBps: 3000,
      stableReserveBps: 1500,
      yieldOverlayBps: 1000,
    },
    assumptions: {
      horizonMonths: 24,
      btcAnnualVol: 0.65,
      volatilityMultiplier: 1.2,
      distributionTargetLowBps: 800,
      distributionTargetHighBps: 1500,
      totalPerformanceLowBps: 900,
      totalPerformanceHighBps: 1800,
      floorBps: 500,
    },
    constraints: {},
    narrativeBullets: [`${label} bullet one`, `${label} bullet two`],
  };
}

function buildStrategy(overrides: Partial<ProductStrategy> = {}): ProductStrategy {
  return {
    id: "strat_id_1",
    slug: "house-yield",
    name: "House Yield",
    description: "Mining-backed structured yield.",
    status: "draft",
    productFamily: "btc_mining",
    defaultRiskProfile: "balanced",
    defaultHorizonMonths: 24,
    defaultPriority: "monthly_income",
    selectionRules: {
      keywords: ["yield"],
      productFamilies: ["btc_mining"],
      riskProfiles: ["balanced"],
      priorities: ["monthly_income"],
      minConfidence: 0.4,
    },
    scenarios: {
      safe: buildScenario("Safe"),
      balanced: buildScenario("Balanced"),
      opportunistic: buildScenario("Opportunistic"),
    },
    disclaimers: ["Not guaranteed."],
    isFallback: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

function buildCollateral(
  overrides: Partial<CollateralConfig> = {},
): CollateralConfig {
  return {
    collateralAsset: "BTC",
    borrowAsset: "USDC",
    initialBtcCollateral: 10,
    initialDebtUsdc: 250_000,
    initialReserveUsdc: 50_000,
    liquidationLtvBps: 8000,
    targetSafetyBufferBps: 1500,
    targetRiskLtvBps: 5000,
    borrowAprBps: 1200,
    electricityMonthlyCostUsdc: 4000,
    minReserveUsdc: 20_000,
    maxBtcExposureBps: 6000,
    ...overrides,
  };
}

function buildRule(overrides: Partial<RebalancingRule> = {}): RebalancingRule {
  return {
    id: "rule_liq_1",
    scenario: "balanced",
    type: "LIQUIDATE",
    priority: 100,
    triggerMetric: "LTV",
    operator: ">=",
    value: 7000,
    action: {
      side: "SELL_BTC",
      sizingMode: "PERCENT_OF_BTC_COLLATERAL",
      sizingValue: 2500,
      repayDebtRatioBps: 10_000,
    },
    cooldownMonths: 1,
    maxExecutions: 6,
    enabled: true,
    ...overrides,
  };
}

// ── saveStrategyWorkspace ──────────────────────────────────────────────────────

describe("saveStrategyWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue(ADMIN);
    vi.mocked(prisma.strategyConfig.upsert).mockResolvedValue({
      id: "strat_id_1",
    } as never);
    vi.mocked(prisma.strategyScenario.upsert).mockResolvedValue({} as never);
    vi.mocked(prisma.strategyCollateralConfig.deleteMany).mockResolvedValue({
      count: 1,
    } as never);
    vi.mocked(prisma.strategyCollateralConfig.create).mockResolvedValue(
      {} as never,
    );
    vi.mocked(prisma.strategyRebalancingRule.deleteMany).mockResolvedValue({
      count: 0,
    } as never);
    vi.mocked(prisma.strategyRebalancingRule.create).mockResolvedValue(
      {} as never,
    );
    vi.mocked(recordAdminAudit).mockResolvedValue(undefined as never);
  });

  it("upserts the strategy config and all THREE scenarios", async () => {
    await saveStrategyWorkspace(buildStrategy(), buildCollateral(), [
      buildRule(),
    ]);

    expect(prisma.strategyConfig.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.strategyConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: "house-yield" } }),
    );

    // safe / balanced / opportunistic → 3 scenario upserts.
    expect(prisma.strategyScenario.upsert).toHaveBeenCalledTimes(3);
    const scenarioKeys = vi
      .mocked(prisma.strategyScenario.upsert)
      .mock.calls.map((c) => {
        const arg = c[0] as {
          where: { strategyId_scenario: { scenario: string } };
        };
        return arg.where.strategyId_scenario.scenario;
      });
    expect(new Set(scenarioKeys)).toEqual(
      new Set(["safe", "balanced", "opportunistic"]),
    );
  });

  it("round-trips the vol / multiplier fractions into bps on the scenario upsert", async () => {
    await saveStrategyWorkspace(buildStrategy(), buildCollateral(), [
      buildRule(),
    ]);

    const firstCall = vi.mocked(prisma.strategyScenario.upsert).mock
      .calls[0]?.[0] as {
      create: { btcAnnualVolBps: number; volMultiplierBps: number };
    };

    // btcAnnualVol 0.65 → 6500 bps ; volatilityMultiplier 1.2 → 12000 bps.
    expect(firstCall.create.btcAnnualVolBps).toBe(6500);
    expect(firstCall.create.volMultiplierBps).toBe(12_000);
    // And the round-trip back is lossless at this precision.
    expect(firstCall.create.btcAnnualVolBps / 10_000).toBeCloseTo(0.65, 10);
    expect(firstCall.create.volMultiplierBps / 10_000).toBeCloseTo(1.2, 10);
  });

  it("replaces collateral atomically (deleteMany THEN create) with the incoming bps", async () => {
    await saveStrategyWorkspace(buildStrategy(), buildCollateral(), [
      buildRule(),
    ]);

    expect(prisma.strategyCollateralConfig.deleteMany).toHaveBeenCalledWith({
      where: { strategyId: "strat_id_1" },
    });
    expect(prisma.strategyCollateralConfig.create).toHaveBeenCalledTimes(1);
    expect(prisma.strategyCollateralConfig.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        strategyId: "strat_id_1",
        liquidationLtvBps: 8000,
        targetRiskLtvBps: 5000,
        borrowAprBps: 1200,
      }),
    });

    // delete ran before create.
    const delOrder = vi.mocked(prisma.strategyCollateralConfig.deleteMany).mock
      .invocationCallOrder[0]!;
    const createOrder = vi.mocked(prisma.strategyCollateralConfig.create).mock
      .invocationCallOrder[0]!;
    expect(delOrder).toBeLessThan(createOrder);
  });

  it("replaces the rule set atomically and prefixes the rule id with the strategy id", async () => {
    await saveStrategyWorkspace(buildStrategy(), buildCollateral(), [
      buildRule({ id: "rule_a" }),
      buildRule({ id: "rule_b", type: "REPURCHASE", priority: 10, action: {
        side: "BUY_BTC",
        sizingMode: "PERCENT_OF_USDC_RESERVE",
        sizingValue: 5000,
        maxLtvAfterActionBps: 6000,
      } }),
    ]);

    expect(prisma.strategyRebalancingRule.deleteMany).toHaveBeenCalledWith({
      where: { strategyId: "strat_id_1" },
    });
    expect(prisma.strategyRebalancingRule.create).toHaveBeenCalledTimes(2);
    const ids = vi
      .mocked(prisma.strategyRebalancingRule.create)
      .mock.calls.map((c) => (c[0] as { data: { id: string } }).data.id);
    expect(ids).toEqual(["strat_id_1::rule_a", "strat_id_1::rule_b"]);
  });

  it("records an admin audit inside the transaction", async () => {
    await saveStrategyWorkspace(buildStrategy(), buildCollateral(), [
      buildRule(),
    ]);

    expect(recordAdminAudit).toHaveBeenCalledTimes(1);
    expect(recordAdminAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorWallet: ADMIN.userId,
        action: "strategy.upsert",
        entityType: "StrategyConfig",
        entityId: "strat_id_1",
      }),
      expect.anything(),
    );
  });

  // ── REJECTION of malformed input (bps out of bounds) ────────────────────────

  it("REJECTS an allocation bps above the ceiling and never opens the transaction", async () => {
    const bad = buildStrategy();
    bad.scenarios.safe.allocation.miningBps = 100_001; // > 100_000 ceiling

    await expect(
      saveStrategyWorkspace(bad, buildCollateral(), [buildRule()]),
    ).rejects.toThrow();

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.strategyConfig.upsert).not.toHaveBeenCalled();
    expect(recordAdminAudit).not.toHaveBeenCalled();
  });

  it("REJECTS a negative collateral LTV bps before any DB write", async () => {
    await expect(
      saveStrategyWorkspace(
        buildStrategy(),
        buildCollateral({ liquidationLtvBps: -1 }),
        [buildRule()],
      ),
    ).rejects.toThrow();

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.strategyCollateralConfig.create).not.toHaveBeenCalled();
  });

  it("REJECTS a non-integer bps (fractional) collateral APR", async () => {
    await expect(
      saveStrategyWorkspace(
        buildStrategy(),
        buildCollateral({ borrowAprBps: 1200.5 }),
        [buildRule()],
      ),
    ).rejects.toThrow();

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("REJECTS a malformed rule (out-of-range repayDebtRatioBps) before any DB write", async () => {
    await expect(
      saveStrategyWorkspace(buildStrategy(), buildCollateral(), [
        buildRule({
          action: {
            side: "SELL_BTC",
            sizingMode: "PERCENT_OF_BTC_COLLATERAL",
            sizingValue: 2500,
            repayDebtRatioBps: 200_000, // > 100_000 ceiling
          },
        }),
      ]),
    ).rejects.toThrow();

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.strategyRebalancingRule.create).not.toHaveBeenCalled();
  });
});

// ── archiveStrategy ─────────────────────────────────────────────────────────

describe("archiveStrategy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue(ADMIN);
    vi.mocked(prisma.strategyConfig.update).mockResolvedValue({} as never);
    vi.mocked(recordAdminAudit).mockResolvedValue(undefined as never);
  });

  it("sets status=archived and records the audit inside the tx", async () => {
    await archiveStrategy("strat_id_1");

    expect(prisma.strategyConfig.update).toHaveBeenCalledWith({
      where: { id: "strat_id_1" },
      data: { status: "archived" },
    });
    expect(recordAdminAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "strategy.archive",
        entityId: "strat_id_1",
      }),
      expect.anything(),
    );
  });
});

// ── publishStrategy ─────────────────────────────────────────────────────────

describe("publishStrategy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue(ADMIN);
    vi.mocked(prisma.strategyConfig.update).mockResolvedValue({} as never);
    vi.mocked(recordAdminAudit).mockResolvedValue(undefined as never);
  });

  it("sets status=active and records the audit inside the tx", async () => {
    await publishStrategy("strat_id_1");

    expect(prisma.strategyConfig.update).toHaveBeenCalledWith({
      where: { id: "strat_id_1" },
      data: { status: "active" },
    });
    expect(recordAdminAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "strategy.publish",
        entityId: "strat_id_1",
      }),
      expect.anything(),
    );
  });
});
