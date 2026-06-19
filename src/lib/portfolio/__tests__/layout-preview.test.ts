import { describe, expect, it } from "vitest";

import {
  ZERO_YIELD_STACK,
  buildZeroDistribEntries,
  isLayoutPreview,
  isProofPulseEmpty,
  isRiskCompositeUnavailable,
  isRiskPulseEmpty,
  zeroProofPulseProps,
} from "@/lib/portfolio/layout-preview";

describe("layout-preview", () => {
  it("isLayoutPreview is true without positions", () => {
    expect(isLayoutPreview(false)).toBe(true);
    expect(isLayoutPreview(true)).toBe(false);
  });

  it("buildZeroDistribEntries returns 12 monthly $0 entries", () => {
    const entries = buildZeroDistribEntries(2026);
    expect(entries).toHaveLength(12);
    expect(entries[0]?.period).toBe("2026-01");
    expect(entries.every((e) => e.amountUsdc === 0)).toBe(true);
  });

  it("ZERO_YIELD_STACK keeps APY range at 0–0%", () => {
    expect(ZERO_YIELD_STACK.blendedLow).toBe(0);
    expect(ZERO_YIELD_STACK.blendedHigh).toBe(0);
    expect(ZERO_YIELD_STACK.sources).toHaveLength(4);
    expect(ZERO_YIELD_STACK.source).toBe("stale");
  });

  it("isRiskCompositeUnavailable when dimensions are all N/A even if composite > 0", () => {
    expect(
      isRiskCompositeUnavailable({
        scores: [
          { dimension: "market", score: 0, delta30d: 0 },
          { dimension: "mining", score: 0, delta30d: 0 },
          { dimension: "liquidity", score: 0, delta30d: 0 },
          { dimension: "smart_contract", score: 0, delta30d: 0 },
          { dimension: "counterparty", score: 0, delta30d: 0 },
        ],
        composite: 42,
        compositeLabel: "Low–Moderate",
        composite30dTrend: "stable",
      }),
    ).toBe(true);
  });

  it("isRiskPulseEmpty detects loader no-data state", () => {
    expect(
      isRiskPulseEmpty({
        scores: [
          { dimension: "market", score: 0, delta30d: 0 },
          { dimension: "mining", score: 0, delta30d: 0 },
          { dimension: "liquidity", score: 0, delta30d: 0 },
          { dimension: "smart_contract", score: 0, delta30d: 0 },
          { dimension: "counterparty", score: 0, delta30d: 0 },
        ],
        composite: 0,
        compositeLabel: undefined,
        composite30dTrend: "stable",
      }),
    ).toBe(true);
  });

  it("isProofPulseEmpty detects zero PoR", () => {
    const props = zeroProofPulseProps(new Date("2026-06-11T00:00:00Z"));
    expect(isProofPulseEmpty(props)).toBe(true);
    expect(props.methodologyVersion).toMatch(/^v/);
  });
});
