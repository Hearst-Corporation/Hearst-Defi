import { describe, it, expect } from "vitest";

import { allocate, DEFAULT_RISK } from "../allocator";

const BASE = {
  miningYieldPct: 8,
  btcExpectedReturnPct: 40,
  usdcYieldPct: 5,
};

describe("allocate — derived 3-bucket split", () => {
  it("always sums to ~100", () => {
    const a = allocate(BASE);
    expect(a.miningPct + a.btcPct + a.usdcPct).toBeCloseTo(100, 1);
  });

  it("higher BTC expected return raises BTC weight", () => {
    const low = allocate({ ...BASE, btcExpectedReturnPct: 10 });
    const high = allocate({ ...BASE, btcExpectedReturnPct: 120 });
    expect(high.btcPct).toBeGreaterThan(low.btcPct);
  });

  it("higher USDC yield raises USDC weight", () => {
    const low = allocate({ ...BASE, usdcYieldPct: 2 });
    const high = allocate({ ...BASE, usdcYieldPct: 15 });
    expect(high.usdcPct).toBeGreaterThan(low.usdcPct);
  });

  it("higher mining yield raises mining weight", () => {
    const low = allocate({ ...BASE, miningYieldPct: 4 });
    const high = allocate({ ...BASE, miningYieldPct: 20 });
    expect(high.miningPct).toBeGreaterThan(low.miningPct);
  });

  it("all returns zero → parks everything in USDC", () => {
    const a = allocate({
      miningYieldPct: 0,
      btcExpectedReturnPct: 0,
      usdcYieldPct: 0,
    });
    expect(a.usdcPct).toBe(100);
    expect(a.btcPct).toBe(0);
    expect(a.miningPct).toBe(0);
  });

  it("negative mining yield gives mining zero weight", () => {
    const a = allocate({ ...BASE, miningYieldPct: -5 });
    expect(a.miningPct).toBe(0);
  });

  it("blendedReturnPct is the weighted average of bucket returns", () => {
    const a = allocate(BASE);
    const expected =
      (a.miningPct * BASE.miningYieldPct +
        a.btcPct * BASE.btcExpectedReturnPct +
        a.usdcPct * BASE.usdcYieldPct) /
      100;
    expect(a.blendedReturnPct).toBeCloseTo(Math.round(expected * 100) / 100, 1);
  });
});

describe("allocate — per-vault bounds", () => {
  it("Defensive caps BTC and floors USDC", () => {
    const a = allocate({
      ...BASE,
      btcExpectedReturnPct: 200, // would dominate without a cap
      bounds: { btc: [0, 15], usdc: [35, 100] },
    });
    expect(a.btcPct).toBeLessThanOrEqual(15 + 0.5);
    expect(a.usdcPct).toBeGreaterThanOrEqual(35 - 0.5);
    expect(a.miningPct + a.btcPct + a.usdcPct).toBeCloseTo(100, 1);
  });
});

describe("DEFAULT_RISK ordering", () => {
  it("BTC is the riskiest, USDC the safest", () => {
    expect(DEFAULT_RISK.btc).toBeGreaterThan(DEFAULT_RISK.mining);
    expect(DEFAULT_RISK.mining).toBeGreaterThan(DEFAULT_RISK.usdc);
  });
});
