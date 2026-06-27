import { describe, it, expect } from "vitest";

import { parsePriceLine } from "../parse-machine-price";
import { computeMachineStrategy, type StrategyParams } from "../strategy-model";

const BASE: StrategyParams = {
  markupPct: 0,
  companySharePct: 0,
  destination: "france", // 0% customs → isolate markup/share math
  hashpriceUsdPerThDay: 0.028,
};

describe("computeMachineStrategy — markup (the company spread)", () => {
  const sample = parsePriceLine("M63S 18.5W 406T: $6.6/T", "unknown")!; // priceUsd = 6.6*406

  it("markup 0% → billed = cost", () => {
    const r = computeMachineStrategy(sample, BASE);
    expect(r.billedPriceUsd).toBe(r.costPriceUsd);
  });

  it("markup 20% → billed = cost × 1.2 and is what gets amortized", () => {
    const r = computeMachineStrategy(sample, { ...BASE, markupPct: 20 });
    expect(r.billedPriceUsd).toBeCloseTo(r.costPriceUsd * 1.2, 2);
    // exWorks fed to economics is the billed price (france 0% customs, +$100 freight)
    expect(r.exWorksUsd).toBe(r.billedPriceUsd);
    expect(r.landedUsd).toBeCloseTo(r.billedPriceUsd + 100, 2);
  });
});

describe("computeMachineStrategy — revenue share", () => {
  const sample = parsePriceLine("M63S 18.5W 406T: $6.6/T", "unknown")!;

  it("share 0% → LP keeps all net", () => {
    const r = computeMachineStrategy(sample, BASE);
    expect(r.companyCutUsdPerThDay).toBe(0);
    expect(r.lpNetUsdPerThDay).toBeCloseTo(r.netUsdPerThDay!, 6);
  });

  it("share 30% → company takes 30% of positive net", () => {
    const r = computeMachineStrategy(sample, { ...BASE, companySharePct: 30 });
    expect(r.netUsdPerThDay).not.toBeNull();
    if (r.netUsdPerThDay! > 0) {
      expect(r.companyCutUsdPerThDay).toBeCloseTo(r.netUsdPerThDay! * 0.3, 6);
      expect(r.lpNetUsdPerThDay).toBeCloseTo(r.netUsdPerThDay! * 0.7, 6);
    }
  });

  it("no company cut on negative net (no clawback)", () => {
    // Force negative net with a tiny hashprice.
    const r = computeMachineStrategy(sample, {
      ...BASE,
      hashpriceUsdPerThDay: 0.001,
      companySharePct: 50,
    });
    expect(r.netUsdPerThDay!).toBeLessThan(0);
    expect(r.companyCutUsdPerThDay).toBe(0);
    expect(r.lpNetUsdPerThDay).toBeCloseTo(r.netUsdPerThDay!, 6);
  });
});

describe("computeMachineStrategy — annualized LP yield", () => {
  const sample = parsePriceLine("M63S 18.5W 406T: $6.6/T", "unknown")!;

  it("yield% = lpNet × 365 / landedPerTh × 100", () => {
    const r = computeMachineStrategy(sample, { ...BASE, companySharePct: 25 });
    const landedPerTh = r.landedUsd / r.thPerUnit;
    const expected = ((r.lpNetUsdPerThDay! * 365) / landedPerTh) * 100;
    expect(r.lpMiningYieldPct).toBeCloseTo(Math.round(expected * 100) / 100, 2);
  });

  it("higher markup lowers LP yield (more capex to amortize)", () => {
    const low = computeMachineStrategy(sample, { ...BASE, markupPct: 0 });
    const high = computeMachineStrategy(sample, { ...BASE, markupPct: 40 });
    expect(high.lpMiningYieldPct!).toBeLessThan(low.lpMiningYieldPct!);
  });

  it("null yield when efficiency unknown (Avalon Q)", () => {
    const noEff = parsePriceLine("Avalon Q 90T: $1365", "unknown")!;
    const r = computeMachineStrategy(noEff, BASE);
    expect(r.lpMiningYieldPct).toBeNull();
    expect(r.lpNetUsdPerThDay).toBeNull();
  });
});
