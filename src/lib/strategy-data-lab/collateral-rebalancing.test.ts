import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import type { CollateralRebalancingInput } from "./collateral-rebalancing";
import {
  COLLATERAL_BUCKETS,
  buildBasePosition,
  buildBuybackLadder,
  buildSellLadder,
  createBearBtcPath,
  createBullBtcPath,
  createFlashCrashBtcPath,
  createFlatBtcPath,
  createRecoveryBtcPath,
  createSidewaysHighVolatilityBtcPath,
  optimizeCollateralStrategy,
  simulateCollateralTimeline,
  summarizeCollateralOptimization,
  toCollateralStudioViewModel,
  validateCollateralInput,
} from "./collateral-rebalancing";

function makeValidInput(
  overrides: Partial<CollateralRebalancingInput> = {},
): CollateralRebalancingInput {
  return {
    investmentUsdc: 1_000_000,
    miningAllocationPct: 0.45,
    btcAllocationPct: 0.45,
    usdcAllocationPct: 0.1,
    btcSpotPriceUsd: 60_000,
    openingLtvPct: 0.3,
    liquidationLtvPct: 0.8,
    deRiskTriggerLtvPct: 0.45,
    postSellTargetLtvPct: 0.25,
    reRiskTriggerDistancePct: 0.45,
    maxLtvAfterBuyPct: 0.55,
    repayRatioPct: 1,
    sellStepPctOfCollateral: 0.1,
    sellMode: "AUTO_TO_TARGET",
    buyStepPctOfReserve: 0.25,
    buySpacingPct: 0.1,
    minimumReserveUsdc: 40_000,
    borrowAprPct: 0.06,
    usdcReserveYieldPct: 0.05,
    wbtcYieldPct: 0.02,
    miningYieldPct: 0.18,
    electricityMonthlyUsdc: 3_000,
    timelineMonths: 12,
    ...overrides,
  };
}

function makeQuietInput(
  overrides: Partial<CollateralRebalancingInput> = {},
): CollateralRebalancingInput {
  return makeValidInput({
    timelineMonths: 1,
    deRiskTriggerLtvPct: 0.95,
    liquidationLtvPct: 0.99,
    maxLtvAfterBuyPct: 0.98,
    reRiskTriggerDistancePct: 0.2,
    btcPath: createFlatBtcPath(60_000, 1),
    ...overrides,
  });
}

describe("collateral rebalancing base model", () => {
  it("investmentUsdc is the root input and exactly 3 buckets exist", () => {
    const base = buildBasePosition(makeValidInput());
    expect(COLLATERAL_BUCKETS).toEqual([
      "MINING",
      "BTC_WBTC_RC20",
      "USDC",
    ]);
    expect(base.miningAllocatedUsdc).toBe(450_000);
    expect(base.btcAllocatedUsdc).toBe(450_000);
    expect(base.reserveAllocatedUsdc).toBe(100_000);
  });

  it("yield remains an attribute, not a bucket", () => {
    const summary = summarizeCollateralOptimization(makeValidInput());
    const viewModel = toCollateralStudioViewModel(summary);
    expect(viewModel.bucketCards).toHaveLength(3);
    expect(viewModel.bucketCards.map((card) => card.bucket)).toEqual(
      COLLATERAL_BUCKETS,
    );
    expect(viewModel.bucketCards.some((card) => card.bucket.includes("YIELD"))).toBe(
      false,
    );
  });

  it("allocations must sum to 100% and invalid sums return a validation error", () => {
    const valid = validateCollateralInput(
      makeValidInput({
        miningAllocationPct: 45,
        btcAllocationPct: 45,
        usdcAllocationPct: 10,
      }),
    );
    expect(valid.isValid).toBe(true);
    expect(valid.normalizedInput.miningAllocationPct).toBeCloseTo(0.45, 8);

    const invalid = validateCollateralInput(
      makeValidInput({
        miningAllocationPct: 0.4,
        btcAllocationPct: 0.4,
        usdcAllocationPct: 0.1,
      }),
    );
    expect(invalid.isValid).toBe(false);
    expect(invalid.errors.some((issue) => issue.code === "allocations_sum")).toBe(
      true,
    );
  });

  it("reserveAllocatedUsdc + debtUsdc = workingReserveUsdc and debt is excluded from invested capital", () => {
    const base = buildBasePosition(makeValidInput());
    expect(base.reserveAllocatedUsdc + base.debtUsdc).toBeCloseTo(
      base.workingReserveUsdc,
      8,
    );
    expect(
      base.miningAllocatedUsdc +
        base.btcAllocatedUsdc +
        base.reserveAllocatedUsdc,
    ).toBeCloseTo(base.investmentUsdc, 8);
  });

  it("wbtcCollateralAmount derives from the BTC-funded USDC bucket", () => {
    const base = buildBasePosition(makeValidInput());
    expect(base.wbtcCollateralAmount).toBeCloseTo(450_000 / 60_000, 8);
  });

  it("currentLtvPct equals openingLtvPct at inception and liquidationPriceUsd is correct", () => {
    const input = makeValidInput();
    const base = buildBasePosition(input);
    expect(base.currentLtvPct).toBeCloseTo(input.openingLtvPct, 8);
    expect(base.liquidationPriceUsd).toBeCloseTo(
      base.debtUsdc / (base.wbtcCollateralAmount * input.liquidationLtvPct),
      8,
    );
  });
});

