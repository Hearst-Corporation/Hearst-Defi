import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ScenarioModeToggle } from "@/components/scenario/scenario-mode-toggle";
import { ScenarioTabBar } from "@/components/scenario/scenario-tab-bar";

describe("Scenario Lab tab controls", () => {
  it("ScenarioTabBar uses doc-flow-tablist with calm underline active state", () => {
    const html = renderToStaticMarkup(
      <ScenarioTabBar active="scenario" onChange={vi.fn()} />,
    );
    expect(html).toContain('class="doc-flow-tablist"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain("border-b-(--ct-border-strong)");
    expect(html).not.toContain("scenario-lab-tab");
    expect(html).not.toContain("ct-bg-accent");
    expect(html).not.toContain("ct-glow-accent");
  });

  it("ScenarioModeToggle uses doc-flow-tablist with calm underline active state", () => {
    const html = renderToStaticMarkup(
      <ScenarioModeToggle active="single" onChange={vi.fn()} />,
    );
    expect(html).toContain('class="doc-flow-tablist"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain("border-b-(--ct-border-strong)");
    expect(html).not.toContain("ct-bg-accent");
  });
});
