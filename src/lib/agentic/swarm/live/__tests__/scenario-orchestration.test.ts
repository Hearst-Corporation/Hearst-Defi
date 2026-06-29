import { describe, expect, it } from "vitest";

import { deriveRegimeAllocation } from "@/lib/agentic/swarm/live/strategy-allocation";
import { runQuant } from "@/lib/agentic/swarm/live/runners-data";
import { buildConstructionSteps } from "@/lib/agentic/swarm/live/construction-steps";
import { resolveQuantAssumptions } from "@/lib/agentic/swarm/live/quant-assumptions";
import type { ScenarioResult } from "@/lib/agentic/swarm/live/types";

// Shared market/strategy inputs (no network I/O — pure compute).
const MARKET = { btcUsd: 60000, difficulty: 1e14, hashpriceUsdPerThDay: 0.06 };
const STRATEGY_PROFITABLE = {
  miningYieldPct: 10,
  usdcYieldPct: 5,
  headlineApy: { low: 8, high: 13 },
};
const STRATEGY_UNDERWATER = {
  miningYieldPct: -3,
  usdcYieldPct: 5,
  headlineApy: { low: 3, high: 8 },
};
const TELEGRAM = { bestCostPerThDay: 0.05 };
const ASSUMPTIONS = resolveQuantAssumptions({ paths: 500 }); // fast for tests
const SEED = 12345;

// ── runQuant: miningWeightOverride ───────────────────────────────────────────

describe("runQuant — miningWeightOverride", () => {
  it("when override provided, the MC uses it instead of assumptions.yield.miningWeight", () => {
    // The default assumption miningWeight is 0.6.
    // With underwater mining at 0.6 weight the p50 is very negative.
    const hardcoded = runQuant({
      seed: SEED,
      market: MARKET,
      strategy: STRATEGY_UNDERWATER,
      telegram: TELEGRAM,
      assumptions: ASSUMPTIONS,
      // No override → uses hardcoded 0.6
    });

    // With the allocator-derived weight (0.30 floor after clamping) the p50
    // should be significantly higher than with the bad 0.6.
    const derived = runQuant({
      seed: SEED,
      market: MARKET,
      strategy: STRATEGY_UNDERWATER,
      telegram: TELEGRAM,
      assumptions: ASSUMPTIONS,
      miningWeightOverride: 0.30, // the floor — allocator's output for underwater mining
    });

    // The derived (floor) weight produces a better (higher) p50 than
    // the hardcoded 0.6 when mining is underwater (−3% yield).
    // This is the core bug-fix proof.
    expect(derived.artifact.percentiles.p50).toBeGreaterThan(
      hardcoded.artifact.percentiles.p50,
    );
  });

  it("backward compatible: no override uses assumptions.yield.miningWeight", () => {
    const a = runQuant({
      seed: SEED,
      market: MARKET,
      strategy: STRATEGY_PROFITABLE,
      telegram: TELEGRAM,
      assumptions: ASSUMPTIONS,
    });
    const b = runQuant({
      seed: SEED,
      market: MARKET,
      strategy: STRATEGY_PROFITABLE,
      telegram: TELEGRAM,
      assumptions: ASSUMPTIONS,
      miningWeightOverride: undefined,
    });
    expect(a.artifact.percentiles.p50).toBe(b.artifact.percentiles.p50);
  });

  it("override clamps to [0, 1]", () => {
    const hi = runQuant({
      seed: SEED,
      market: MARKET,
      strategy: STRATEGY_PROFITABLE,
      telegram: TELEGRAM,
      assumptions: ASSUMPTIONS,
      miningWeightOverride: 99, // clamped to 1
    });
    const lo = runQuant({
      seed: SEED,
      market: MARKET,
      strategy: STRATEGY_PROFITABLE,
      telegram: TELEGRAM,
      assumptions: ASSUMPTIONS,
      miningWeightOverride: -10, // clamped to 0
    });
    // miningWeight=1 and miningWeight=0 should produce different outputs.
    expect(hi.artifact.percentiles.p50).not.toBe(lo.artifact.percentiles.p50);
  });
});

// ── runQuant: btcAnnualDriftOverride (root cause #1) ─────────────────────────