describe("sell ladder", () => {
  it("a feasible sell step reduces LTV, repays debt, and moves liquidation price lower", () => {
    const input = makeValidInput();
    const base = buildBasePosition(input);
    const ladder = buildSellLadder(input, base);
    const first = ladder[0]!;

    expect(first.feasible).toBe(true);
    expect(first.ltvAfterPct).toBeLessThan(first.ltvBeforePct);
    expect(first.debtRepaidUsdc).toBeCloseTo(first.usdcReceived, 8);
    expect(first.debtAfterUsdc).toBeCloseTo(base.debtUsdc - first.debtRepaidUsdc, 8);
    expect(first.liquidationPriceAfterUsd).toBeLessThan(base.liquidationPriceUsd);
  });

  it("an infeasible sell is blocked when repayRatioPct is below the trigger LTV", () => {
    const input = makeValidInput({ repayRatioPct: 0.4 });
    const base = buildBasePosition(input);
    const ladder = buildSellLadder(input, base);
    expect(ladder[0]!.feasible).toBe(false);
    expect(ladder[0]!.reason).toMatch(/Infeasible sell/i);
  });
});

describe("buyback ladder", () => {
  it("buyback respects the reserve floor and the max LTV cap", () => {
    const input = makeValidInput();
    const base = buildBasePosition(input);
    const sellLadder = buildSellLadder(input, base);
    const buyback = buildBuybackLadder(input, base, sellLadder);
    const firstAllowed = buyback.find((step) => step.allowed)!;

    expect(firstAllowed.workingReserveAfterUsdc).toBeGreaterThanOrEqual(
      input.minimumReserveUsdc,
    );
    expect(firstAllowed.reserveFloorOk).toBe(true);
    expect(firstAllowed.maxLtvOk).toBe(true);
    expect(firstAllowed.ltvAfterPct).toBeLessThanOrEqual(input.maxLtvAfterBuyPct);
  });

  it("buyback respects the distance trigger and can be blocked by it", () => {
    const input = makeValidInput({ reRiskTriggerDistancePct: 0.6 });
    const base = buildBasePosition(input);
    const sellLadder = buildSellLadder(input, base);
    const buyback = buildBuybackLadder(input, base, sellLadder);
    expect(buyback[0]!.distanceOk).toBe(false);
    expect(buyback[0]!.allowed).toBe(false);
  });

  it("distanceSafePriceUsd and buyback execution trigger remain distinct notions", () => {
    const input = makeValidInput();
    const base = buildBasePosition(input);
    const sellLadder = buildSellLadder(input, base);
    const buyback = buildBuybackLadder(input, base, sellLadder);
    const lastFeasibleSell = sellLadder.filter((step) => step.feasible).at(-1)!;
    const distanceSafePriceUsd =
      lastFeasibleSell.debtAfterUsdc /
      (lastFeasibleSell.wbtcCollateralAfter *
        (input.liquidationLtvPct - input.reRiskTriggerDistancePct));
    expect(distanceSafePriceUsd).not.toBeCloseTo(buyback[0]!.triggerPriceUsd, 6);
  });
});

