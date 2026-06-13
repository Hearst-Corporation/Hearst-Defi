import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ScenarioModeToggle } from "@/components/scenario/scenario-mode-toggle";
import { ScenarioTabBar } from "@/components/scenario/scenario-tab-bar";

describe("Scenario Lab tab controls", () => {
  it("ScenarioTabBar uses admin filter tabs (ct-pill + accent)", () => {
    const html = renderToStaticMarkup(
      <ScenarioTabBar active="scenario" onChange={vi.fn()} />,
    );
    expect(html).toContain('class="admin-doc-inline-row"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain("ct-pill");
    expect(html).toContain("accent");
    expect(html).not.toContain("doc-flow-tablist");
    expect(html).not.toContain("ct-bg-accent");
    expect(html).not.toContain("ct-glow-accent");
  });

  it("ScenarioModeToggle uses admin filter tabs (ct-pill + accent)", () => {
    const html = renderToStaticMarkup(
      <ScenarioModeToggle active="single" onChange={vi.fn()} />,
    );
    expect(html).toContain('class="admin-doc-inline-row"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain("ct-pill");
    expect(html).toContain("accent");
    expect(html).not.toContain("doc-flow-tablist");
  });
});