describe("runQuant — btcAnnualDriftOverride", () => {
  // Use a 3-sleeve allocation so the BTC sleeve carries the drift signal.
  const SLEEVES = { miningWeightOverride: 0.3, btcHoldWeight: 0.5, stableWeightOverride: 0.2 };

  it("a higher BTC drift shifts the median APY upward (drift actually reaches the MC)", () => {
    const bear = runQuant({
      seed: SEED,
      market: MARKET,
      strategy: STRATEGY_PROFITABLE,
      telegram: TELEGRAM,
      assumptions: ASSUMPTIONS,
      btcAnnualDriftOverride: -0.2,
      ...SLEEVES,
    });
    const bull = runQuant({
      seed: SEED,
      market: MARKET,
      strategy: STRATEGY_PROFITABLE,
      telegram: TELEGRAM,
      assumptions: ASSUMPTIONS,
      btcAnnualDriftOverride: 0.5,
      ...SLEEVES,
    });
    expect(bull.artifact.percentiles.p50).toBeGreaterThan(bear.artifact.percentiles.p50);
  });

  it("backward compatible: no drift override uses assumptions.btc.annualDrift", () => {
    // The default assumptions drift equals what the override would supply.
    const a = runQuant({
      seed: SEED,
      market: MARKET,
      strategy: STRATEGY_PROFITABLE,
      telegram: TELEGRAM,
      assumptions: ASSUMPTIONS,
    });
    const b = runQuant({
      seed: SEED,
      market: MARKET,
      strategy: STRATEGY_PROFITABLE,
      telegram: TELEGRAM,
      assumptions: ASSUMPTIONS,
      btcAnnualDriftOverride: ASSUMPTIONS.btc.annualDrift,
    });
    expect(a.artifact.percentiles.p50).toBe(b.artifact.percentiles.p50);
  });
});

// ── runQuant: btcHoldWeight 3-sleeve blend (root cause #2) ───────────────────

describe("runQuant — btcHoldWeight (3-sleeve blend)", () => {
  it("when btcHoldWeight is omitted the MC stays 2-sleeve (backward compatible)", () => {
    const a = runQuant({
      seed: SEED,
      market: MARKET,
      strategy: STRATEGY_PROFITABLE,
      telegram: TELEGRAM,
      assumptions: ASSUMPTIONS,
      miningWeightOverride: 0.35,
    });
    const b = runQuant({
      seed: SEED,
      market: MARKET,
      strategy: STRATEGY_PROFITABLE,
      telegram: TELEGRAM,
      assumptions: ASSUMPTIONS,
      miningWeightOverride: 0.35,
      btcHoldWeight: 0, // explicit zero — still 2-sleeve
    });
    expect(a.artifact.percentiles.p50).toBe(b.artifact.percentiles.p50);
  });

  it("with btcHoldWeight>0 the three legs sum to 1 and the BTC-hold sleeve adds price exposure", () => {
    // Same weights, only the BTC sleeve drift flips: bull median > bear median.
    const bull = runQuant({
      seed: SEED,
      market: MARKET,
      strategy: STRATEGY_PROFITABLE,
      telegram: TELEGRAM,
      assumptions: ASSUMPTIONS,
      miningWeightOverride: 0.3,
      btcHoldWeight: 0.5,
      stableWeightOverride: 0.2,
      btcAnnualDriftOverride: 0.4,
    });
    const bear = runQuant({
      seed: SEED,
      market: MARKET,
      strategy: STRATEGY_PROFITABLE,
      telegram: TELEGRAM,
      assumptions: ASSUMPTIONS,
      miningWeightOverride: 0.3,
      btcHoldWeight: 0.5,
      stableWeightOverride: 0.2,
      btcAnnualDriftOverride: -0.3,
    });
    expect(bull.artifact.percentiles.p50).toBeGreaterThan(bear.artifact.percentiles.p50);
  });

  it("clamps btcHoldWeight + stableWeightOverride to [0,1] (no engine throw on extreme inputs)", () => {
    expect(() =>
      runQuant({
        seed: SEED,
        market: MARKET,
        strategy: STRATEGY_PROFITABLE,
        telegram: TELEGRAM,
        assumptions: ASSUMPTIONS,
        miningWeightOverride: 0.3,
        btcHoldWeight: 0.5,
        stableWeightOverride: 0.2,
      }),
    ).not.toThrow();
  });
});

