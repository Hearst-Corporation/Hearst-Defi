import { describe, expect, it } from "vitest";

import {
  BASE_MIX_BY_MODE,
  buildSignal,
  evaluateRules,
  THRESHOLDS,
  type RebalanceSignal,
  type VaultStateForSignal,
} from "../rebalancing-rules";

import * as RebalancingRules from "../rebalancing-rules";

/**
 * Pure-engine tests for the rebalancing rule evaluator.
 * No mocks, no Prisma, no fetch — `evaluateRules` is a pure function.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ASOF = new Date("2026-05-20T12:00:00.000Z");

function buildHealthyState(): VaultStateForSignal {
  return {
    scenarioInputs: {
      btc_price_change_pct: 4,
      hashprice_usd_th_day: 0.082,
      energy_cost_kwh: 0.05,
      stable_apy_pct: 4.0,
      vol_index: 45,
    },
    mode: "balanced",
    riskScore: 42,
    miningMarginScore: 70,
    miningNetApyPct: 9.2,
    stableApyPct: 4.0,
    hashpriceTrendPct: -3.2,
    btcPositionPct: 14,
    btcUsd: 95_000,
    source: "db",
  };
}

function ruleIds(signals: RebalanceSignal[]): string[] {
  return signals.map((s) => s.ruleId);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("evaluateRules — pure engine library", () => {
  // ---- Case A: healthy state -> no signals --------------------------------

  it("Case A — healthy state: signals.length === 0", () => {
    const { signals } = evaluateRules({ state: buildHealthyState(), asOf: ASOF });
    expect(signals).toEqual([]);
  });

  // ---- Case B: R2 fires when margin < 50 ----------------------------------

  it("Case B — R2 (mining margin < 50): single signal with full PTAI fields", () => {
    const state: VaultStateForSignal = {
      ...buildHealthyState(),
      miningMarginScore: 40,
    };
    const { signals } = evaluateRules({ state, asOf: ASOF });

    expect(ruleIds(signals)).toContain("R2");
    const r2 = signals.find((s) => s.ruleId === "R2");
    expect(r2).toBeDefined();
    if (!r2) return;

    // PTAI: 4 fields all populated
    expect(r2.trigger.length).toBeGreaterThan(0);
    expect(r2.projection.length).toBeGreaterThan(0);
    expect(r2.action.length).toBeGreaterThan(0);
    expect(r2.impact.length).toBeGreaterThan(0);

    // APY mentions must be a range
    expect(r2.projection).toMatch(/\d+(\.\d+)?-\d+(\.\d+)?%/);
    expect(r2.impact).toMatch(/\d+(\.\d+)?-\d+(\.\d+)?%/);

    // From baseline = balanced
    expect(r2.fromAllocation).toEqual(BASE_MIX_BY_MODE.balanced);

    // Mining reduced by 30% (from 35 to round(35*0.7)=25 → shift=10)
    expect(r2.toAllocation.mining).toBe(25);
    expect(r2.toAllocation.stable_reserve).toBe(20); // 10 + 10
  });

  // ---- Case C: R3 fires on BTC momentum + healthy margin ------------------

  it("Case C — R3 (margin > 75 AND BTC > 0): single signal", () => {
    const state: VaultStateForSignal = {
      ...buildHealthyState(),
      miningMarginScore: 82,
      scenarioInputs: {
        ...buildHealthyState().scenarioInputs,
        btc_price_change_pct: 12,
      },
    };
    const { signals } = evaluateRules({ state, asOf: ASOF });
    expect(ruleIds(signals)).toEqual(["R3"]);
    const r3 = signals[0]!;
    expect(r3.toAllocation.mining).toBe(45);
    expect(r3.fromAllocation.mining).toBe(35);
  });

  // ---- Case D: Combined R3 + R-BTC-3 on rally + healthy margin ------------

  it("Case D — combined: R3 + R-BTC-3 fire together on BTC rally", () => {
    const state: VaultStateForSignal = {
      ...buildHealthyState(),
      miningMarginScore: 82,
      btcPositionPct: 14,
      scenarioInputs: {
        ...buildHealthyState().scenarioInputs,
        btc_price_change_pct: 35,
      },
    };
    const { signals } = evaluateRules({ state, asOf: ASOF });
    const ids = ruleIds(signals);
    expect(ids).toContain("R3");
    expect(ids).toContain("R-BTC-3");
    // Each ruleId only once
    expect(new Set(ids).size).toBe(ids.length);
  });

  // ---- Case E: R-BTC-1 fires on -20% drawdown + healthy margin ------------

  it("Case E — R-BTC-1 (BTC -25% AND margin >= 60 AND position < 20%)", () => {
    const state: VaultStateForSignal = {
      ...buildHealthyState(),
      mode: "balanced",
      miningMarginScore: 70,
      btcPositionPct: 14,
      scenarioInputs: {
        ...buildHealthyState().scenarioInputs,
        btc_price_change_pct: -25,
      },
    };
    const { signals } = evaluateRules({ state, asOf: ASOF });
    const ids = ruleIds(signals);
    expect(ids).toContain("R-BTC-1");
    expect(ids).toContain("R1"); // -25 also trips R1

    const rbtc1 = signals.find((s) => s.ruleId === "R-BTC-1");
    expect(rbtc1).toBeDefined();
    if (!rbtc1) return;
    expect(rbtc1.toAllocation.btc_tactical).toBe(20); // 15 + 5
    expect(rbtc1.toAllocation.usdc_base).toBe(35); // 40 - 5
  });

  // ---- Case F: Determinism / idempotency of evaluation --------------------

  it("Case F — pure idempotency: same input → byte-identical output", () => {
    const state: VaultStateForSignal = {
      ...buildHealthyState(),
      miningMarginScore: 40,
      scenarioInputs: {
        ...buildHealthyState().scenarioInputs,
        btc_price_change_pct: -30,
      },
    };
    const a = evaluateRules({ state, asOf: ASOF });
    const b = evaluateRules({ state, asOf: ASOF });
    const c = evaluateRules({ state, asOf: new Date("2099-01-01T00:00:00Z") });
    expect(a).toEqual(b);
    // asOf currently unused → output independent of asOf
    expect(a).toEqual(c);

    // Input must not be mutated
    expect(state.miningMarginScore).toBe(40);
    expect(state.scenarioInputs.btc_price_change_pct).toBe(-30);
  });

  // ---- PTAI invariants on a known-armed multi-rule scenario ---------------

  it("PTAI invariants — no forbidden words (bare), APY always a range", () => {
    const state: VaultStateForSignal = {
      ...buildHealthyState(),
      miningMarginScore: 40,
    };
    const { signals } = evaluateRules({ state, asOf: ASOF });
    expect(signals.length).toBeGreaterThan(0);

    const bareBadPattern = /(?<!\b(not|no|never|without)\s+(\w+\s+){0,3})\b(guarantee|promise|certain|will deliver|risk-free|no risk)\w*/i;

    for (const s of signals) {
      const all = [s.trigger, s.action, s.projection, s.impact].join(" ");
      expect(bareBadPattern.test(all)).toBe(false);

      // If APY is mentioned, must be a range.
      for (const text of [s.projection, s.impact]) {
        if (text.toLowerCase().includes("apy")) {
          expect(text).toMatch(/\d+(\.\d+)?-\d+(\.\d+)?%/);
        }
      }
    }
  });

  // ---- buildSignal forbidden-words guard ----------------------------------

  it("buildSignal throws on bare forbidden words", () => {
    expect(() =>
      buildSignal({
        ruleId: "TEST",
        trigger: "this is a guarantee",
        projection: "ok",
        action: "ok",
        impact: "ok",
        from: BASE_MIX_BY_MODE.balanced,
        to: BASE_MIX_BY_MODE.balanced,
      }),
    ).toThrow(/forbidden word/i);
  });

  it("buildSignal allows negated forms (e.g. 'not guaranteed')", () => {
    const signal = buildSignal({
      ruleId: "TEST",
      trigger: "ok",
      projection: "outcome is not guaranteed",
      action: "ok",
      impact: "ok",
      from: BASE_MIX_BY_MODE.balanced,
      to: BASE_MIX_BY_MODE.balanced,
    });
    expect(signal.ruleId).toBe("TEST");
    // Allocation snapshots are fresh copies
    expect(signal.fromAllocation).not.toBe(BASE_MIX_BY_MODE.balanced);
    expect(signal.toAllocation).not.toBe(BASE_MIX_BY_MODE.balanced);
  });

  // ---- Thresholds exported as a frozen constant ---------------------------

  it("THRESHOLDS exports spec values", () => {
    expect(THRESHOLDS.R1_BTC_DRAWDOWN_PCT).toBe(-25);
    expect(THRESHOLDS.R2_MARGIN_THRESHOLD).toBe(50);
    expect(THRESHOLDS.R3_MARGIN_THRESHOLD).toBe(75);
    expect(THRESHOLDS.R4_HASHPRICE_TREND_PCT).toBe(-20);
    expect(THRESHOLDS.RBTC_VOL_BREACH).toBe(90);
  });
});

