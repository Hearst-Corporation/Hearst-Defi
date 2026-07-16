import { describe, expect, it } from "vitest";
import {
  runMiningNoteProjection,
  vendingRatio,
  isCurtailed,
  MINING_NOTE_DISCLAIMER,
} from "../mining-note-projection";
import type { MiningNoteInputs } from "../mining-note-types";

// Forbidden vocabulary (methodology v3.0 §9). "not guaranteed" is EXPLICITLY
// permitted, so the guard must not flag it: we check whole-word forbidden terms.
const FORBIDDEN = [
  "guaranteed",
  "guarantee",
  "promise",
  "certain",
  "will deliver",
  "will generate",
  "will produce",
  "risk-free",
  "riskless",
  "no risk",
  "zero risk",
];

// Permitted disclaimer phrases (methodology §9 allows "not guaranteed"; the
// repo-canonical §10 disclaimer states "does not guarantee future results" — the
// standard past-performance clause already cleared by the compliance guard).
// These are stripped before scanning so only forward-looking promises are caught.
const PERMITTED_PHRASES = [
  "not guaranteed",
  "does not guarantee future results",
  "are not guaranteed",
];

function scanForForbidden(text: string): string[] {
  let cleaned = text.toLowerCase();
  for (const phrase of PERMITTED_PHRASES) cleaned = cleaned.replaceAll(phrase, "");
  return FORBIDDEN.filter((word) => cleaned.includes(word));
}

const BASE_INPUTS: MiningNoteInputs = {
  principalUsdc: 1_000_000,
  btcPriceUsd: 60_000,
  deployedHashrateTh: 5_000,
  hashpriceUsdThDay: 0.09,
  uptimePct: 0.98,
  monthlyElectricityCostUsdc: 16_408,
  takeProfitTiers: [
    { btcPriceUsd: 90_000, sellBps: 1_000 },
    { btcPriceUsd: 120_000, sellBps: 2_000 },
  ],
  curtailment: {
    preHalvingThresholdUsd: 35_968,
    postHalvingThresholdUsd: 72_318,
    halvingMonth: 21,
  },
  monthlyBtcDriftPct: 0.02,
  bandMultipliers: { low: 0.7, high: 1.4 },
};

describe("runMiningNoteProjection — v3.0 mining note", () => {
  it("is deterministic: same input (and same seed) → byte-identical output", () => {
    const a = runMiningNoteProjection(BASE_INPUTS, { seed: 42 });
    const b = runMiningNoteProjection(BASE_INPUTS, { seed: 42 });
    expect(a).toStrictEqual(b);
  });

  it("is deterministic regardless of seed (base path uses no randomness)", () => {
    const a = runMiningNoteProjection(BASE_INPUTS, { seed: 1 });
    const b = runMiningNoteProjection(BASE_INPUTS, { seed: 999_999 });
    expect(a.btcAccumulatedRange).toStrictEqual(b.btcAccumulatedRange);
    expect(a.monthly).toStrictEqual(b.monthly);
  });

  it("emits a RANGE with low < high — never a single point", () => {
    const out = runMiningNoteProjection(BASE_INPUTS);
    expect(out.btcAccumulatedRange.low).toBeLessThan(out.btcAccumulatedRange.high);
    // The output shape is a range object, not a scalar.
    expect(out.btcAccumulatedRange).toHaveProperty("low");
    expect(out.btcAccumulatedRange).toHaveProperty("high");
    expect(typeof out.btcAccumulatedRange.low).toBe("number");
    expect(typeof out.btcAccumulatedRange.high).toBe("number");
  });

  it("runs the full 24-month term by default and accumulates positive BTC", () => {
    const out = runMiningNoteProjection(BASE_INPUTS);
    expect(out.monthly).toHaveLength(24);
    expect(out.monthly[0]!.month).toBe(1);
    expect(out.monthly[23]!.month).toBe(24);
    expect(out.btcAccumulatedRange.high).toBeGreaterThan(0);
  });

  it("honors an overridden term length", () => {
    const out = runMiningNoteProjection(BASE_INPUTS, { months: 12 });
    expect(out.monthly).toHaveLength(12);
    expect(out.monthly[11]!.vendingRatio).toBeCloseTo(1 - 12 / 12, 6);
  });

  it("carries estimated provenance and the verbatim disclaimer", () => {
    const out = runMiningNoteProjection(BASE_INPUTS);
    expect(out.provenance).toBe("estimated");
    expect(out.disclaimer).toBe(MINING_NOTE_DISCLAIMER);
    expect(out.disclaimer).toContain("not guaranteed");
  });

  it("exposes assumptions (non-negotiable #10)", () => {
    const out = runMiningNoteProjection(BASE_INPUTS);
    expect(out.assumptions.length).toBeGreaterThan(3);
    expect(out.assumptions.some((a) => a.includes("40%"))).toBe(true);
    expect(out.assumptions.some((a) => a.toLowerCase().includes("24 month"))).toBe(true);
  });

  it("uses no forbidden vocabulary anywhere in the output", () => {
    const out = runMiningNoteProjection(BASE_INPUTS);
    const blob = JSON.stringify({
      assumptions: out.assumptions,
      disclaimer: out.disclaimer,
    });
    expect(scanForForbidden(blob)).toEqual([]);
  });
});

describe("vendingRatio — B3 depletes to 0 at maturity", () => {
  it("is 1 − month/term and reaches 0 at the final month", () => {
    expect(vendingRatio(1, 24)).toBeCloseTo(1 - 1 / 24, 6);
    expect(vendingRatio(6, 24)).toBeCloseTo(0.75, 6);
    expect(vendingRatio(12, 24)).toBeCloseTo(0.5, 6);
    expect(vendingRatio(18, 24)).toBeCloseTo(0.25, 6);
    expect(vendingRatio(24, 24)).toBe(0);
  });

  it("clamps out-of-range months", () => {
    expect(vendingRatio(30, 24)).toBe(0);
    expect(vendingRatio(0, 24)).toBe(1);
    expect(vendingRatio(5, 0)).toBe(0);
  });

  it("the final projected month has vendingRatio 0 (B3 vended out)", () => {
    const out = runMiningNoteProjection(BASE_INPUTS);
    expect(out.monthly[23]!.vendingRatio).toBe(0);
  });
});

describe("isCurtailed — B1 paused below threshold", () => {
  it("fires below the pre-halving threshold", () => {
    expect(isCurtailed(30_000, 5, 21, 35_968, 72_318)).toBe(true);
    expect(isCurtailed(40_000, 5, 21, 35_968, 72_318)).toBe(false);
  });

  it("switches to the post-halving threshold past the halving month", () => {
    // $60k clears the pre-halving bar (month < 21) but not the post-halving bar.
    expect(isCurtailed(60_000, 20, 21, 35_968, 72_318)).toBe(false);
    expect(isCurtailed(60_000, 22, 21, 35_968, 72_318)).toBe(true);
  });

  it("a low starting BTC price curtails the fleet in the projection", () => {
    const curtailedInputs: MiningNoteInputs = {
      ...BASE_INPUTS,
      btcPriceUsd: 30_000,
      monthlyBtcDriftPct: 0,
    };
    const out = runMiningNoteProjection(curtailedInputs);
    expect(out.monthly[0]!.curtailed).toBe(true);
    expect(out.monthly[0]!.fleetActive).toBe(false);
    expect(out.monthly[0]!.miningRevenueUsd).toBe(0);
  });
});