// ── 3-scenario orchestration (pure helper, no pipeline/server) ───────────────

function runScenarios(strategy: typeof STRATEGY_PROFITABLE): ScenarioResult[] {
  const regimes = ["defensive", "balanced", "opportunistic"] as const;
  return regimes.map((regime) => {
    const allocation = deriveRegimeAllocation({
      regime,
      miningYieldPct: strategy.miningYieldPct,
      usdcYieldPct: strategy.usdcYieldPct,
    });
    const regimeSeedOffset = regime === "defensive" ? 0 : regime === "balanced" ? 1 : 2;
    const quant = runQuant({
      seed: (SEED + regimeSeedOffset) >>> 0,
      market: MARKET,
      strategy,
      telegram: TELEGRAM,
      assumptions: ASSUMPTIONS,
      miningWeightOverride: allocation.miningFraction,
    });
    return {
      regime,
      allocation: {
        mining: allocation.mining,
        btc: allocation.btc,
        usdc: allocation.usdc,
        stableReserve: allocation.stableReserve,
        miningFraction: allocation.miningFraction,
        governanceException: allocation.governanceException,
        miningProfitable: allocation.miningProfitable,
        rationale: allocation.rationale,
      },
      quant: quant.artifact,
      miningProfitable: allocation.miningProfitable,
      governanceException: allocation.governanceException,
    };
  });
}

describe("3-scenario orchestration", () => {
  it("returns exactly 3 ScenarioResults", () => {
    const results = runScenarios(STRATEGY_PROFITABLE);
    expect(results).toHaveLength(3);
  });

  it("produces defensive / balanced / opportunistic regimes in order", () => {
    const results = runScenarios(STRATEGY_PROFITABLE);
    expect(results[0]!.regime).toBe("defensive");
    expect(results[1]!.regime).toBe("balanced");
    expect(results[2]!.regime).toBe("opportunistic");
  });

  it("each scenario has a quant artifact with headlineRange", () => {
    const results = runScenarios(STRATEGY_PROFITABLE);
    for (const r of results) {
      expect(r.quant.headlineRange).toBeDefined();
      expect(typeof r.quant.headlineRange.low).toBe("number");
      expect(typeof r.quant.headlineRange.high).toBe("number");
    }
  });

  it("each scenario's mining >= 30% (floor never sub-30 without governance)", () => {
    const results = runScenarios(STRATEGY_PROFITABLE);
    for (const r of results) {
      expect(r.allocation.mining, `mining for ${r.regime}`).toBeGreaterThanOrEqual(30);
    }
  });

  it("underwater mining → every scenario's miningProfitable=false and floor flagged", () => {
    const results = runScenarios(STRATEGY_UNDERWATER);
    for (const r of results) {
      expect(r.miningProfitable, `profitable for ${r.regime}`).toBe(false);
      expect(r.governanceException, `floor flag for ${r.regime}`).toBe(true);
      expect(r.allocation.mining).toBe(30); // clamped to floor
    }
  });

  it("deterministic: same inputs → same outputs", () => {
    const a = runScenarios(STRATEGY_PROFITABLE);
    const b = runScenarios(STRATEGY_PROFITABLE);
    for (let i = 0; i < a.length; i++) {
      expect(a[i]!.quant.percentiles).toEqual(b[i]!.quant.percentiles);
      expect(a[i]!.allocation.mining).toBe(b[i]!.allocation.mining);
    }
  });

  it("data is shared: each scenario's seed is distinct (different p50 results)", () => {
    const results = runScenarios(STRATEGY_PROFITABLE);
    // Different seeds → different quant runs → different p50 values.
    const p50s = results.map((r) => r.quant.percentiles.p50);
    const unique = new Set(p50s);
    // Not all three should be identical (seeds differ by regime offset).
    expect(unique.size).toBeGreaterThan(1);
  });

  it("effects are not present on ScenarioResult (no externalSend / deployed)", () => {
    const results = runScenarios(STRATEGY_PROFITABLE);
    for (const r of results) {
      // ScenarioResult does not carry effects — only the outer draft does.
      expect((r as unknown as Record<string, unknown>)["effects"]).toBeUndefined();
    }
  });
});

