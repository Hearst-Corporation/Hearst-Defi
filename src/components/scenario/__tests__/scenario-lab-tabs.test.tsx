import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ScenarioModeToggle } from "@/components/scenario/scenario-mode-toggle";
import { ScenarioTabBar } from "@/components/scenario/scenario-tab-bar";

describe("Scenario Lab tab controls", () => {
  it("ScenarioTabBar uses admin segmented controls (ct-seg-btn + active)", () => {
    const html = renderToStaticMarkup(
      <ScenarioTabBar active="scenario" onChange={vi.fn()} />,
    );
    expect(html).toContain("ct-seg-track");
    expect(html).toContain("ct-seg-btn");
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain(" active");
    expect(html).not.toContain("ct-bg-accent");
    expect(html).not.toContain("ct-glow-accent");
  });

  it("ScenarioModeToggle uses admin segmented controls (ct-seg-btn + active)", () => {
    const html = renderToStaticMarkup(
      <ScenarioModeToggle active="single" onChange={vi.fn()} />,
    );
    expect(html).toContain("ct-seg-track");
    expect(html).toContain("ct-seg-btn");
    expect(html).toContain('aria-selected="true"');
    expect(html).not.toContain("ct-bg-accent");
  });
});
