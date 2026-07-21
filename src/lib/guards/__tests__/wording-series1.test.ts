import { describe, it, expect } from "vitest";

import {
  SERIES1_BANNED_TERMS,
  scanSeries1Wording,
  hasSeries1BannedWording,
} from "@/lib/guards/wording-series1";

describe("scanSeries1Wording", () => {
  it("passes clean BTC-accumulation copy", () => {
    const clean =
      "Series 1 accumulates BTC over a 24-month term, delivered at maturity. " +
      "Estimated return disclosed as a range, in accumulated BTC, not guaranteed.";
    const res = scanSeries1Wording(clean);
    expect(res.ok).toBe(true);
    expect(res.hits).toHaveLength(0);
    expect(hasSeries1BannedWording(clean)).toBe(false);
  });

  it("treats empty text as clean", () => {
    expect(scanSeries1Wording("").ok).toBe(true);
    expect(hasSeries1BannedWording("")).toBe(false);
  });

  it("detects a single banned term (liquidation)", () => {
    const res = scanSeries1Wording("Distance to liquidation is comfortable.");
    expect(res.ok).toBe(false);
    expect(res.hits).toHaveLength(1);
    expect(res.hits[0]?.term).toBe("liquidation");
    expect(hasSeries1BannedWording("Distance to liquidation is comfortable.")).toBe(true);
  });

  it("detects LTV / LLTV as whole words, case-insensitively", () => {
    const res = scanSeries1Wording("Current ltv vs LLTV threshold.");
    expect(res.ok).toBe(false);
    const terms = res.hits.map((h) => h.term);
    expect(terms).toContain("LTV");
    expect(terms).toContain("LLTV");
  });

  it("detects the Morpho borrow model vocabulary in one string", () => {
    const res = scanSeries1Wording(
      "The vault can borrow against collateral via Morpho, tracking a collateral loan.",
    );
    expect(res.ok).toBe(false);
    const terms = new Set(res.hits.map((h) => h.term));
    expect(terms.has("borrow")).toBe(true);
    expect(terms.has("Morpho")).toBe(true);
    expect(terms.has("collateral loan")).toBe(true);
  });

  it.each([
    "collateral",
    "collateralised",
    "collateralized",
    "leverage",
    "leveraged",
  ])("detects the raw Series 1 term %s", (term) => {
    const res = scanSeries1Wording(`Investor copy contains ${term}.`);
    expect(res.ok).toBe(false);
    expect(res.hits.some((hit) => hit.term === term)).toBe(true);
  });

  it("does not false-positive on substrings (loyalty, salt) ", () => {
    const res = scanSeries1Wording("Loyalty rewards and salt of the earth.");
    expect(res.ok).toBe(true);
    expect(res.hits).toHaveLength(0);
  });

  it("matches multi-word terms across arbitrary whitespace", () => {
    const res = scanSeries1Wording("A collateral   loan structure.");
    expect(res.ok).toBe(false);
    expect(res.hits.some((h) => h.term === "collateral loan")).toBe(true);
  });

  it("reports hits ordered by position in the text", () => {
    const res = scanSeries1Wording("First liquidation, then borrow.");
    expect(res.ok).toBe(false);
    const indices = res.hits.map((h) => h.index);
    const sorted = [...indices].sort((a, b) => a - b);
    expect(indices).toEqual(sorted);
  });

  it("exposes a non-empty banned-terms list", () => {
    expect(SERIES1_BANNED_TERMS.length).toBeGreaterThan(0);
    expect(SERIES1_BANNED_TERMS).toContain("borrow");
    expect(SERIES1_BANNED_TERMS).toContain("Morpho");
    expect(SERIES1_BANNED_TERMS).toEqual(
      expect.arrayContaining([
        "collateral",
        "collateralised",
        "collateralized",
        "leverage",
        "leveraged",
      ]),
    );
  });
});