describe("deterministic BTC paths", () => {
  it("creates the required deterministic helper paths", () => {
    expect(createFlatBtcPath(60_000, 6)).toHaveLength(7);
    expect(createBearBtcPath(60_000, 6)[6]).toBeLessThan(60_000);
    expect(createBullBtcPath(60_000, 6)[6]).toBeGreaterThan(60_000);
    expect(createRecoveryBtcPath(60_000, 6)[6]).toBeGreaterThan(
      createRecoveryBtcPath(60_000, 6)[2]!,
    );
    expect(createFlashCrashBtcPath(60_000, 6)[1]).toBeLessThan(40_000);
    expect(
      createSidewaysHighVolatilityBtcPath(60_000, 6).some((price, index, arr) =>
        index > 0 ? price !== arr[index - 1] : false,
      ),
    ).toBe(true);
  });
});

describe("timeline simulation", () => {
  it("applies monthly borrow APR, reserve yield, wBTC yield, and mining yield minus electricity", () => {
    const input = makeQuietInput();
    const base = buildBasePosition(input);
    const timeline = simulateCollateralTimeline(
      input,
      base,
      buildSellLadder(input, base),
      buildBuybackLadder(input, base, []),
    );
    const month1 = timeline[1]!;
    const expectedDebt = base.debtUsdc * (1 + input.borrowAprPct / 12);
    const expectedReserve =
      base.workingReserveUsdc * (1 + input.usdcReserveYieldPct / 12) +
      base.miningAllocatedUsdc * (input.miningYieldPct / 12) -
      input.electricityMonthlyUsdc;
    const expectedCollateral =
      base.wbtcCollateralAmount * (1 + input.wbtcYieldPct / 12);

    expect(month1.debtUsdc).toBeCloseTo(expectedDebt, 6);
    expect(month1.workingReserveUsdc).toBeCloseTo(expectedReserve, 6);
    expect(month1.wbtcCollateralAmount).toBeCloseTo(expectedCollateral, 6);
    expect(month1.eventType).toBe("NONE");
  });

  it("emits a SELL event when the de-risk trigger is breached", () => {
    const path = createFlashCrashBtcPath(60_000, 4);
    const input = makeValidInput({
      timelineMonths: 4,
      btcPath: path,
    });
    const summary = summarizeCollateralOptimization(input);
    expect(summary.timeline.some((row) => row.eventType === "SELL")).toBe(true);

    const sellRow = summary.timeline.find((row) => row.eventType === "SELL")!;
    expect(sellRow.event?.btcSold).toBeGreaterThan(0);
  });

  it("emits a BUYBACK event only when all buyback rules are satisfied", () => {
    const path = createRecoveryBtcPath(60_000, 8);
    const input = makeValidInput({
      timelineMonths: 8,
      btcPath: path,
    });
    const summary = summarizeCollateralOptimization(input);
    const buyRow = summary.timeline.find((row) => row.eventType === "BUYBACK");

    expect(buyRow).toBeDefined();
    expect(
      summary.timeline.findIndex((row) => row.eventType === "BUYBACK"),
    ).toBeGreaterThan(
      summary.timeline.findIndex((row) => row.eventType === "SELL"),
    );
    expect((buyRow!.event?.usdcDeployed ?? 0) > 0).toBe(true);
  });

  it("emits LIQUIDATION when liquidation is breached before any feasible sell", () => {
    const path = [60_000, 20_000];
    const input = makeValidInput({
      timelineMonths: 1,
      btcPath: path,
      repayRatioPct: 0.3,
    });
    const summary = summarizeCollateralOptimization(input);
    expect(summary.timeline[1]!.eventType).toBe("LIQUIDATION");
    expect(summary.liquidationAvoided).toBe(false);
    expect(summary.liquidationMonth).toBe(1);
  });
});

