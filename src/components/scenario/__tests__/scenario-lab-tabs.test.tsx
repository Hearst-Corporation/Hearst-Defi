import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ScenarioModeToggle } from "@/components/scenario/scenario-mode-toggle";
import { ScenarioTabBar } from "@/components/scenario/scenario-tab-bar";

describe("Scenario Lab tab controls", () => {
  it("ScenarioTabBar active tab uses data-active, not accent fill classes", () => {
    const html = renderToStaticMarkup(
      <ScenarioTabBar active="scenario" onChange={vi.fn()} />,
    );
    expect(html).toContain('data-active="true"');
    expect(html).toContain('aria-selected="true"');
    expect(html).not.toContain("ct-bg-accent");
    expect(html).not.toContain("ct-glow-accent");
  });

  it("ScenarioModeToggle active mode uses data-active, not accent fill classes", () => {
    const html = renderToStaticMarkup(
      <ScenarioModeToggle active="single" onChange={vi.fn()} />,
    );
    expect(html).toContain('data-active="true"');
    expect(html).not.toContain("ct-bg-accent");
  });
});
