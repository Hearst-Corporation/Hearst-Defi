/**
 * Integration tests — chart overlay presence.
 *
 * Asserts that ChartProvenanceCorner and ChartDisclaimerUnderlay are rendered
 * (or absent) in the correct chart components after Stream W integration.
 *
 * Uses renderToStaticMarkup (node environment, no jsdom) — consistent with
 * the project's vitest config (`environment: "node"`).
 *
 * NOTE: the BacktestChart case was removed with the Scenario Lab / Backtest
 * surface retirement (`@/components/scenario/backtest-chart` deleted). The
 * remaining projectif charts (NavSparkline, ValueChart, TimeToTargetChart)
 * carry their own overlay coverage in their component test files.
 */

import { describe, expect, it } from "vitest";

describe("chart overlays — retired BacktestChart case", () => {
  it("no longer imports the deleted backtest-chart component", () => {
    // Placeholder guard: this file previously exercised BacktestChart overlays.
    // The Scenario Lab / Backtest surface was retired; the import is gone so the
    // suite no longer depends on a deleted module.
    expect(true).toBe(true);
  });
});
