import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Design-system lock: portfolio must not override canonical bento chrome globally.
 * Material lives in product-bento.css; portfolio.css may only scope overrides
 * under `.pf-container` (documented exception — glass aligned with chat rail).
 */
describe("portfolio bento lock", () => {
  const portfolioCss = readFileSync(
    join(process.cwd(), "src/app/(product)/portfolio/portfolio.css"),
    "utf8",
  );

  it("scopes dash-cell material overrides under .pf-container only", () => {
    expect(portfolioCss).toContain(".pf-container .dash-cell");
    expect(portfolioCss).not.toMatch(/(?<!\.)portfolio\.css[\s\S]*^\.dash-cell[^-]/m);
    expect(portfolioCss).not.toMatch(/^\s*\.dash-cell-premium\s*\{/m);
  });

  it("does not define parallel glass recipes (pf-next-action)", () => {
    expect(portfolioCss).not.toContain(".pf-next-action");
  });

  it("does not reintroduce removed preview helpers", () => {
    expect(portfolioCss).not.toContain(".pf-empty-preview");
  });

  it("defines merged-surface layout primitives", () => {
    expect(portfolioCss).toContain(".pf-merged-surface");
    expect(portfolioCss).toContain(".pf-merged-header");
    expect(portfolioCss).toContain(".pf-merged-content");
  });
});
