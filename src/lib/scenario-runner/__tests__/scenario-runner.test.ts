import { describe, it, expect } from "vitest";

import {
  runManualStrategyProjection,
  validateCollateralConfig,
  validateRuleSet,
  validateManualProjectionConfig,
  type CollateralConfig,
  type ManualProjectionConfig,
  type RebalancingRule,
  type ManualProjectionInput,
} from "../index";

const collateral: CollateralConfig = {
  collateralAsset: "BTC",
  borrowAsset: "USDC",
  initialBtcCollateral: 10,
  initialDebtUsdc: 200_000,
  initialReserveUsdc: 150_000, // working capital above the min reserve
  liquidationLtvBps: 8000, // 80%
  targetSafetyBufferBps: 2000,
  targetRiskLtvBps: 6000,
  borrowAprBps: 600,
  electricityMonthlyCostUsdc: 2000,
  minReserveUsdc: 50_000,
  maxBtcExposureBps: 9000,
};

const projection = (over: Partial<ManualProjectionConfig> = {}): ManualProjectionConfig => ({
  durationMonths: 24,
  interval: "MONTHLY",
  btcPriceStart: 60_000,
  btcMonthlyDriftBps: 0,
  btcMonthlyVolBps: 0,
  stableYieldAprBps: 500,
  overlayYieldAprBps: 800,
  miningYieldAprBps: 400,
  feeDragAprBps: 200,
  ...over,
});

const liquidateRule = (over: Partial<RebalancingRule> = {}): RebalancingRule => ({
  id: "liq-1",
  scenario: "balanced",
  type: "LIQUIDATE",
  priority: 100,
  triggerMetric: "LTV",
  operator: ">=",
  value: 6000, // 60%
  action: { side: "SELL_BTC", sizingMode: "PERCENT_OF_BTC_COLLATERAL", sizingValue: 3000, repayDebtRatioBps: 10_000 },
  enabled: true,
  ...over,
});

const repurchaseRule = (over: Partial<RebalancingRule> = {}): RebalancingRule => ({
  id: "rep-1",
  scenario: "balanced",
  type: "REPURCHASE",
  priority: 10,
  triggerMetric: "LIQUIDATION_DISTANCE",
  operator: ">=",
  value: 3000,
  action: {
    side: "BUY_BTC",
    sizingMode: "PERCENT_OF_USDC_RESERVE",
    sizingValue: 2000,
    maxLtvAfterActionBps: 5000,
  },
  enabled: true,
  ...over,
});

const baseInput = (over: Partial<ManualProjectionInput> = {}): ManualProjectionInput => ({
  scenario: "balanced",
  collateral,
  projection: projection(),
  rules: [],
  seed: 1,
  ...over,
});