describe("optimizer", () => {
  it("ranks liquidation-avoiding candidates above unsafe ROI-only candidates and returns ranked candidates", () => {
    const result = optimizeCollateralStrategy(makeValidInput(), {
      btcPaths: [
        {
          id: "flash-crash",
          label: "Flash crash",
          prices: [60_000, 25_000, 20_000, 30_000],
          weight: 0.8,
        },
        {
          id: "bull",
          label: "Bull",
          prices: [60_000, 75_000, 90_000, 105_000],
          weight: 0.2,
        },
      ],
      candidateRanges: {
        deRiskTriggerLtvPct: [0.45, 0.78],
        postSellTargetLtvPct: [0.25],
        reRiskTriggerDistancePct: [0.45],
        maxLtvAfterBuyPct: [0.55],
        repayRatioPct: [1],
        buyStepPctOfReserve: [0.25],
        buySpacingPct: [0.1],
        minimumReserveUsdc: [40_000],
      },
      objectiveWeights: {
        liquidationAvoidance: 10,
        maxDrawdown: 2,
        debtReduction: 2,
        reserveSafety: 3,
        btcRetention: 1,
        modelledRoi: 1,
      },
    });

    expect(result.rankedCandidates.length).toBeGreaterThanOrEqual(2);
    expect(result.rankedCandidates[0]!.rank).toBe(1);
    expect(result.bestSummary.liquidationAvoided).toBe(true);
    expect(
      result.rankedCandidates.some((candidate) => !candidate.summary.liquidationAvoided),
    ).toBe(true);
  });

  it("aggregates path scores by weights", () => {
    const result = optimizeCollateralStrategy(makeValidInput(), {
      btcPaths: [
        {
          id: "flat",
          label: "Flat",
          prices: createFlatBtcPath(60_000, 2),
          weight: 0.75,
        },
        {
          id: "bull",
          label: "Bull",
          prices: [60_000, 70_000, 82_000],
          weight: 0.25,
        },
      ],
      candidateRanges: {
        deRiskTriggerLtvPct: [0.45],
        postSellTargetLtvPct: [0.25],
        reRiskTriggerDistancePct: [0.45],
        maxLtvAfterBuyPct: [0.55],
        repayRatioPct: [1],
        buyStepPctOfReserve: [0.25],
        buySpacingPct: [0.1],
        minimumReserveUsdc: [40_000],
      },
      objectiveWeights: {
        liquidationAvoidance: 8,
        maxDrawdown: 2,
        debtReduction: 2,
        reserveSafety: 3,
        btcRetention: 2,
        modelledRoi: 1,
      },
    });

    const candidate = result.rankedCandidates[0]!;
    const weightedAverage =
      (candidate.pathScores[0]!.score * 0.75 +
        candidate.pathScores[1]!.score * 0.25) /
      (0.75 + 0.25);
    expect(candidate.summary.objectiveScore).toBeCloseTo(weightedAverage, 6);
  });
});

describe("legacy isolation", () => {
  it("does not use yieldOverlayBps and does not create a fourth bucket", () => {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(
      resolve(currentDir, "collateral-rebalancing.ts"),
      "utf8",
    );
    expect(source.includes("yieldOverlayBps")).toBe(false);
    expect(COLLATERAL_BUCKETS).toHaveLength(3);
  });
});
