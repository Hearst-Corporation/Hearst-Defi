/**
 * Scenario Lab empty-state rendering — structural contract (DS §9).
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BacktestChart } from "@/components/scenario/backtest-chart";
import { SingleMode } from "@/components/scenario/single-mode";

function assertChartEmptyContract(html: string, message: string): void {
  expect(html).toContain(message);
  expect(html).toContain("ct-empty-surface");
  expect(html).not.toContain("scenario-lab-output-empty");
  expect(html).not.toContain("scenario-compare-empty");
  expect(html).not.toContain("border-dashed");
  expect(html).not.toContain("Stale");
}

describe("Scenario Lab empty states — design contract", () => {
  it("SingleMode result slot: idle copy in the result continuum without EmptySurface nesting", () => {
    const html = renderToStaticMarkup(<SingleMode vaultId="yield" />);
    expect(html).toContain(
      "Select a preset or adjust sliders, then press Run scenario to see projections.",
    );
    // Vertical flow: the result continuum holds the idle copy directly — no glass
    // output-card wrapper, and no skeleton placeholder (removed: the empty state is
    // plain copy, not fabricated metric bars).
    expect(html).toContain("scenario-lab-result");
    expect(html).toContain("scenario-lab-output-idle");
    expect(html).not.toContain("scene-placeholder-metrics");
    expect(html).not.toContain("ct-empty-surface");
    expect(html).not.toMatch(
      /scenario-lab-result[\s\S]*ct-card[\s\S]*ct-empty-surface/,
    );
  });

  it("BacktestChart: chart slot uses ct-empty-surface--chart without SVG", () => {
    const html = renderToStaticMarkup(<BacktestChart series={[]} />);
    assertChartEmptyContract(html, "Insufficient data — preview only");
    expect(html).toContain("ct-empty-surface--chart");
    expect(html).not.toContain("<svg");
  });
});