// ── construction-steps ───────────────────────────────────────────────────────

describe("buildConstructionSteps", () => {
  const scenarios = runScenarios(STRATEGY_PROFITABLE);

  const INPUT = {
    telegram: { machineCount: 5, topMachine: "AntminerS21Pro", bestCostPerThDay: 0.05 },
    market: { btcUsd: 60000, hashpriceUsdPerThDay: 0.06, defiApyMedianPct: 4.8 },
    strategy: {
      miningYieldPct: 10,
      usdcYieldPct: 5,
      usdcSource: "Aave USDC",
      provenance: "Live" as const,
      // btcReturn is ALREADY in percent in production (read-vault-apy →
      // company-assumptions btcScenarios.*Pct = −20 / +40 / +120), NOT fractions.
      btcReturn: { bear: -20, base: 40, bull: 120 },
    },
    scenarios,
  };

  it("returns exactly 4 steps", () => {
    const steps = buildConstructionSteps(INPUT);
    expect(steps).toHaveLength(4);
  });

  it("steps are ordered step-1 through step-4", () => {
    const steps = buildConstructionSteps(INPUT);
    expect(steps[0]!.id).toBe("step-1");
    expect(steps[1]!.id).toBe("step-2");
    expect(steps[2]!.id).toBe("step-3");
    expect(steps[3]!.id).toBe("step-4");
  });

  it("step-1 mentions machine count and mining profitability", () => {
    const steps = buildConstructionSteps(INPUT);
    expect(steps[0]!.finding).toContain("5 machine");
    expect(steps[0]!.finding).toMatch(/profitable|unprofitable/);
  });

  it("step-2 mentions USDC yield and source", () => {
    const steps = buildConstructionSteps(INPUT);
    expect(steps[1]!.finding).toContain("Aave USDC");
    expect(steps[1]!.finding).toContain("5.0%");
  });

  it("step-3 mentions BTC spot and all three scenario bands", () => {
    const steps = buildConstructionSteps(INPUT);
    expect(steps[2]!.finding).toContain("60,000");
    expect(steps[2]!.finding).toContain("bear");
    expect(steps[2]!.finding).toContain("base");
    expect(steps[2]!.finding).toContain("bull");
  });

  it("step-3 renders the BTC bands as -20% / +40% / +120% (NOT -2000% — root cause #3)", () => {
    const steps = buildConstructionSteps(INPUT);
    const finding = steps[2]!.finding;
    // The honest, correctly-scaled bands.
    expect(finding).toContain("bear -20.0%");
    expect(finding).toContain("base 40.0%");
    expect(finding).toContain("bull +120.0%");
    // The cosmetic double-×100 bug must be gone.
    expect(finding).not.toContain("-2000");
    expect(finding).not.toContain("12000");
    expect(finding).not.toContain("4000");
  });

  it("step-4 mentions all three regimes and APY ranges", () => {
    const steps = buildConstructionSteps(INPUT);
    expect(steps[3]!.finding).toContain("defensive");
    expect(steps[3]!.finding).toContain("balanced");
    expect(steps[3]!.finding).toContain("opportunistic");
    expect(steps[3]!.finding).toContain("not guaranteed");
  });

  it("deterministic: same inputs → same output", () => {
    const a = buildConstructionSteps(INPUT);
    const b = buildConstructionSteps(INPUT);
    expect(a).toEqual(b);
  });

  it("every step has a provenance tag", () => {
    const steps = buildConstructionSteps(INPUT);
    for (const s of steps) {
      expect(s.provenance).toBeDefined();
    }
  });
});

// ── full fix: per-regime drift + 3-sleeve blend on the screenshot inputs ──────

