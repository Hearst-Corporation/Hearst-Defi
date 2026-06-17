import { readFileSync } from "node:fs";
import { join } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ScenarioModeToggle } from "@/components/scenario/scenario-mode-toggle";
import { ScenarioTabBar } from "@/components/scenario/scenario-tab-bar";

const cockpitCss = readFileSync(join(process.cwd(), "src/app/cockpit.css"), "utf8");

/** Extracts a single CSS rule block (first `{…}` after selector). */
function cssRule(css: string, selector: string): string {
  const start = css.indexOf(selector);
  expect(start).toBeGreaterThanOrEqual(0);
  const brace = css.indexOf("{", start);
  const end = css.indexOf("}", brace);
  return css.slice(brace + 1, end);
}

const QUIET_ACTIVE_SELECTION = [
  "color: var(--ct-accent)",
  "background: color-mix(in srgb, var(--ct-accent) 8%, transparent)",
  "border-color: var(--ct-border-accent)",
] as const;

describe("Scenario Lab tab controls", () => {
  it("cockpit.css styles .ct-seg-btn.active with quiet accent selection", () => {
    const rule = cssRule(cockpitCss, ".ct-seg-btn.active");
    for (const decl of QUIET_ACTIVE_SELECTION) {
      expect(rule).toContain(decl);
    }
  });

  it("ScenarioTabBar uses admin segmented controls (ct-seg-btn + active)", () => {
    const html = renderToStaticMarkup(
      <ScenarioTabBar active="scenario" onChange={vi.fn()} />,
    );
    expect(html).toContain("ct-seg-track");
    expect(html).toContain("ct-seg-btn");
    expect(html).toContain('aria-selected="true"');
    expect(html).toMatch(/class="[^"]*\bactive\b[^"]*"/);
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
    expect(html).toMatch(/class="[^"]*\bactive\b[^"]*"/);
    expect(html).not.toContain("ct-bg-accent");
  });
});
