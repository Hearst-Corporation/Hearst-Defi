/**
 * Tests for src/lib/outreach/send-policy.ts — pure, no IO.
 * Covers the tier × autonomy matrix (ADR-016), the warm-up cap curve, and the
 * priority queue comparator.
 */

import { describe, expect, it } from "vitest";

import {
  autonomyAtLeast,
  compareQueue,
  decideAutoSend,
  effectiveDailyCap,
  remainingDailyBudget,
  type Autonomy,
} from "@/lib/outreach/send-policy";
import type { Tier } from "@/lib/outreach/tier";

describe("autonomyAtLeast", () => {
  it("orders SUGGEST < SEND < NURTURE < CLOSED", () => {
    expect(autonomyAtLeast("SUGGEST", "SEND")).toBe(false);
    expect(autonomyAtLeast("SEND", "SEND")).toBe(true);
    expect(autonomyAtLeast("NURTURE", "SEND")).toBe(true);
    expect(autonomyAtLeast("CLOSED", "NURTURE")).toBe(true);
    expect(autonomyAtLeast("SEND", "NURTURE")).toBe(false);
  });
});

describe("decideAutoSend — Tier A is never auto-sent", () => {
  const levels: Autonomy[] = ["SUGGEST", "SEND", "NURTURE", "CLOSED"];
  for (const level of levels) {
    it(`A / ${level} / first_touch → no auto-send`, () => {
      const d = decideAutoSend("A", level, "first_touch");
      expect(d.autoSend).toBe(false);
    });
    it(`A / ${level} / follow_up → no auto-send`, () => {
      expect(decideAutoSend("A", level, "follow_up").autoSend).toBe(false);
    });
  }

  it("A alerts the operator once autonomy is SEND+", () => {
    expect(decideAutoSend("A", "SUGGEST", "first_touch").alertOperator).toBe(false);
    expect(decideAutoSend("A", "SEND", "first_touch").alertOperator).toBe(true);
    expect(decideAutoSend("A", "CLOSED", "first_touch").alertOperator).toBe(true);
  });
});

describe("decideAutoSend — first touch needs SEND+, follow-up needs NURTURE+", () => {
  const warmCold: Tier[] = ["B", "C"];
  for (const tier of warmCold) {
    it(`${tier} / SUGGEST / first_touch → held`, () => {
      expect(decideAutoSend(tier, "SUGGEST", "first_touch").autoSend).toBe(false);
    });
    it(`${tier} / SEND / first_touch → auto-send`, () => {
      expect(decideAutoSend(tier, "SEND", "first_touch").autoSend).toBe(true);
    });
    it(`${tier} / SEND / follow_up → held (needs NURTURE)`, () => {
      expect(decideAutoSend(tier, "SEND", "follow_up").autoSend).toBe(false);
    });
    it(`${tier} / NURTURE / follow_up → auto-send`, () => {
      expect(decideAutoSend(tier, "NURTURE", "follow_up").autoSend).toBe(true);
    });
    it(`${tier} / CLOSED / follow_up → auto-send`, () => {
      expect(decideAutoSend(tier, "CLOSED", "follow_up").autoSend).toBe(true);
    });
  }
});

describe("effectiveDailyCap — warm-up curve", () => {
  it("ramps geometrically from the floor and clamps to the configured cap", () => {
    // cap 30: day0 floor=10, day1=20, day2=40→clamped 30, then stays 30.
    expect(effectiveDailyCap(30, 0)).toBe(10);
    expect(effectiveDailyCap(30, 1)).toBe(20);
    expect(effectiveDailyCap(30, 2)).toBe(30);
    expect(effectiveDailyCap(30, 13)).toBe(30);
    expect(effectiveDailyCap(30, 99)).toBe(30);
  });

  it("a tiny cap wins over the floor", () => {
    expect(effectiveDailyCap(5, 0)).toBe(5);
    expect(effectiveDailyCap(5, 10)).toBe(5);
  });

  it("a zero cap means no sending ever", () => {
    expect(effectiveDailyCap(0, 0)).toBe(0);
    expect(effectiveDailyCap(0, 50)).toBe(0);
  });
});

describe("remainingDailyBudget", () => {
  it("subtracts what was already sent and clamps to [0, cap]", () => {
    expect(remainingDailyBudget(30, 2, 0)).toBe(30);
    expect(remainingDailyBudget(30, 2, 10)).toBe(20);
    expect(remainingDailyBudget(30, 2, 30)).toBe(0);
    expect(remainingDailyBudget(30, 2, 999)).toBe(0);
  });

  it("respects the warm-up cap on early days", () => {
    // day 0 cap is 10, 8 already sent → 2 left.
    expect(remainingDailyBudget(30, 0, 8)).toBe(2);
  });
});

describe("compareQueue — Prime > Warm > Cold, then oldest first", () => {
  it("sorts by tier priority first", () => {
    const items = [
      { tier: "C" as Tier, lastContactedMs: null },
      { tier: "A" as Tier, lastContactedMs: null },
      { tier: "B" as Tier, lastContactedMs: null },
    ];
    const sorted = [...items].sort(compareQueue);
    expect(sorted.map((i) => i.tier)).toEqual(["A", "B", "C"]);
  });

  it("within a tier, never-contacted before contacted, then oldest first", () => {
    const items = [
      { tier: "B" as Tier, lastContactedMs: 5000 },
      { tier: "B" as Tier, lastContactedMs: null },
      { tier: "B" as Tier, lastContactedMs: 1000 },
    ];
    const sorted = [...items].sort(compareQueue);
    expect(sorted.map((i) => i.lastContactedMs)).toEqual([null, 1000, 5000]);
  });
});
