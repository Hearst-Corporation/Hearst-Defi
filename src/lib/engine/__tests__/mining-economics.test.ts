import { describe, it, expect } from "vitest";
import {
  computeBtcPerThDay,
  computeProductionEconomics,
  computeFleetProduction,
  simulateFutureValue,
  computeHalvingCountdown,
} from "../mining-economics";
import { deriveHashpriceUsdPerThDay, networkHashrateThs } from "../hashprice-formula";

describe("computeBtcPerThDay", () => {
  it("is 0 for non-positive/degenerate network hashrate", () => {
    expect(computeBtcPerThDay(0)).toBe(0);
    expect(computeBtcPerThDay(-1)).toBe(0);
    expect(computeBtcPerThDay(NaN)).toBe(0);
  });
});

describe("computeProductionEconomics — GOLDEN case", () => {
  // Derivation (networkHashrateThs = 900 EH/s = 900,000,000 TH/s):
  //   btcPerThDay = BLOCK_REWARD_BTC(3.125) * BLOCKS_PER_DAY(144) / 900,000,000
  //               = 450 / 900,000,000 = 5e-7 BTC/TH/day
  //   uptime = 0.98
  //   totalCostUsdPerThDay chosen = 0.023422 so that:
  //     costToProduce1BtcUsd = 0.023422 / (5e-7 * 0.98)
  //                           = 0.023422 / 4.9e-7 = 47,800 (exact)
  //   at btcPriceUsd = 118,000:
  //     productionMarginPerBtcUsd = 118,000 - 47,800 = 70,200
  //     productionMarginPct = 70,200 / 118,000 * 100 = 59.491525...%
  const golden = computeProductionEconomics({
    totalCostUsdPerThDay: 0.023422,
    networkHashrateThs: 900_000_000,
    btcPriceUsd: 118_000,
    uptime: 0.98,
  });

  it("pins costToProduce1BtcUsd ≈ 47,800", () => {
    expect(golden.costToProduce1BtcUsd).toBeCloseTo(47800, 0);
  });

  it("pins productionMarginPerBtcUsd ≈ 70,200", () => {
    expect(golden.productionMarginPerBtcUsd).toBeCloseTo(70200, 0);
  });

  it("pins productionMarginPct ≈ 59.4915%", () => {
    expect(golden.productionMarginPct).toBeCloseTo(59.4915, 3);
  });

  it("breakEvenBtcPriceUsd equals cost-to-produce (feeFraction defaults to 0)", () => {
    expect(golden.breakEvenBtcPriceUsd).toBe(golden.costToProduce1BtcUsd);
  });

  it("costBasis is stamped fully_loaded", () => {
    expect(golden.costBasis).toBe("fully_loaded");
  });

  it("estimatedProfitPerBtcUsd aliases productionMarginPerBtcUsd", () => {
    expect(golden.estimatedProfitPerBtcUsd).toBe(golden.productionMarginPerBtcUsd);
  });
});

