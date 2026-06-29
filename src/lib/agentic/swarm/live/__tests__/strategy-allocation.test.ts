import { describe, expect, it } from "vitest";

import { deriveRegimeAllocation } from "@/lib/agentic/swarm/live/strategy-allocation";
import { MINING_FLOOR } from "@/lib/products/guards";

const FLOOR_PCT = MINING_FLOOR * 100; // 30

// Helpers
function sumSleeves(r: ReturnType<typeof deriveRegimeAllocation>): number {
  return r.mining + r.btc + r.usdc + r.stableReserve;
}

// ── baseline profitable scenario ────────────────────────────────────────────

const PROFITABLE = {
  miningYieldPct: 12,  // healthy mining
  usdcYieldPct: 5,
};

// ── underwater mining scenario ───────────────────────────────────────────────

const UNDERWATER = {
  miningYieldPct: -3,  // hashprice below cost
  usdcYieldPct: 5,
};

// ── all returns zero / negative (all-USDC degenerate) ───────────────────────

const ALL_ZERO = {
  miningYieldPct: 0,
  usdcYieldPct: 0,
};

describe("deriveRegimeAllocation — mining floor enforcement", () => {
  it("balanced regime keeps mining >= 30% with profitable mining", () => {
    const r = deriveRegimeAllocation({ regime: "balanced", ...PROFITABLE });
    expect(r.mining).toBeGreaterThanOrEqual(FLOOR_PCT);
    expect(r.governanceException).toBe(false);
    expect(r.miningProfitable).toBe(true);
  });

  it("opportunistic regime keeps mining >= 30% with profitable mining", () => {
    const r = deriveRegimeAllocation({ regime: "opportunistic", ...PROFITABLE });
    expect(r.mining).toBeGreaterThanOrEqual(FLOOR_PCT);
    expect(r.governanceException).toBe(false);
  });

  it("defensive regime keeps mining >= 30% with profitable mining", () => {
    const r = deriveRegimeAllocation({ regime: "defensive", ...PROFITABLE });
    expect(r.mining).toBeGreaterThanOrEqual(FLOOR_PCT);
    expect(r.governanceException).toBe(false);
  });

  it("underwater mining → mining weight drops toward floor (not dominated by -yield)", () => {
    const r = deriveRegimeAllocation({ regime: "balanced", ...UNDERWATER });
    // Mining must still be >= floor (30%) because floor is enforced.
    expect(r.mining).toBeGreaterThanOrEqual(FLOOR_PCT);
    expect(r.miningProfitable).toBe(false);
    // USDC should get a larger share than in the profitable case (allocator rotates away).
    const rProfitable = deriveRegimeAllocation({ regime: "balanced", ...PROFITABLE });
    // The raw allocator score for underwater mining is 0, so the stable sleeve is larger.
    expect(r.usdc + r.stableReserve).toBeGreaterThanOrEqual(
      rProfitable.usdc + rProfitable.stableReserve,
    );
  });

  it("underwater mining → governanceException is flagged (clamped to floor)", () => {
    // With negative yield the allocator would want 0% mining; the floor guard
    // should clamp it to 30% and flag the exception.
    const r = deriveRegimeAllocation({ regime: "balanced", ...UNDERWATER });
    // The raw allocator gives mining a score of 0 (return ≤ 0).
    // After bounds the min clamp (30) kicks in, so flagged = true.
    expect(r.governanceException).toBe(true);
    expect(r.mining).toBe(FLOOR_PCT);
  });

  it("all returns zero → degenerate case still keeps mining >= 30%", () => {
    const r = deriveRegimeAllocation({ regime: "balanced", ...ALL_ZERO });
    expect(r.mining).toBeGreaterThanOrEqual(FLOOR_PCT);
  });

  it("sleeves always sum to 100", () => {
    const cases = [
      { regime: "defensive" as const, ...PROFITABLE },
      { regime: "balanced" as const, ...PROFITABLE },
      { regime: "opportunistic" as const, ...PROFITABLE },
      { regime: "balanced" as const, ...UNDERWATER },
      { regime: "defensive" as const, ...UNDERWATER },
      { regime: "balanced" as const, ...ALL_ZERO },
    ];
    for (const c of cases) {
      const r = deriveRegimeAllocation(c);
      expect(sumSleeves(r), `sum for ${c.regime}`).toBeCloseTo(100, 1);
    }
  });

  it("mining is NEVER below 30% in NORMAL mode for any regime", () => {
    const regimes = ["defensive", "balanced", "opportunistic"] as const;
    const yields = [PROFITABLE, UNDERWATER, ALL_ZERO, { miningYieldPct: -100, usdcYieldPct: 0 }];
    for (const regime of regimes) {
      for (const y of yields) {
        const r = deriveRegimeAllocation({ regime, ...y });
        expect(r.mining, `mining for ${regime} miningYield=${y.miningYieldPct}`).toBeGreaterThanOrEqual(FLOOR_PCT);
      }
    }
  });

  it("miningFraction matches mining / 100 (within rounding)", () => {
    const r = deriveRegimeAllocation({ regime: "balanced", ...PROFITABLE });
    expect(r.miningFraction).toBeCloseTo(r.mining / 100, 5);
  });

  it("rationale string contains regime and profit/loss label", () => {
    const rP = deriveRegimeAllocation({ regime: "balanced", ...PROFITABLE });
    expect(rP.rationale).toContain("balanced");
    expect(rP.rationale).toContain("profitable mining");

    const rU = deriveRegimeAllocation({ regime: "defensive", ...UNDERWATER });
    expect(rU.rationale).toContain("defensive");
    expect(rU.rationale).toContain("underwater mining");
    expect(rU.rationale).toContain("floor");
  });

  it("btcExpectedReturnPct matches product scenario bands per regime", () => {
    // defensive → bear (−20% = −0.2 * 100 = −20)
    const d = deriveRegimeAllocation({ regime: "defensive", ...PROFITABLE });
    expect(d.btcExpectedReturnPct).toBeCloseTo(-20, 5);
    // balanced → base (+40%)
    const b = deriveRegimeAllocation({ regime: "balanced", ...PROFITABLE });
    expect(b.btcExpectedReturnPct).toBeCloseTo(40, 5);
    // opportunistic → bull (+120%)
    const o = deriveRegimeAllocation({ regime: "opportunistic", ...PROFITABLE });
    expect(o.btcExpectedReturnPct).toBeCloseTo(120, 5);
  });

  it("btcExpectedReturnPct override is respected", () => {
    const r = deriveRegimeAllocation({
      regime: "balanced",
      ...PROFITABLE,
      btcExpectedReturnPctOverride: 99,
    });
    expect(r.btcExpectedReturnPct).toBe(99);
  });
});

describe("deriveRegimeAllocation — regression: -13% bug fix", () => {
  it("underwater mining drives the MC weight DOWN (not at 0.6 hardcoded)", () => {
    const r = deriveRegimeAllocation({ regime: "balanced", ...UNDERWATER });
    // With underwater mining the allocator raw score for mining is 0.
    // After clamping to the 30% floor, miningFraction must equal 0.30.
    // This is strictly LESS than the old hardcoded 0.6.
    expect(r.miningFraction).toBeLessThan(0.6);
    expect(r.miningFraction).toBeCloseTo(0.3, 5);
  });
});