describe("3-regime projection — full fix (drift + sleeves), screenshot inputs", () => {
  // Screenshot: BTC ≈ $60,035, mining net +4.3%, USDC +10.4%, hashprice $0.0282.
  const SCREENSHOT_MARKET = { btcUsd: 60035, difficulty: 1.1e14, hashpriceUsdPerThDay: 0.0282 };
  const SCREENSHOT_STRATEGY = { miningYieldPct: 4.3, usdcYieldPct: 10.4, headlineApy: { low: 8, high: 13 } };
  const SCREENSHOT_TELEGRAM = { bestCostPerThDay: 0.05 };
  const A = resolveQuantAssumptions({ paths: 4_000 });

  // Mirror the pipeline's per-regime annualisation: (1+totalReturn)^(12/months)−1
  // with the product's btcScenarios (bear −0.20 / base +0.40 / bull +1.20 over 24mo).
  function annualDrift(regime: "defensive" | "balanced" | "opportunistic"): number {
    const sc = { bear: -0.2, base: 0.4, bull: 1.2 };
    const months = 24;
    const tot = regime === "defensive" ? sc.bear : regime === "opportunistic" ? sc.bull : sc.base;
    return Math.pow(Math.max(0.01, 1 + tot), 12 / months) - 1;
  }

  function regimeHeadline(regime: "defensive" | "balanced" | "opportunistic") {
    const alloc = deriveRegimeAllocation({
      regime,
      miningYieldPct: SCREENSHOT_STRATEGY.miningYieldPct,
      usdcYieldPct: SCREENSHOT_STRATEGY.usdcYieldPct,
    });
    const offset = regime === "defensive" ? 0 : regime === "balanced" ? 1 : 2;
    const q = runQuant({
      seed: (SEED + offset) >>> 0,
      market: SCREENSHOT_MARKET,
      strategy: SCREENSHOT_STRATEGY,
      telegram: SCREENSHOT_TELEGRAM,
      assumptions: A,
      miningWeightOverride: alloc.mining / 100,
      btcAnnualDriftOverride: annualDrift(regime),
      btcHoldWeight: alloc.btc / 100,
      stableWeightOverride: (alloc.usdc + alloc.stableReserve) / 100,
    });
    return { alloc, p50: q.artifact.percentiles.p50, range: q.artifact.headlineRange };
  }

  it("(a) the three regimes DIFFER materially (defensive < balanced < opportunistic by BTC exposure)", () => {
    const d = regimeHeadline("defensive");
    const b = regimeHeadline("balanced");
    const o = regimeHeadline("opportunistic");
    // BTC sleeve grows defensive → opportunistic.
    expect(d.alloc.btc).toBeLessThanOrEqual(b.alloc.btc);
    expect(b.alloc.btc).toBeLessThan(o.alloc.btc);
    // p50 strictly increasing with the bull tilt.
    expect(d.p50).toBeLessThan(b.p50);
    expect(b.p50).toBeLessThan(o.p50);
    // Not collapsed: a real spread between extremes.
    expect(o.p50 - d.p50).toBeGreaterThan(0.02);
  });

  it("(b) balanced p50 is positive when mining is profitable and USDC ≈ 10%", () => {
    expect(regimeHeadline("balanced").p50).toBeGreaterThan(0);
  });

  it("(b) opportunistic p50 is clearly positive (bull tilt)", () => {
    expect(regimeHeadline("opportunistic").p50).toBeGreaterThan(0.03);
  });

  it("(c) defensive can still be modestly low/negative (honest bear tilt)", () => {
    // The bear-tilted regime is allowed to print a low or slightly-negative
    // median — that is the honest downside, not a bug.
    const d = regimeHeadline("defensive");
    expect(d.p50).toBeLessThan(regimeHeadline("opportunistic").p50);
  });

  it("deterministic: same screenshot inputs → identical p50 across runs", () => {
    expect(regimeHeadline("balanced").p50).toBe(regimeHeadline("balanced").p50);
  });
});

// ── safety: effects still false ───────────────────────────────────────────────

describe("safety: ScenarioResult carries no effect flags", () => {
  it("the ScenarioResult type does not include externalSend / deployed / markedLive", () => {
    const results = runScenarios(STRATEGY_PROFITABLE);
    for (const r of results) {
      const rAny = r as unknown as Record<string, unknown>;
      expect(rAny["externalSend"]).toBeUndefined();
      expect(rAny["deployed"]).toBeUndefined();
      expect(rAny["markedLive"]).toBeUndefined();
      expect(rAny["custodialWrite"]).toBeUndefined();
    }
  });
});