describe("computeProductionEconomics — invariants", () => {
  const cases = [
    { totalCostUsdPerThDay: 0.023422, networkHashrateThs: 900_000_000, btcPriceUsd: 118_000, uptime: 0.98 },
    { totalCostUsdPerThDay: 0.05, networkHashrateThs: 600_000_000, btcPriceUsd: 65_000, uptime: 0.95 },
  ];

  it.each(cases)(
    "productionMarginPerBtcUsd === btcPriceUsd − costToProduce1BtcUsd (%#)",
    (input) => {
      const r = computeProductionEconomics(input);
      expect(r.productionMarginPerBtcUsd).toBeCloseTo(
        input.btcPriceUsd - r.costToProduce1BtcUsd,
        6,
      );
    },
  );

  it.each(cases)("with feeFraction=0, breakEvenBtcPriceUsd === costToProduce1BtcUsd (%#)", (input) => {
    const r = computeProductionEconomics({ ...input, feeFraction: 0 });
    expect(r.breakEvenBtcPriceUsd).toBe(r.costToProduce1BtcUsd);
  });

  it("feeFraction > 0 raises break-even above cost-to-produce", () => {
    const base = computeProductionEconomics(cases[0]!);
    const withFee = computeProductionEconomics({ ...cases[0]!, feeFraction: 0.1 });
    expect(withFee.breakEvenBtcPriceUsd).toBeCloseTo(base.costToProduce1BtcUsd / 0.9, 2);
    expect(withFee.breakEvenBtcPriceUsd).toBeGreaterThan(base.breakEvenBtcPriceUsd);
  });

  it("degenerate inputs (zero network hashrate) never leak NaN/Infinity", () => {
    const r = computeProductionEconomics({
      totalCostUsdPerThDay: 0.05,
      networkHashrateThs: 0,
      btcPriceUsd: 100_000,
    });
    for (const [key, value] of Object.entries(r)) {
      if (typeof value === "number") {
        expect(Number.isFinite(value), `${key} must be finite`).toBe(true);
      }
    }
    expect(r.costToProduce1BtcUsd).toBe(0);
  });
});

describe("cross-check vs hashprice-formula.ts", () => {
  it("computeBtcPerThDay(hashrate) × btcPrice agrees with deriveHashpriceUsdPerThDay to 6dp", () => {
    const difficulty = 90_000_000_000_000; // arbitrary realistic difficulty
    const btcPriceUsd = 118_000;
    const hashrate = networkHashrateThs(difficulty);

    const viaHashprice = deriveHashpriceUsdPerThDay(difficulty, btcPriceUsd);
    const viaBtcPerThDay = computeBtcPerThDay(hashrate) * btcPriceUsd;

    expect(viaBtcPerThDay).toBeCloseTo(viaHashprice, 6);
  });
});

describe("computeFleetProduction", () => {
  it("btcPerMonth === btcPerDay × 30.4 exactly", () => {
    const r = computeFleetProduction({
      fleetHashrateThs: 50_000,
      networkHashrateThs: 900_000_000,
    });
    expect(r.btcPerMonth).toBe(Math.round(r.btcPerDay * 30.4 * 1e8) / 1e8);
  });

  it("zero fleet hashrate → all zero, no NaN", () => {
    const r = computeFleetProduction({ fleetHashrateThs: 0, networkHashrateThs: 900_000_000 });
    expect(r).toEqual({ btcPerDay: 0, btcPerMonth: 0, btcPerYear: 0 });
  });

  it("zero network hashrate → all zero, no NaN", () => {
    const r = computeFleetProduction({ fleetHashrateThs: 50_000, networkHashrateThs: 0 });
    expect(r).toEqual({ btcPerDay: 0, btcPerMonth: 0, btcPerYear: 0 });
  });
});