// ---------------------------------------------------------------------------
// Missing-coverage tests — all untested rules + edge cases + combined
// ---------------------------------------------------------------------------

describe("evaluateRules — missing coverage", () => {
  // ---- R1 isolated: BTC -30% in balanced mode → switch to defensive -------

  it("R1 isolated — BTC -30% in balanced → defensive allocation", () => {
    const state: VaultStateForSignal = {
      ...buildHealthyState(),
      mode: "balanced",
      miningMarginScore: 70, // healthy — keeps R2/R-BTC-6 silent
      btcPositionPct: 5,     // < 20 keeps R-BTC-1 silent at -30%… wait, -30 ≤ -20 → R-BTC-1 fires too
      scenarioInputs: {
        ...buildHealthyState().scenarioInputs,
        btc_price_change_pct: -30,
      },
    };
    const { signals } = evaluateRules({ state, asOf: ASOF });
    const ids = ruleIds(signals);
    expect(ids).toContain("R1");

    const r1 = signals.find((s) => s.ruleId === "R1")!;
    expect(r1.toAllocation).toEqual({ mining: 25, btc_tactical: 5, usdc_base: 55, stable_reserve: 15 });
    expect(r1.fromAllocation).toEqual(BASE_MIX_BY_MODE.balanced);
  });

  it("R1 — already in defensive mode → no R1 signal", () => {
    const state: VaultStateForSignal = {
      ...buildHealthyState(),
      mode: "defensive",
      scenarioInputs: {
        ...buildHealthyState().scenarioInputs,
        btc_price_change_pct: -30,
      },
    };
    const { signals } = evaluateRules({ state, asOf: ASOF });
    expect(ruleIds(signals)).not.toContain("R1");
  });

  // ---- R4: hashprice trend ≤ -20% → human review, from = to ---------------

  it("R4 isolated — hashprice -25%: signals human review, allocation unchanged", () => {
    const state: VaultStateForSignal = {
      ...buildHealthyState(),
      hashpriceTrendPct: -25,
    };
    const { signals } = evaluateRules({ state, asOf: ASOF });
    const ids = ruleIds(signals);
    expect(ids).toContain("R4");

    const r4 = signals.find((s) => s.ruleId === "R4")!;
    // R4 is review-only: allocation must not change
    expect(r4.fromAllocation).toEqual(r4.toAllocation);
    expect(r4.action).toMatch(/human review/i);
  });

  it("R4 — hashprice exactly at threshold (-20%): fires", () => {
    const state: VaultStateForSignal = {
      ...buildHealthyState(),
      hashpriceTrendPct: THRESHOLDS.R4_HASHPRICE_TREND_PCT,
    };
    const { signals } = evaluateRules({ state, asOf: ASOF });
    expect(ruleIds(signals)).toContain("R4");
  });

  it("R4 — hashprice above threshold (-19%): does NOT fire", () => {
    const state: VaultStateForSignal = {
      ...buildHealthyState(),
      hashpriceTrendPct: -19,
    };
    const { signals } = evaluateRules({ state, asOf: ASOF });
    expect(ruleIds(signals)).not.toContain("R4");
  });

  // ---- R5: stable APY beats mining net APY by ≥ 1pp -----------------------

  it("R5 isolated — stable 11% > mining net 9.2% by ≥ 1pp → rotation", () => {
    const state: VaultStateForSignal = {
      ...buildHealthyState(),
      stableApyPct: 11.0,
      miningNetApyPct: 9.2,
      // mode = balanced → baseFrom.mining = 35 → rotation = min(10, 35-20) = 10
    };
    const { signals } = evaluateRules({ state, asOf: ASOF });
    expect(ruleIds(signals)).toContain("R5");

    const r5 = signals.find((s) => s.ruleId === "R5")!;
    expect(r5.toAllocation.mining).toBe(35 - 10); // 25
    expect(r5.toAllocation.usdc_base).toBe(40 + 10); // 50
  });

  it("R5 — gap < 1pp: does NOT fire", () => {
    const state: VaultStateForSignal = {
      ...buildHealthyState(),
      stableApyPct: 9.8,
      miningNetApyPct: 9.2, // gap = 0.6pp < 1pp
    };
    const { signals } = evaluateRules({ state, asOf: ASOF });
    expect(ruleIds(signals)).not.toContain("R5");
  });

  it("R5 — miningNetApyPct ≤ 0: does NOT fire (guard against negative margin)", () => {
    const state: VaultStateForSignal = {
      ...buildHealthyState(),
      stableApyPct: 8.0,
      miningNetApyPct: 0,
    };
    const { signals } = evaluateRules({ state, asOf: ASOF });
    expect(ruleIds(signals)).not.toContain("R5");
  });

  // ---- R-BTC-2: deep drawdown -35% T2 accumulation -------------------------

  it("R-BTC-2 isolated — BTC -40%, margin 65, position 20% (< 25 cap): T2 fires", () => {
    const state: VaultStateForSignal = {
      ...buildHealthyState(),
      mode: "balanced",
      miningMarginScore: 65,
      btcPositionPct: 20, // ≥ T1 cap (20) so R-BTC-1 silent; < T2 cap (25) so R-BTC-2 fires
      scenarioInputs: {
        ...buildHealthyState().scenarioInputs,
        btc_price_change_pct: -40,
      },
    };
    const { signals } = evaluateRules({ state, asOf: ASOF });
    const ids = ruleIds(signals);
    expect(ids).toContain("R-BTC-2");
    // R-BTC-1 should NOT fire since position >= T1_MAX_SIZE (20%)
    expect(ids).not.toContain("R-BTC-1");

    const rbtc2 = signals.find((s) => s.ruleId === "R-BTC-2")!;
    expect(rbtc2.toAllocation.btc_tactical).toBe(BASE_MIX_BY_MODE.balanced.btc_tactical + 5);
  });

  it("R-BTC-2 — position already ≥ 25%: does NOT fire", () => {
    const state: VaultStateForSignal = {
      ...buildHealthyState(),
      mode: "balanced",
      miningMarginScore: 70,
      btcPositionPct: 25,
      scenarioInputs: {
        ...buildHealthyState().scenarioInputs,
        btc_price_change_pct: -40,
      },
    };
    const { signals } = evaluateRules({ state, asOf: ASOF });
    expect(ruleIds(signals)).not.toContain("R-BTC-2");
  });

  // ---- R-BTC-4: take-profit T2 at +60% ------------------------------------

  it("R-BTC-4 isolated — BTC +65%, position 15% > 10% min: T2 take-profit fires", () => {
    const state: VaultStateForSignal = {
      ...buildHealthyState(),
      btcPositionPct: 15,
      scenarioInputs: {
        ...buildHealthyState().scenarioInputs,
        btc_price_change_pct: 65,
      },
    };
    const { signals } = evaluateRules({ state, asOf: ASOF });
    const ids = ruleIds(signals);
    expect(ids).toContain("R-BTC-4");
    // T1 also fires since +65% > +30%
    expect(ids).toContain("R-BTC-3");

    const rbtc4 = signals.find((s) => s.ruleId === "R-BTC-4")!;
    const sold = Math.round(15 * 0.25); // 4
    expect(rbtc4.toAllocation.btc_tactical).toBe(BASE_MIX_BY_MODE.balanced.btc_tactical - sold);
    expect(rbtc4.toAllocation.stable_reserve).toBe(BASE_MIX_BY_MODE.balanced.stable_reserve + sold);
  });

  it("R-BTC-4 — only +35% (< 60 threshold): T2 does NOT fire, T1 does", () => {
    const state: VaultStateForSignal = {
      ...buildHealthyState(),
      btcPositionPct: 15,
      scenarioInputs: {
        ...buildHealthyState().scenarioInputs,
        btc_price_change_pct: 35,
      },
    };
    const { signals } = evaluateRules({ state, asOf: ASOF });
    expect(ruleIds(signals)).toContain("R-BTC-3");
    expect(ruleIds(signals)).not.toContain("R-BTC-4");
  });

  // ---- R-BTC-5: volatility guardrail breach --------------------------------

  it("R-BTC-5 isolated — vol_index 95 > 90: halves tactical sleeve", () => {
    const state: VaultStateForSignal = {
      ...buildHealthyState(),
      scenarioInputs: {
        ...buildHealthyState().scenarioInputs,
        vol_index: 95,
      },
    };
    const { signals } = evaluateRules({ state, asOf: ASOF });
    expect(ruleIds(signals)).toContain("R-BTC-5");

    const rbtc5 = signals.find((s) => s.ruleId === "R-BTC-5")!;
    const baseBalanced = BASE_MIX_BY_MODE.balanced;
    const halved = Math.round(baseBalanced.btc_tactical / 2); // round(15/2) = 8
    expect(rbtc5.toAllocation.btc_tactical).toBe(halved);
    expect(rbtc5.toAllocation.stable_reserve).toBe(
      baseBalanced.stable_reserve + (baseBalanced.btc_tactical - halved),
    );
  });

  it("R-BTC-5 — vol exactly at threshold (90): does NOT fire (strictly >)", () => {
    const state: VaultStateForSignal = {
      ...buildHealthyState(),
      scenarioInputs: { ...buildHealthyState().scenarioInputs, vol_index: 90 },
    };
    const { signals } = evaluateRules({ state, asOf: ASOF });
    expect(ruleIds(signals)).not.toContain("R-BTC-5");
  });

  // ---- R-BTC-6: dead-code guard -------------------------------------------
  // R-BTC-6 shares the same condition as R2 (margin < 50) and guards itself
  // with `if (!r2Already)`. Since R2 always fires first when margin < 50,
  // r2Already is always true → R-BTC-6 can never be emitted in practice.
  // This test documents and locks that behaviour so any future refactor that
  // accidentally makes R-BTC-6 reachable via a different path will fail loudly.

  it("R-BTC-6 — never fires because R2 always pre-empts it (dead-code guard)", () => {
    // Worst case: margin < 50, btc_tactical > 0 — conditions R-BTC-6 needs.
    const state: VaultStateForSignal = {
      ...buildHealthyState(),
      mode: "balanced", // btc_tactical base = 15 > 0
      miningMarginScore: 30, // < 50 → R2 fires → r2Already = true → R-BTC-6 blocked
    };
    const { signals } = evaluateRules({ state, asOf: ASOF });
    expect(ruleIds(signals)).toContain("R2");
    expect(ruleIds(signals)).not.toContain("R-BTC-6");
  });

  // ---- Combined scenarios --------------------------------------------------

  it("Combined crash — BTC -40%, margin 30, hashprice -25%: R1+R2+R4+R-BTC-1 fire", () => {
    const state: VaultStateForSignal = {
      ...buildHealthyState(),
      mode: "balanced",
      miningMarginScore: 30,
      hashpriceTrendPct: -25,
      btcPositionPct: 14,
      scenarioInputs: {
        ...buildHealthyState().scenarioInputs,
        btc_price_change_pct: -40,
      },
    };
    const { signals } = evaluateRules({ state, asOf: ASOF });
    const ids = ruleIds(signals);
    expect(ids).toContain("R1");  // BTC -40% ≤ -25%
    expect(ids).toContain("R2");  // margin 30 < 50
    expect(ids).toContain("R4");  // hashprice -25% ≤ -20%
    // R-BTC-1: BTC -40% ≤ -20%, but margin 30 < 60 → does NOT fire
    expect(ids).not.toContain("R-BTC-1");
    // Each ruleId is unique
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("Combined rally — BTC +65%, margin 82: R3+R-BTC-3+R-BTC-4 fire", () => {
    const state: VaultStateForSignal = {
      ...buildHealthyState(),
      mode: "balanced",
      miningMarginScore: 82,
      btcPositionPct: 15,
      scenarioInputs: {
        ...buildHealthyState().scenarioInputs,
        btc_price_change_pct: 65,
      },
    };
    const { signals } = evaluateRules({ state, asOf: ASOF });
    const ids = ruleIds(signals);
    expect(ids).toContain("R3");
    expect(ids).toContain("R-BTC-3");
    expect(ids).toContain("R-BTC-4");
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("Combined stress + high vol — margin 40, vol 95: R2+R-BTC-5 fire", () => {
    const state: VaultStateForSignal = {
      ...buildHealthyState(),
      miningMarginScore: 40,
      scenarioInputs: {
        ...buildHealthyState().scenarioInputs,
        vol_index: 95,
      },
    };
    const { signals } = evaluateRules({ state, asOf: ASOF });
    const ids = ruleIds(signals);
    expect(ids).toContain("R2");
    expect(ids).toContain("R-BTC-5");
  });
});

// ---------------------------------------------------------------------------
// Purity guard — importing the module must not trigger I/O or side effects.
// We can't observe "no I/O" directly, but we can assert that the module
// exposes only function/constant exports, and that nothing throws or
// performs work at import time.
// ---------------------------------------------------------------------------

describe("rebalancing-rules module purity", () => {
  it("module exports only functions and plain data — no side effects on import", () => {
    expect(typeof RebalancingRules.evaluateRules).toBe("function");
    expect(typeof RebalancingRules.buildSignal).toBe("function");
    expect(typeof RebalancingRules.THRESHOLDS).toBe("object");
    expect(typeof RebalancingRules.BASE_MIX_BY_MODE).toBe("object");

    // No Prisma, no fetch, no fs symbols should leak.
    const exported = Object.keys(RebalancingRules);
    for (const key of exported) {
      expect(key).not.toMatch(/^(prisma|db|fetch|fs|process)$/i);
    }
  });
});
