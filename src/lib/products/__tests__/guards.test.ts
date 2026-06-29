import { describe, expect, it } from "vitest";

import { BTC_MINING_PERFORMANCE_VAULT } from "@/lib/products/btc-mining-performance-vault";
import {
  validateTargetInclusion,
  assertNoDoubleCount,
  formatTargetsSafely,
  wouldDoubleCount,
  enforceMiningFloor,
  clampToFloorOrFlag,
  MINING_FLOOR,
} from "@/lib/products/guards";

const P = BTC_MINING_PERFORMANCE_VAULT;

describe("guards — target inclusion / double-count", () => {
  it("the 8–12% distribution is INCLUSIVE in the 20–24% total (not additive)", () => {
    const r = validateTargetInclusion(P);
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/inclusive/i);
    // alias has identical semantics
    expect(assertNoDoubleCount(P)).toEqual(r);
  });

  it("validateTargetInclusion fails if the product is not inclusive", () => {
    const broken = {
      ...P,
      totalPerformanceTarget: {
        ...P.totalPerformanceTarget,
        inclusiveOfDistributions: false as unknown as true,
      },
    };
    const r = validateTargetInclusion(broken);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/inclusive|additive/i);
  });

  it("wouldDoubleCount flags an additive attempt (distribution + total)", () => {
    // 24% distribution-cash layer + 20% total layer = a forbidden summed headline
    expect(wouldDoubleCount(0.24, 0.2)).toBe(true);
    expect(wouldDoubleCount(8, 20)).toBe(true);
  });

  it("wouldDoubleCount does not flag a zero/absent layer", () => {
    expect(wouldDoubleCount(0, 0.2)).toBe(false);
    expect(wouldDoubleCount(0.24, 0)).toBe(false);
    expect(wouldDoubleCount(NaN, 0.2)).toBe(false);
  });

  it("formatTargetsSafely yields the two honest strings and never a summed one", () => {
    const s = formatTargetsSafely(P);
    expect(s.distribution).toBe(
      "8–12% annualized monthly distribution target",
    );
    expect(s.total).toBe(
      "20–24% total target over ~24 months, inclusive of distributions",
    );
    // No summed figure (e.g. 28–36%, 32%, 44%) appears anywhere.
    const blob = `${s.distribution} ${s.total}`;
    expect(blob).not.toMatch(/28|32|36|44/);
    // The two layers are kept distinct, never joined with a "+".
    expect(blob).not.toContain("+");
  });
});

describe("guards — mining floor", () => {
  it("the floor constant is 0.30", () => {
    expect(MINING_FLOOR).toBe(0.3);
  });

  it("mining < 0.30 in NORMAL mode → requires_governance_exception", () => {
    const r = enforceMiningFloor(0.25, "NORMAL");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("requires_governance_exception");
  });

  it("sub-floor is permitted ONLY under protection/recovery governance", () => {
    expect(enforceMiningFloor(0.25, "PROTECTION_GOVERNANCE")).toEqual({
      ok: true,
      reason: "sub_floor_permitted_under_governance",
    });
    expect(enforceMiningFloor(0.25, "RECOVERY_GOVERNANCE")).toEqual({
      ok: true,
      reason: "sub_floor_permitted_under_governance",
    });
  });

  it("balanced mining (0.35) keeps mining ≥ 0.30 in NORMAL mode", () => {
    const r = enforceMiningFloor(0.35, "NORMAL");
    expect(r.ok).toBe(true);
    expect(r.reason).toBe("at_or_above_floor");
  });

  it("clampToFloorOrFlag clamps a NORMAL sub-floor up to the floor and flags it", () => {
    const r = clampToFloorOrFlag(0.2, "NORMAL");
    expect(r.miningPct).toBe(MINING_FLOOR);
    expect(r.flagged).toBe(true);
    expect(r.reason).toBe("requires_governance_exception");
  });

  it("clampToFloorOrFlag passes a sub-floor value through under governance, flagged", () => {
    const r = clampToFloorOrFlag(0.22, "RECOVERY_GOVERNANCE");
    expect(r.miningPct).toBe(0.22); // not silently clamped, but
    expect(r.flagged).toBe(true); // never silent — always flagged
    expect(r.reason).toBe("sub_floor_permitted_under_governance");
  });

  it("clampToFloorOrFlag leaves an at/above-floor value untouched and unflagged", () => {
    const r = clampToFloorOrFlag(0.35, "NORMAL");
    expect(r.miningPct).toBe(0.35);
    expect(r.flagged).toBe(false);
    expect(r.reason).toBe("at_or_above_floor");
  });
});