describe("simulateFutureValue", () => {
  const DEFAULT_SCENARIOS = [150_000, 200_000, 300_000, 500_000];

  it("futurePortfolioValueUsd === btcReserve × targetPriceUsd for each default scenario", () => {
    const btcReserve = 12.5;
    const r = simulateFutureValue({ btcReserve, currentBtcPriceUsd: 118_000 });
    expect(r.scenarios).toHaveLength(4);
    r.scenarios.forEach((s, idx) => {
      expect(s.targetPriceUsd).toBe(DEFAULT_SCENARIOS[idx]);
      expect(s.futurePortfolioValueUsd).toBeCloseTo(btcReserve * DEFAULT_SCENARIOS[idx]!, 6);
    });
  });

  it("ROI computed correctly WITHOUT costBasisUsd (falls back to currentValueUsd)", () => {
    const btcReserve = 10;
    const currentBtcPriceUsd = 100_000;
    const r = simulateFutureValue({ btcReserve, currentBtcPriceUsd });
    const currentValueUsd = btcReserve * currentBtcPriceUsd;
    const scenario300k = r.scenarios.find((s) => s.targetPriceUsd === 300_000)!;
    const expectedGain = 10 * 300_000 - currentValueUsd;
    expect(scenario300k.gainUsd).toBeCloseTo(expectedGain, 2);
    expect(scenario300k.roiPct).toBeCloseTo((expectedGain / currentValueUsd) * 100, 4);
  });

  it("ROI computed correctly WITH explicit costBasisUsd", () => {
    const btcReserve = 10;
    const costBasisUsd = 400_000; // e.g. avg cost basis different from current mark
    const r = simulateFutureValue({
      btcReserve,
      currentBtcPriceUsd: 100_000,
      costBasisUsd,
    });
    const scenario500k = r.scenarios.find((s) => s.targetPriceUsd === 500_000)!;
    const expectedGain = 10 * 500_000 - costBasisUsd;
    expect(scenario500k.gainUsd).toBeCloseTo(expectedGain, 2);
    expect(scenario500k.roiPct).toBeCloseTo((expectedGain / costBasisUsd) * 100, 4);
  });

  it("multiple === targetPriceUsd / currentBtcPriceUsd", () => {
    const r = simulateFutureValue({ btcReserve: 1, currentBtcPriceUsd: 100_000 });
    const scenario200k = r.scenarios.find((s) => s.targetPriceUsd === 200_000)!;
    expect(scenario200k.multiple).toBeCloseTo(2, 6);
  });

  it("btcReserve=0 → every scenario field is 0, no div-by-zero", () => {
    const r = simulateFutureValue({ btcReserve: 0, currentBtcPriceUsd: 100_000 });
    expect(r.currentValueUsd).toBe(0);
    for (const s of r.scenarios) {
      expect(s.futurePortfolioValueUsd).toBe(0);
      expect(s.gainUsd).toBe(0);
      expect(s.roiPct).toBe(0);
      expect(Number.isFinite(s.multiple)).toBe(true);
    }
  });

  it("currentBtcPriceUsd<=0 → multiple guarded to 0", () => {
    const r = simulateFutureValue({ btcReserve: 5, currentBtcPriceUsd: 0 });
    for (const s of r.scenarios) {
      expect(s.multiple).toBe(0);
      expect(Number.isFinite(s.multiple)).toBe(true);
    }
  });
});

describe("computeHalvingCountdown", () => {
  it("at currentBlockHeight=840,000 (April 2024 halving), pins epoch/reward/next-height", () => {
    const now = new Date("2024-04-20T00:00:00.000Z");
    const r = computeHalvingCountdown({ currentBlockHeight: 840_000, now });
    expect(r.currentBlockRewardBtc).toBeCloseTo(3.125, 6);
    expect(r.nextHalvingHeight).toBe(1_050_000);
    expect(r.currentEpoch).toBe(4);
    expect(r.nextBlockRewardBtc).toBeCloseTo(1.5625, 6);
    expect(r.blocksRemaining).toBe(210_000);
  });

  it("is deterministic: same injected `now` twice → identical estimatedDate", () => {
    const now = new Date("2026-07-13T12:00:00.000Z");
    const inputs = { currentBlockHeight: 900_000, now };
    const r1 = computeHalvingCountdown(inputs);
    const r2 = computeHalvingCountdown(inputs);
    expect(r1.estimatedDate.getTime()).toBe(r2.estimatedDate.getTime());
    expect(r1.estimatedDaysRemaining).toBe(r2.estimatedDaysRemaining);
  });

  it("degenerate block height (negative) never leaks NaN/Infinity", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const r = computeHalvingCountdown({ currentBlockHeight: -5, now });
    expect(r.currentBlockHeight).toBe(0);
    expect(Number.isFinite(r.blocksRemaining)).toBe(true);
    expect(Number.isFinite(r.currentBlockRewardBtc)).toBe(true);
  });
});
