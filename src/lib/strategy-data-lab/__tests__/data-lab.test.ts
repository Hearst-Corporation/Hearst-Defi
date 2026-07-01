import { describe, it, expect } from "vitest";

import type {
  CollateralConfig,
  ManualProjectionConfig,
  RebalancingRule,
} from "@/lib/scenario-runner";
import { runManualStrategyProjection } from "@/lib/scenario-runner";
import {
  BacktestRunner,
  ForwardSimulationRunner,
  StressMatrixRunner,
  SensitivityAnalyzer,
  analyzeTriggers,
  computeMetrics,
  MARKET_REGIMES,
  SYNTHETIC_HISTORICAL_REGIMES,
  MAX_PATHS,
  type StressAxis,
} from "..";

const collateral: CollateralConfig = {
  collateralAsset: "BTC",
  borrowAsset: "USDC",
  initialBtcCollateral: 10,
  initialDebtUsdc: 200_000,
  initialReserveUsdc: 120_000,
  liquidationLtvBps: 8000,
  targetSafetyBufferBps: 2000,
  targetRiskLtvBps: 6000,
  borrowAprBps: 600,
  electricityMonthlyCostUsdc: 3000,
  minReserveUsdc: 40_000,
  maxBtcExposureBps: 9000,
};

const projection: ManualProjectionConfig = {
  durationMonths: 24,
  interval: "MONTHLY",
  btcPriceStart: 60_000,
  btcMonthlyDriftBps: 100,
  btcMonthlyVolBps: 800,
  stableYieldAprBps: 500,
  overlayYieldAprBps: 900,
  miningYieldAprBps: 400,
  feeDragAprBps: 200,
};

const rules: RebalancingRule[] = [
  {
    id: "liq-ltv",
    scenario: "balanced",
    type: "LIQUIDATE",
    priority: 100,
    triggerMetric: "LTV",
    operator: ">=",
    value: 6500,
    action: { side: "SELL_BTC", sizingMode: "PERCENT_OF_BTC_COLLATERAL", sizingValue: 3000, repayDebtRatioBps: 10_000 },
    cooldownMonths: 1,
    enabled: true,
  },
  {
    id: "rep-dist",
    scenario: "balanced",
    type: "REPURCHASE",
    priority: 10,
    triggerMetric: "LIQUIDATION_DISTANCE",
    operator: ">=",
    value: 4000,
    action: { side: "BUY_BTC", sizingMode: "PERCENT_OF_USDC_RESERVE", sizingValue: 2500, maxLtvAfterActionBps: 5500 },
    cooldownMonths: 2,
    enabled: true,
  },
];

describe("regime library + fixtures", () => {
  it("provides 10 market regimes and 6 synthetic historical-style regimes", () => {
    expect(MARKET_REGIMES).toHaveLength(10);
    expect(SYNTHETIC_HISTORICAL_REGIMES).toHaveLength(6);
    // Every historical-style regime is labelled synthetic.
    for (const r of SYNTHETIC_HISTORICAL_REGIMES) {
      expect(r.description).toMatch(/synthetic historical-style/i);
    }
  });
});

describe("BacktestRunner", () => {
  const config = {
    strategyId: "strat-btc-mining-performance",
    collateral,
    projection,
    rules,
    regimes: MARKET_REGIMES.slice(0, 4),
    scenarios: ["safe", "balanced", "opportunistic"] as const,
  };

  it("runs every regime × scenario", () => {
    const report = new BacktestRunner().run({ ...config, scenarios: [...config.scenarios] });
    expect(report.runs).toHaveLength(4 * 3);
    for (const run of report.runs) {
      expect(run.report.snapshots).toHaveLength(25);
      expect(run.metrics).toBeDefined();
    }
  });

  it("is deterministic", () => {
    const a = new BacktestRunner().run({ ...config, scenarios: [...config.scenarios] });
    const b = new BacktestRunner().run({ ...config, scenarios: [...config.scenarios] });
    expect(a.summary).toEqual(b.summary);
  });

  it("summary identifies the safest scenario by min distance", () => {
    const report = new BacktestRunner().run({ ...config, scenarios: [...config.scenarios] });
    expect(["safe", "balanced", "opportunistic"]).toContain(report.summary.safestScenarioByMinDistance);
    expect(report.summary.bestFinalRoiBps).toBeGreaterThanOrEqual(report.summary.worstFinalRoiBps);
    expect(report.summary.liquidationFrequencyBps).toBeGreaterThanOrEqual(0);
  });
});

