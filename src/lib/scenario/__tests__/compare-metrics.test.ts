import { describe, expect, it } from "vitest";

import {
  apyRangeMidpoint,
  computeApyDelta,
  deltaToneClass,
  formatSignedFixed,
} from "@/lib/scenario/compare-metrics";
import type { ScenarioOutput } from "@/lib/engine/types";

function mockOutput(apy: { low: number; high: number }): ScenarioOutput {
  return {
    apy_range: apy,
    risk_score: 50,
    mining_margin_score: 50,
    stressed_apy: 5,
    mode: "balanced",
    confidence: "medium",
    allocations: [],
    assumptions: [],
    btc_tactical: {
      targetExposurePct: 10,
      triggers: [],
      guardrails: [],
    },
  } as ScenarioOutput;
}

describe("compare-metrics", () => {
  it("computes APY midpoint delta B − A", () => {
    const a = mockOutput({ low: 8, high: 12 });
    const b = mockOutput({ low: 10, high: 14 });
    expect(apyRangeMidpoint(a)).toBe(10);
    expect(computeApyDelta(a, b)).toBe(2);
  });

  it("formats signed deltas", () => {
    expect(formatSignedFixed(1.234, 2)).toBe("+1.23");
    expect(formatSignedFixed(-0.5, 1)).toBe("−0.5");
    expect(formatSignedFixed(0, 1)).toBe("±0.0");
  });

  it("tones deltas by direction", () => {
    expect(deltaToneClass(1, true, 0.05)).toBe("ct-status-success");
    expect(deltaToneClass(-1, true, 0.05)).toBe("ct-status-danger");
    expect(deltaToneClass(0, true, 0.05)).toBe("ct-text-muted");
  });
});