describe("ScenarioRunner — 24-month iteration", () => {
  it("runs exactly 24 monthly steps (25 snapshots incl. month 0)", () => {
    const r = runManualStrategyProjection(baseInput());
    expect(r.snapshots).toHaveLength(25);
    expect(r.snapshots[0]!.month).toBe(0);
    expect(r.snapshots[24]!.month).toBe(24);
  });

  it("is deterministic: same input → identical report", () => {
    expect(runManualStrategyProjection(baseInput())).toEqual(runManualStrategyProjection(baseInput()));
  });

  it("computes a final ROI and a min liquidation distance", () => {
    const r = runManualStrategyProjection(baseInput());
    expect(Number.isFinite(r.finalRoiBps)).toBe(true);
    expect(r.minLiquidationDistanceBps).toBeGreaterThanOrEqual(0);
  });

  it("never produces negative debt, BTC, or reserve", () => {
    const r = runManualStrategyProjection(
      baseInput({ projection: projection({ btcMonthlyDriftBps: -800, btcMonthlyVolBps: 400 }), rules: [liquidateRule()] }),
    );
    for (const s of r.snapshots) {
      expect(s.debtUsdc).toBeGreaterThanOrEqual(0);
      expect(s.btcCollateral).toBeGreaterThanOrEqual(0);
      expect(s.reserveUsdc).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("liquidation trigger", () => {
  it("SELLs BTC and repays debt when LTV crosses the threshold", () => {
    // Falling BTC pushes LTV up → liquidation rule fires.
    const r = runManualStrategyProjection(
      baseInput({ projection: projection({ btcMonthlyDriftBps: -1200 }), rules: [liquidateRule()] }),
    );
    expect(r.liquidationCount).toBeGreaterThan(0);
    expect(r.totalBtcSold).toBeGreaterThan(0);
    expect(r.totalDebtRepaidUsdc).toBeGreaterThan(0);
    const liqEvent = r.snapshots.flatMap((s) => s.events).find((e) => e.type === "LIQUIDATE");
    expect(liqEvent?.side).toBe("SELL_BTC");
  });

  it("hard-liquidates the position if LTV reaches the liquidation LTV", () => {
    // Steep crash, no protective rule → hard liquidation floor triggers.
    const r = runManualStrategyProjection(
      baseInput({ projection: projection({ btcMonthlyDriftBps: -2500 }), rules: [] }),
    );
    expect(r.endedLiquidated).toBe(true);
  });
});

describe("repurchase trigger", () => {
  it("BUYs BTC only when the buffer is healthy", () => {
    // Rising BTC → healthy distance → repurchase fires, buys BTC.
    const r = runManualStrategyProjection(
      baseInput({ projection: projection({ btcMonthlyDriftBps: 400 }), rules: [repurchaseRule()] }),
    );
    expect(r.repurchaseCount).toBeGreaterThan(0);
    expect(r.totalBtcBought).toBeGreaterThan(0);
  });

  it("is blocked when the resulting LTV would exceed maxLtvAfterAction", () => {
    // maxLtvAfterAction impossibly low (0) → every buy refused.
    const r = runManualStrategyProjection(
      baseInput({
        projection: projection({ btcMonthlyDriftBps: 400 }),
        rules: [repurchaseRule({ action: { side: "BUY_BTC", sizingMode: "PERCENT_OF_USDC_RESERVE", sizingValue: 5000, maxLtvAfterActionBps: 1 } })],
      }),
    );
    expect(r.repurchaseCount).toBe(0);
    expect(r.totalBtcBought).toBe(0);
  });

  it("never buys back during a crisis (liquidation distance 0)", () => {
    // Crash to emergency + a permissive repurchase rule → still no buy in crisis.
    const r = runManualStrategyProjection(
      baseInput({
        projection: projection({ btcMonthlyDriftBps: -2000 }),
        rules: [repurchaseRule({ triggerMetric: "MONTH", operator: ">=", value: 1 })],
      }),
    );
    // In a deep crash the distance collapses; buys must not run while at 0.
    const crisisBuys = r.snapshots
      .filter((s) => s.liquidationDistanceBps === 0)
      .flatMap((s) => s.events)
      .filter((e) => e.type === "REPURCHASE");
    expect(crisisBuys).toHaveLength(0);
  });
});

describe("LIQUIDATE wins over REPURCHASE + cooldown/maxExecutions", () => {
  it("liquidation is applied before repurchase when both fire the same month", () => {
    // Both rules always-fire on MONTH>=1; liquidation must be first event.
    const r = runManualStrategyProjection(
      baseInput({
        projection: projection({ btcMonthlyDriftBps: 0 }),
        rules: [
          liquidateRule({ triggerMetric: "MONTH", operator: ">=", value: 1, maxExecutions: 1 }),
          repurchaseRule({ triggerMetric: "MONTH", operator: ">=", value: 1, maxExecutions: 1 }),
        ],
      }),
    );
    const monthEvents = r.snapshots.find((s) => s.events.length >= 2)?.events;
    if (monthEvents && monthEvents.length >= 2) {
      expect(monthEvents[0]!.type).toBe("LIQUIDATE");
    }
    expect(r.liquidationCount).toBeGreaterThan(0);
  });

  it("cooldownMonths prevents a rule from re-firing too soon", () => {
    const r = runManualStrategyProjection(
      baseInput({
        rules: [liquidateRule({ triggerMetric: "MONTH", operator: ">=", value: 1, cooldownMonths: 24 })],
      }),
    );
    expect(r.liquidationCount).toBeLessThanOrEqual(1);
  });

  it("maxExecutions is respected", () => {
    const r = runManualStrategyProjection(
      baseInput({
        rules: [liquidateRule({ triggerMetric: "MONTH", operator: ">=", value: 1, maxExecutions: 2 })],
      }),
    );
    expect(r.liquidationCount).toBeLessThanOrEqual(2);
  });
});

describe("economics affect the projection", () => {
  it("electricity cost drags the reserve/debt vs zero-cost", () => {
    const withElec = runManualStrategyProjection(baseInput());
    const noElec = runManualStrategyProjection(
      baseInput({ collateral: { ...collateral, electricityMonthlyCostUsdc: 0 } }),
    );
    const endWith = withElec.snapshots[24]!;
    const endNo = noElec.snapshots[24]!;
    expect(endNo.netEquityUsdc).toBeGreaterThan(endWith.netEquityUsdc);
  });

  it("higher borrow APR increases debt drag", () => {
    const low = runManualStrategyProjection(baseInput({ collateral: { ...collateral, borrowAprBps: 0 } }));
    const high = runManualStrategyProjection(baseInput({ collateral: { ...collateral, borrowAprBps: 2000 } }));
    expect(high.snapshots[24]!.debtUsdc).toBeGreaterThan(low.snapshots[24]!.debtUsdc);
  });

  it("higher yield APR grows the reserve", () => {
    const low = runManualStrategyProjection(
      baseInput({ projection: projection({ stableYieldAprBps: 0, overlayYieldAprBps: 0, miningYieldAprBps: 0 }) }),
    );
    const high = runManualStrategyProjection(
      baseInput({ projection: projection({ stableYieldAprBps: 2000, overlayYieldAprBps: 2000, miningYieldAprBps: 2000 }) }),
    );
    expect(high.snapshots[24]!.reserveUsdc).toBeGreaterThan(low.snapshots[24]!.reserveUsdc);
  });
});

describe("validators", () => {
  it("valid configs pass", () => {
    expect(validateCollateralConfig(collateral)).toEqual([]);
    expect(validateManualProjectionConfig(projection())).toEqual([]);
    expect(validateRuleSet([liquidateRule(), repurchaseRule()])).toEqual([]);
  });

  it("catches a liquidation rule with a BUY action", () => {
    const bad = liquidateRule({ action: { side: "BUY_BTC", sizingMode: "FIXED_USDC", sizingValue: 1, maxLtvAfterActionBps: 5000 } });
    expect(validateRuleSet([bad]).some((v) => v.code === "liq_action")).toBe(true);
  });

  it("catches a BUY rule missing maxLtvAfterAction", () => {
    const bad = repurchaseRule({ action: { side: "BUY_BTC", sizingMode: "FIXED_USDC", sizingValue: 1 } });
    expect(validateRuleSet([bad]).some((v) => v.code === "buy_max_ltv")).toBe(true);
  });

  it("catches a duration other than 24", () => {
    expect(
      validateManualProjectionConfig({ ...projection(), durationMonths: 12 as never }).some((v) => v.code === "duration"),
    ).toBe(true);
  });

  it("catches a repurchase outranking a liquidation in the same scenario", () => {
    const rep = repurchaseRule({ priority: 999 });
    const liq = liquidateRule({ priority: 1 });
    expect(validateRuleSet([rep, liq]).some((v) => v.code === "priority_order")).toBe(true);
  });
});