describe("ForwardSimulationRunner", () => {
  const config = {
    scenario: "balanced" as const,
    collateral,
    projection,
    rules,
    monteCarlo: {
      enabled: true,
      paths: 120,
      seed: 42,
      confidenceBands: [0.05, 0.5, 0.95],
      includeJumpRisk: false,
      includeElectricityShock: false,
      includeBorrowAprShock: false,
    },
  };

  it("produces deterministic seeded paths", () => {
    const a = new ForwardSimulationRunner().run(config);
    const b = new ForwardSimulationRunner().run(config);
    expect(a).toEqual(b);
  });

  it("computes p5/p50/p95 and probabilities in [0, 10000] bps", () => {
    const r = new ForwardSimulationRunner().run(config);
    expect(r.finalRoiPercentilesBps.p5).toBeLessThanOrEqual(r.finalRoiPercentilesBps.p50!);
    expect(r.finalRoiPercentilesBps.p50).toBeLessThanOrEqual(r.finalRoiPercentilesBps.p95!);
    expect(r.liquidationProbabilityBps).toBeGreaterThanOrEqual(0);
    expect(r.liquidationProbabilityBps).toBeLessThanOrEqual(10_000);
    expect(r.worstPath.finalRoiBps).toBeLessThanOrEqual(r.bestPath.finalRoiBps);
  });

  it("caps paths at MAX_PATHS (perf guard)", () => {
    const r = new ForwardSimulationRunner().run({ ...config, monteCarlo: { ...config.monteCarlo, paths: 999_999 } });
    expect(r.paths).toBe(MAX_PATHS);
  });
});

describe("StressMatrixRunner", () => {
  const xAxis: StressAxis = { variable: "BTC_SHOCK", values: [-4000, -2000, 0, 2000] };
  const yAxis: StressAxis = { variable: "ELECTRICITY_SHOCK", values: [0, 5000, 10_000] };

  it("generates a cell for every (x,y) pair", () => {
    const r = new StressMatrixRunner().run({ scenario: "balanced", collateral, projection, rules, xAxis, yAxis });
    expect(r.cells).toHaveLength(4 * 3);
  });

  it("classifies a severe BTC crash cell as HIGH or CRITICAL", () => {
    const crash: StressAxis = { variable: "BTC_SHOCK", values: [-7000] };
    const r = new StressMatrixRunner().run({ scenario: "balanced", collateral, projection, rules, xAxis: crash, yAxis: { variable: "ELECTRICITY_SHOCK", values: [0] } });
    expect(["HIGH", "CRITICAL"]).toContain(r.cells[0]!.riskLevel);
  });

  it("classifies a benign cell as LOW or MEDIUM", () => {
    const r = new StressMatrixRunner().run({
      scenario: "balanced",
      collateral,
      projection: { ...projection, btcMonthlyDriftBps: 300, btcMonthlyVolBps: 300 },
      rules,
      xAxis: { variable: "BTC_SHOCK", values: [0] },
      yAxis: { variable: "ELECTRICITY_SHOCK", values: [0] },
    });
    expect(["LOW", "MEDIUM"]).toContain(r.cells[0]!.riskLevel);
  });
});

describe("SensitivityAnalyzer", () => {
  it("ranks ROI drivers and risk drivers", () => {
    const r = new SensitivityAnalyzer().run({
      scenario: "balanced",
      collateral,
      projection,
      rules,
      sensitivity: { variables: ["BTC_PRICE", "BORROW_APR", "ELECTRICITY_COST", "STABLE_YIELD"], stepBps: 1000, rangeSteps: 2 },
    });
    expect(r.rows).toHaveLength(4);
    expect(r.topRoiDrivers).toHaveLength(4);
    expect(r.topRiskDrivers).toHaveLength(4);
    // Each row sweeps 2*range+1 steps.
    expect(r.rows[0]!.roiByStep).toHaveLength(5);
    // BTC price should be a meaningful ROI driver (non-zero impact).
    const btc = r.rows.find((row) => row.variable === "BTC_PRICE")!;
    expect(btc.roiImpactBps).toBeGreaterThan(0);
  });
});

describe("TriggerAnalytics", () => {
  it("counts liquidations and identifies the first liquidation month in a crash", () => {
    const report = runManualStrategyProjection({
      scenario: "balanced",
      collateral,
      projection: { ...projection, btcMonthlyDriftBps: -1500 },
      rules,
      seed: 3,
    });
    const t = analyzeTriggers(report);
    expect(t.liquidationCount).toBeGreaterThan(0);
    expect(t.firstLiquidationMonth).not.toBeNull();
    expect(t.mostFrequentTriggerRuleId).not.toBeNull();
  });

  it("reports no events for a calm path", () => {
    const report = runManualStrategyProjection({
      scenario: "balanced",
      collateral,
      projection: { ...projection, btcMonthlyDriftBps: 0, btcMonthlyVolBps: 0 },
      rules: [],
      seed: 3,
    });
    const t = analyzeTriggers(report);
    expect(t.liquidationCount).toBe(0);
    expect(t.typicalSequence).toBe("no rebalancing events");
  });
});

describe("metrics", () => {
  it("computes max drawdown, max LTV, min distance, electricity + borrow cost", () => {
    const report = runManualStrategyProjection({
      scenario: "balanced",
      collateral,
      projection: { ...projection, btcMonthlyDriftBps: -600 },
      rules,
      seed: 9,
    });
    const m = computeMetrics(report, collateral, projection);
    expect(m.maxDrawdownBps).toBeGreaterThanOrEqual(0);
    expect(m.maxLtvBps).toBeGreaterThan(0);
    expect(m.minLiquidationDistanceBps).toBeGreaterThanOrEqual(0);
    expect(m.totalElectricityCostUsdc).toBe(collateral.electricityMonthlyCostUsdc * 24);
    expect(m.totalBorrowCostUsdc).toBeGreaterThan(0);
    expect(Number.isFinite(m.sharpeLike)).toBe(true);
    expect(Number.isFinite(m.sortinoLike)).toBe(true);
  });
});
