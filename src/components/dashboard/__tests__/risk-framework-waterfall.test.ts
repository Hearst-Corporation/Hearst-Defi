/**
 * Unit tests for the Risk Framework waterfall chart logic.
 *
 * These tests exercise the pure step-building function exported from
 * risk-framework.tsx without needing a DOM or React rendering environment.
 *
 * Test matrix:
 *   1. buildWaterfallSteps returns 5 dimension bars + baseline + composite = 7 steps
 *   2. Composite < 40 → bandLabel "Low-Moderate"
 *   3. Negative contributions use var(--ct-status-danger) fill
 *   4. Final bar key is "composite" and carries the composite score
 */

import { describe, it, expect } from "vitest";
import { buildWaterfallSteps } from "../risk-framework";
import type { RiskFrameworkData } from "@/lib/data/risk-framework";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const FIVE_DIMENSIONS: RiskFrameworkData["dimensions"] = [
  {
    id: "market",
    label: "Market",
    score: 12,
    status: "STABLE",
    severity: "low",
    detail: "BTC vol index 50/100",
  },
  {
    id: "mining",
    label: "Mining Operations",
    score: 18,
    status: "STABLE",
    severity: "low",
    detail: "Fleet economics within target band.",
  },
  {
    id: "counterparty",
    label: "Counterparty",
    score: 8,
    status: "OPTIMAL",
    severity: "low",
    detail: "Fully diversified.",
  },
  {
    id: "liquidity",
    label: "Liquidity",
    score: 10,
    status: "HEALTHY",
    severity: "low",
    detail: "Liquid stables cover demand.",
  },
  {
    id: "smart_contract",
    label: "Smart Contract",
    score: 7,
    status: "AUDITED",
    severity: "low",
    detail: "Audited + battle-tested.",
  },
];

function makeData(
  composite: number,
  bandLabel: string,
  overrides?: Partial<RiskFrameworkData>,
): RiskFrameworkData {
  return {
    composite,
    band: composite <= 50 ? "low" : composite <= 66 ? "medium" : "high",
    bandLabel,
    dimensions: FIVE_DIMENSIONS,
    source: "db",
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("buildWaterfallSteps", () => {
  it("returns 7 steps for 5 dimensions (baseline + 5 + composite)", () => {
    const data = makeData(42, "Low–Moderate");
    const steps = buildWaterfallSteps(data);
    // baseline + 5 dims + composite = 7
    expect(steps).toHaveLength(7);

    // First step is baseline
    expect(steps[0]?.key).toBe("baseline");

    // Middle 5 steps correspond to the 5 dimensions
    const dimSteps = steps.slice(1, 6);
    expect(dimSteps).toHaveLength(5);
    const dimKeys = dimSteps.map((s) => s.key);
    expect(dimKeys).toContain("market");
    expect(dimKeys).toContain("mining");
    expect(dimKeys).toContain("counterparty");
    expect(dimKeys).toContain("liquidity");
    expect(dimKeys).toContain("smart_contract");

    // Last step is composite
    expect(steps[6]?.key).toBe("composite");
  });

  it("composite < 40 → bandLabel Low–Moderate is preserved on the final bar", () => {
    // composite=38 falls in the "Low–Moderate" band (score <= 50)
    const data = makeData(38, "Low–Moderate");
    const steps = buildWaterfallSteps(data);
    const finalStep = steps[steps.length - 1];
    expect(finalStep?.isFinal).toBe(true);
    // The final step carries the composite score
    expect(finalStep?.score).toBe(38);
    // Its detail should reference the band label
    expect(finalStep?.detail).toContain("Low–Moderate");
  });

  it("negative contributions use var(--ct-status-danger) fill", () => {
    const data = makeData(42, "Low–Moderate");
    const steps = buildWaterfallSteps(data);
    // All dimension steps (indices 1-5) have positive scores → negative contributions
    const dimSteps = steps.slice(1, 6);
    for (const step of dimSteps) {
      expect(step.fill).toBe("var(--ct-status-danger)");
    }
  });

  it("final bar is shown with the composite score value", () => {
    const composite = 55;
    const data = makeData(composite, "Moderate");
    const steps = buildWaterfallSteps(data);
    const finalStep = steps.find((s) => s.isFinal === true);
    expect(finalStep).toBeDefined();
    expect(finalStep?.score).toBe(composite);
    expect(finalStep?.fill).toBe("var(--ct-status-warning)");
    expect(finalStep?.key).toBe("composite");
  });

  it("y-coordinates decrease monotonically as contributions are subtracted", () => {
    const data = makeData(42, "Low–Moderate");
    const steps = buildWaterfallSteps(data);
    // Each dimension step's y1 should be >= previous dimension step's y1
    // (bars move downward in SVG space as the score erodes)
    let prevY1 = steps[0]?.y1 ?? 0;
    for (const step of steps.slice(1, 6)) {
      // y increases downward in SVG → eroded score = higher y
      expect(step.y1).toBeGreaterThanOrEqual(prevY1);
      prevY1 = step.y1;
    }
  });
});
