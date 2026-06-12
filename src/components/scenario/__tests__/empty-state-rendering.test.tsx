/**
 * Scenario Lab empty-state rendering — structural contract (DS §9).
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BacktestChart } from "@/components/scenario/backtest-chart";
import { SingleMode } from "@/components/scenario/single-mode";

function assertEmptyDesignContract(html: string, message: string): void {
  expect(html).toContain(message);
  expect(html).toContain("ct-empty-surface");
  expect(html).not.toContain("scenario-lab-output-empty");
  expect(html).not.toContain("scenario-compare-empty");
  expect(html).not.toContain("border-dashed");
  expect(html).not.toContain("Stale");
}

describe("Scenario Lab empty states — design contract", () => {
  it("SingleMode output slot: EmptySurface replaces glass-panel shell", () => {
    const html = renderToStaticMarkup(
      <SingleMode vaultId="yield" />,
    );
    assertEmptyDesignContract(
      html,
      "Select a preset or adjust sliders, then press Run scenario to see projections.",
    );
    expect(html).toMatch(
      /class="[^"]*ct-empty-surface[^"]*scenario-lab-output-card/,
    );
    expect(html).not.toContain("scenario-lab-output-card glass-panel");
  });

  it("BacktestChart: chart slot uses ct-empty-surface--chart without SVG", () => {
    const html = renderToStaticMarkup(<BacktestChart series={[]} />);
    assertEmptyDesignContract(html, "Insufficient data — preview only");
    expect(html).toContain("ct-empty-surface--chart");
    expect(html).not.toContain("<svg");
  });
});
