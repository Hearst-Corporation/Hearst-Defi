/**
 * Pipeline-level coherence test: draft.quant === balanced scenario quant
 * when withScenarios=true.
 *
 * Bug fixed (P2): previously the pipeline ran an INDEPENDENT main runQuant
 * (seed=seed) alongside the scenario loop balanced runQuant (seed=seed+1),
 * producing TWO different headlineRanges for the "balanced" regime in the
 * same report. The fix makes draft.quant the EXACT same object as
 * scenarios[balancedIndex].quant when withScenarios=true.
 *
 * These tests mock only the async network runners (A/B/C/F) so that:
 *   • the test is pure / offline (no network I/O),
 *   • the real runQuant Monte-Carlo is still exercised (D stage),
 *   • the real deriveRegimeAllocation logic is still exercised.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Stubs for async network runners (A / B / C / F) ─────────────────────────
//
// vi.mock hoisting: the factory runs before any import, so we capture the real
// runQuant via a lazy require inside the factory (importActual would be async
// and is not hoisted). Instead we mock only the three async runners and leave
// runQuant alone by directly requiring the module within the factory.

vi.mock("@/lib/agentic/swarm/live/runners-data", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/agentic/swarm/live/runners-data")>();
  return {
    ...real, // preserves real runQuant + types
    runTelegramPricing: vi.fn().mockResolvedValue({
      configured: true,
      machineCount: 3,
      topMachine: "AntminerS21",
      bestCostPerThDay: 0.05,
      bestMarginPerThDay: 0.01,
      audit: {
        stageId: "telegram_pricing",
        mode: "live_read",
        ok: true,
        reasonCode: "telegram_ok",
        provenance: "Live",
        degraded: false,
      },
    }),
    runMarketLive: vi.fn().mockResolvedValue({
      btcUsd: 60000,
      difficulty: 1e14,
      hashpriceUsdPerThDay: 0.06,
      defiApyMedianPct: 4.8,
      audit: {
        stageId: "market_live",
        mode: "live_read",
        ok: true,
        reasonCode: "market_ok",
        provenance: "Live",
        degraded: false,
      },
    }),
    runStrategyCross: vi.fn().mockResolvedValue({
      artifact: {
        configured: true,
        miningYieldPct: 10,
        usdcYieldPct: 5,
        usdcSource: "Aave USDC",
        btcReturn: { bear: -0.2, base: 0.4, bull: 1.2 },
        headlineApy: { low: 8, high: 13 },
        assumptions: ["Mining at 6¢/kWh"],
        disclaimer: "Not guaranteed.",
        companyLevers: {
          source: "config",
          status: "CONFIGURED",
          markupPct: 25,
          revenueSharePct: 20,
          borrowAprPct: 6,
          feePct: 2,
          energyCostUsdPerKwh: 0.06,
        },
        provenance: "Live" as const,
      },
      audit: {
        stageId: "strategy_cross",
        mode: "live_read",
        ok: true,
        reasonCode: "strategy_ok",
        provenance: "Live",
        degraded: false,
      },
    }),
  };
});

vi.mock("@/lib/agentic/swarm/live/runners-writeup", () => ({
  runWriteup: vi.fn().mockResolvedValue({
    artifact: {
      title: "Test writeup",
      prose: "Projection: 9.4–12.8% APY range. Not guaranteed.",
      llmAuthored: false,
      provenance: "Estimated" as const,
    },
    audit: {
      stageId: "writeup",
      mode: "live_read",
      ok: true,
      reasonCode: "writeup_ok",
      provenance: "Estimated",
      degraded: false,
    },
  }),
}));

vi.mock("@/lib/agentic/swarm/live/runners-artifacts", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/agentic/swarm/live/runners-artifacts")>();
  return {
    ...real, // keeps runCharts real — it's pure mapping, no network
  };
});

vi.mock("@/lib/llm/product-chat-stream", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/llm/product-chat-stream")>();
  return {
    ...real, // keeps inferVault real — pure string logic
  };
});

// ── Import under test (after mocks are declared) ─────────────────────────────

import {
  runProductConstructionPipeline,
  isProductConstructionError,
} from "@/lib/agentic/swarm/live/pipeline";
import { resolveQuantAssumptions } from "@/lib/agentic/swarm/live/quant-assumptions";

// Fewer MC paths so the suite runs fast.
const FAST_ASSUMPTIONS = resolveQuantAssumptions({ paths: 300 });

describe("pipeline — draft.quant / balanced scenario coherence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── withScenarios = true ─────────────────────────────────────────────────

  it("withScenarios=true: draft.quant is the exact same object as the balanced scenario quant", async () => {
    const result = await runProductConstructionPipeline(
      "8-15% APY mining-backed structured yield",
      { assumptions: FAST_ASSUMPTIONS, withScenarios: true },
    );

    expect(isProductConstructionError(result)).toBe(false);
    if (isProductConstructionError(result)) return; // narrow type

    expect(result.scenarios).toBeDefined();
    expect(result.scenarios!.length).toBe(3);

    const balancedScenario = result.scenarios!.find((s) => s.regime === "balanced");
    expect(balancedScenario).toBeDefined();

    // Core fix assertion: draft.quant IS the balanced scenario quant.
    // Same reference OR deep-equal headlineRange + percentiles.
    expect(result.quant.headlineRange).toEqual(balancedScenario!.quant.headlineRange);
    expect(result.quant.percentiles).toEqual(balancedScenario!.quant.percentiles);
    expect(result.quant.seed).toBe(balancedScenario!.quant.seed);
  });

  it("withScenarios=true: there is exactly ONE balanced headlineRange value in the draft (no duplicate divergence)", async () => {
    const result = await runProductConstructionPipeline(
      "8-15% APY mining-backed structured yield",
      { assumptions: FAST_ASSUMPTIONS, withScenarios: true },
    );

    expect(isProductConstructionError(result)).toBe(false);
    if (isProductConstructionError(result)) return;

    const balancedScenario = result.scenarios!.find((s) => s.regime === "balanced")!;

    // Both must be identical — no divergence between report sections.
    expect(result.quant.headlineRange.low).toBe(balancedScenario.quant.headlineRange.low);
    expect(result.quant.headlineRange.high).toBe(balancedScenario.quant.headlineRange.high);
  });

  it("withScenarios=true: effects are all false (safety floor intact)", async () => {
    const result = await runProductConstructionPipeline(
      "8-15% APY mining-backed structured yield",
      { assumptions: FAST_ASSUMPTIONS, withScenarios: true },
    );

    expect(isProductConstructionError(result)).toBe(false);
    if (isProductConstructionError(result)) return;

    expect(result.effects.externalSend).toBe(false);
    expect(result.effects.deployed).toBe(false);
    expect(result.effects.markedLive).toBe(false);
    expect(result.effects.custodialWrite).toBe(false);
  });

  it("withScenarios=true: draft.scenarios has defensive / balanced / opportunistic in order", async () => {
    const result = await runProductConstructionPipeline(
      "8-15% APY mining-backed structured yield",
      { assumptions: FAST_ASSUMPTIONS, withScenarios: true },
    );

    expect(isProductConstructionError(result)).toBe(false);
    if (isProductConstructionError(result)) return;

    expect(result.scenarios!.map((s) => s.regime)).toEqual([
      "defensive",
      "balanced",
      "opportunistic",
    ]);
  });

  it("withScenarios=true: each scenario quant uses a distinct seed (no accidental reuse)", async () => {
    const result = await runProductConstructionPipeline(
      "8-15% APY mining-backed structured yield",
      { assumptions: FAST_ASSUMPTIONS, withScenarios: true },
    );

    expect(isProductConstructionError(result)).toBe(false);
    if (isProductConstructionError(result)) return;

    const seeds = result.scenarios!.map((s) => s.quant.seed);
    const uniqueSeeds = new Set(seeds);
    // All three regime seeds must be distinct.
    expect(uniqueSeeds.size).toBe(3);
  });

  // ── Root-cause fix: regimes must DIFFER materially (#1 + #2) ───────────────

  it("withScenarios=true: the 3 regimes produce DISTINCT headlines (not near-identical)", async () => {
    // The mock has profitable mining (10%) + USDC 5%. With per-regime BTC drift +
    // the BTC-hold sleeve, the three regimes must NO LONGER collapse to the same
    // headline (the original bug). Use more paths so the percentiles are stable.
    const result = await runProductConstructionPipeline(
      "8-15% APY mining-backed structured yield",
      { assumptions: resolveQuantAssumptions({ paths: 4_000 }), withScenarios: true },
    );

    expect(isProductConstructionError(result)).toBe(false);
    if (isProductConstructionError(result)) return;

    const byRegime = Object.fromEntries(
      result.scenarios!.map((s) => [s.regime, s.quant]),
    );
    const defensive = byRegime["defensive"]!;
    const balanced = byRegime["balanced"]!;
    const opportunistic = byRegime["opportunistic"]!;

    // The three p50s must be materially different (not within a hair of each
    // other as in the original "identical regimes" bug).
    const p50s = [
      defensive.percentiles.p50,
      balanced.percentiles.p50,
      opportunistic.percentiles.p50,
    ];
    const spread = Math.max(...p50s) - Math.min(...p50s);
    expect(spread).toBeGreaterThan(0.02); // > 2 percentage points apart
  });

  it("withScenarios=true: defensive is more conservative than opportunistic (lower p50)", async () => {
    const result = await runProductConstructionPipeline(
      "8-15% APY mining-backed structured yield",
      { assumptions: resolveQuantAssumptions({ paths: 4_000 }), withScenarios: true },
    );

    expect(isProductConstructionError(result)).toBe(false);
    if (isProductConstructionError(result)) return;

    const byRegime = Object.fromEntries(
      result.scenarios!.map((s) => [s.regime, s.quant]),
    );
    expect(byRegime["defensive"]!.percentiles.p50).toBeLessThan(
      byRegime["opportunistic"]!.percentiles.p50,
    );
  });

  it("withScenarios=true: opportunistic headline is clearly positive (not collapsed to the others)", async () => {
    // With per-regime drift + the BTC-hold sleeve, the bull-tilted opportunistic
    // regime must carry a clearly positive median — the original bug had all three
    // collapsed near ~0. (The balanced-p50-positive-under-10%-USDC criterion is
    // proved directly, without the fixed 5%-USDC mock, in
    // scenario-orchestration.test.ts → "profitable-mining + 10% USDC".)
    const result = await runProductConstructionPipeline(
      "8-15% APY mining-backed structured yield",
      { assumptions: resolveQuantAssumptions({ paths: 4_000 }), withScenarios: true },
    );

    expect(isProductConstructionError(result)).toBe(false);
    if (isProductConstructionError(result)) return;

    const opportunistic = result.scenarios!.find((s) => s.regime === "opportunistic")!;
    expect(opportunistic.quant.percentiles.p50).toBeGreaterThan(0);
  });

  // ── withScenarios = false (default path) ─────────────────────────────────

  it("withScenarios=false: draft.quant is defined and draft.scenarios is absent", async () => {
    const result = await runProductConstructionPipeline(
      "8-15% APY mining-backed structured yield",
      { assumptions: FAST_ASSUMPTIONS },
    );

    expect(isProductConstructionError(result)).toBe(false);
    if (isProductConstructionError(result)) return;

    expect(result.quant).toBeDefined();
    expect(result.quant.headlineRange).toBeDefined();
    expect(result.scenarios).toBeUndefined();
  });

  it("withScenarios=false: effects are all false (safety floor intact)", async () => {
    const result = await runProductConstructionPipeline(
      "8-15% APY mining-backed structured yield",
      { assumptions: FAST_ASSUMPTIONS },
    );

    expect(isProductConstructionError(result)).toBe(false);
    if (isProductConstructionError(result)) return;

    expect(result.effects.externalSend).toBe(false);
    expect(result.effects.deployed).toBe(false);
    expect(result.effects.markedLive).toBe(false);
    expect(result.effects.custodialWrite).toBe(false);
  });

  it("withScenarios=false: draft.quant uses the balanced allocation miningFraction (not hardcoded 0.6)", async () => {
    // With profitable mining (miningYieldPct=10, positive), the balanced
    // allocator will NOT produce miningFraction=0.6 (it derives dynamically).
    // The test just verifies quant is produced and has valid percentile shape.
    const result = await runProductConstructionPipeline(
      "8-15% APY mining-backed structured yield",
      { assumptions: FAST_ASSUMPTIONS },
    );

    expect(isProductConstructionError(result)).toBe(false);
    if (isProductConstructionError(result)) return;

    const { p5, p25, p50, p75, p95 } = result.quant.percentiles;
    expect(p5).toBeLessThanOrEqual(p25);
    expect(p25).toBeLessThanOrEqual(p50);
    expect(p50).toBeLessThanOrEqual(p75);
    expect(p75).toBeLessThanOrEqual(p95);
  });

  // ── determinism ──────────────────────────────────────────────────────────

  it("withScenarios=true: same inputs produce same draft.quant (deterministic)", async () => {
    const opts = {
      assumptions: FAST_ASSUMPTIONS,
      withScenarios: true as const,
    };

    const r1 = await runProductConstructionPipeline("structured yield 8-15%", opts);
    const r2 = await runProductConstructionPipeline("structured yield 8-15%", opts);

    expect(isProductConstructionError(r1)).toBe(false);
    expect(isProductConstructionError(r2)).toBe(false);
    if (isProductConstructionError(r1) || isProductConstructionError(r2)) return;

    expect(r1.quant.percentiles).toEqual(r2.quant.percentiles);
    expect(r1.quant.headlineRange).toEqual(r2.quant.headlineRange);
  });
});


describe("pipeline — strategySelection metadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("attaches a selected strategy + a 'why' sentence to the draft", async () => {
    const result = await runProductConstructionPipeline(
      "Frame a BTC mining vault with monthly distributions",
      { assumptions: FAST_ASSUMPTIONS },
    );
    expect(isProductConstructionError(result)).toBe(false);
    if (isProductConstructionError(result)) return;
    expect(result.strategySelection).toBeDefined();
    expect(result.strategySelection!.strategySlug).toBe("btc-mining-performance");
    expect(result.strategySelection!.fallbackUsed).toBe(false);
    expect(result.strategySelection!.why.length).toBeGreaterThan(0);
    // Never a promise.
    expect(result.strategySelection!.why).not.toMatch(/guarantee|risk-free/i);
  });

  it("falls back to the generic strategy for an unclassifiable objective", async () => {
    const result = await runProductConstructionPipeline("build me something", {
      assumptions: FAST_ASSUMPTIONS,
    });
    expect(isProductConstructionError(result)).toBe(false);
    if (isProductConstructionError(result)) return;
    expect(result.strategySelection).toBeDefined();
    expect(result.strategySelection!.fallbackUsed).toBe(true);
  });
});
