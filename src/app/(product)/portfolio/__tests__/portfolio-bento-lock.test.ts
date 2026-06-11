import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Design-system lock: portfolio must not override canonical bento chrome.
 * Material lives in product-bento.css only (see README § Design system).
 */
describe("portfolio bento lock", () => {
  const portfolioCss = readFileSync(
    join(process.cwd(), "src/app/(product)/portfolio/portfolio.css"),
    "utf8",
  );

  it("does not strip dash-cell-premium background on portfolio-page", () => {
    expect(portfolioCss).not.toMatch(
      /\[data-testid=["']portfolio-page["']\]\s+\.dash-cell-premium/,
    );
    expect(portfolioCss).not.toContain("background-image: none");
  });

  it("does not define parallel glass recipes (pf-next-action)", () => {
    expect(portfolioCss).not.toContain(".pf-next-action");
    expect(portfolioCss).not.toContain(".pf-empty-preview");
    expect(portfolioCss).not.toContain(".pf-empty-status");
  });
});
