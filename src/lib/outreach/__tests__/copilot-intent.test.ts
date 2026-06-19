import { describe, expect, it } from "vitest";

import { classifyOutreachIntent } from "@/lib/outreach/copilot-intent";
import { tierForScore, promoteTier, DEFAULT_TIER_THRESHOLDS } from "@/lib/outreach/tier";

describe("classifyOutreachIntent", () => {
  it("detects a sourcing ask with a count", () => {
    const i = classifyOutreachIntent("source 20 distributor leads");
    expect(i.kind).toBe("source");
    if (i.kind === "source") expect(i.count).toBe(20);
  });

  it("defaults the sourcing count when none is given", () => {
    const i = classifyOutreachIntent("find me some leads");
    expect(i).toEqual({ kind: "source", count: 12 });
  });

  it("clamps an absurd count to 50", () => {
    const i = classifyOutreachIntent("source 9999 leads");
    if (i.kind === "source") expect(i.count).toBe(50);
  });

  it("detects show-tier for prime / warm / cold", () => {
    expect(classifyOutreachIntent("show the prime leads")).toEqual({
      kind: "show_tier",
      tier: "A",
    });
    expect(classifyOutreachIntent("list tier B")).toEqual({
      kind: "show_tier",
      tier: "B",
    });
    expect(classifyOutreachIntent("who are the cold ones")).toEqual({
      kind: "show_tier",
      tier: "C",
    });
  });

  it("treats French naturally", () => {
    expect(classifyOutreachIntent("trouve 15 family offices").kind).toBe("source");
    expect(classifyOutreachIntent("combien de prospects ?").kind).toBe("stats");
  });

  it("falls back to help on empty, unknown on gibberish", () => {
    expect(classifyOutreachIntent("   ")).toEqual({ kind: "help" });
    expect(classifyOutreachIntent("asdfqwer").kind).toBe("unknown");
  });

  it("prioritises an explicit source verb over a tier word", () => {
    // "source the cold tier" — sourcing wins (it's the action).
    expect(classifyOutreachIntent("source cold leads").kind).toBe("source");
  });
});

describe("tierForScore", () => {
  it("maps scores to tiers on the default thresholds", () => {
    expect(tierForScore(90)).toBe("A");
    expect(tierForScore(85)).toBe("A");
    expect(tierForScore(70)).toBe("B");
    expect(tierForScore(60)).toBe("B");
    expect(tierForScore(45)).toBe("C");
    expect(tierForScore(40)).toBe("C");
    expect(tierForScore(39)).toBeNull();
    expect(tierForScore(0)).toBeNull();
  });

  it("defends against misordered thresholds", () => {
    // tierBMin > tierAMin should not let a 70 score outrank an 80 score's tier.
    const bad = { tierAMin: 50, tierBMin: 80, tierCMin: 40 };
    // aMin is clamped up to >= bMin (80), so 70 → C (>=40), 85 → A.
    expect(tierForScore(85, bad)).toBe("A");
    expect(tierForScore(70, bad)).toBe("C");
  });

  it("uses the agreed 85/60/40 defaults", () => {
    expect(DEFAULT_TIER_THRESHOLDS).toEqual({
      tierAMin: 85,
      tierBMin: 60,
      tierCMin: 40,
    });
  });
});

describe("promoteTier", () => {
  it("climbs one step toward prime, capping at A", () => {
    expect(promoteTier("C")).toBe("B");
    expect(promoteTier("B")).toBe("A");
    expect(promoteTier("A")).toBe("A");
  });
});
