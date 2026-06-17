import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const cockpitCss = readFileSync(join(process.cwd(), "src/app/cockpit.css"), "utf8");
const docFlowCss = readFileSync(join(process.cwd(), "src/app/doc-flow.css"), "utf8");
const portfolioCss = readFileSync(
  join(process.cwd(), "src/app/(product)/portfolio/portfolio.css"),
  "utf8",
);
const onboardingCss = readFileSync(
  join(process.cwd(), "src/app/(product)/onboarding/onboarding.css"),
  "utf8",
);

describe("doc-flow spacing tokens", () => {
  it("defines rhythm aliases in cockpit.css", () => {
    expect(cockpitCss).toMatch(/--ct-space-7:\s*[\d.]+rem/);
    expect(cockpitCss).toContain("--ct-doc-flow-gap: var(--ct-space-9)");
    expect(cockpitCss).toContain("--ct-doc-flow-stack-gap: var(--ct-space-8)");
    expect(cockpitCss).toContain("--ct-doc-flow-inner-gap: var(--ct-space-6)");
  });

  it("admin + product shells/stacks use doc-flow rhythm tokens", () => {
    expect(docFlowCss).toMatch(
      /\.admin-doc \.admin-doc-shell[\s\S]*?gap: var\(--ct-doc-flow-gap\)/,
    );
    expect(docFlowCss).toMatch(
      /\.admin-doc \.admin-doc-stack[\s\S]*?gap: var\(--ct-doc-flow-stack-gap\)/,
    );
    expect(docFlowCss).toMatch(
      /\.product-doc \.product-doc-shell[\s\S]*?gap: var\(--ct-doc-flow-gap\)/,
    );
    expect(docFlowCss).toMatch(
      /\.product-doc \.product-doc-stack[\s\S]*?gap: var\(--ct-doc-flow-stack-gap\)/,
    );
  });

  it("shared doc-flow sections, footers, and headers use inner gap", () => {
    expect(docFlowCss).toMatch(
      /:is\(\.admin-doc, \.product-doc\)[\s\S]*?gap: var\(--ct-doc-flow-inner-gap\)/,
    );
    expect(docFlowCss).toMatch(
      /:is\(\.admin-doc, \.product-doc\) :is\(\.admin-page-header, \.product-page-header\)[\s\S]*?gap: var\(--ct-doc-flow-inner-gap\)/,
    );
  });

  it("product page shells use doc-flow gap", () => {
    expect(docFlowCss).toMatch(
      /\.product-doc :is\([\s\S]*?\.invest-flow-shell[\s\S]*?gap: var\(--ct-doc-flow-gap\)/,
    );
    for (const shell of ["prof-shell", "position-detail-shell", "proof-center-shell"]) {
      expect(docFlowCss).toContain(`.${shell}`);
    }
  });

  it("invest-flow body uses inner gap (footer rule owns divider air)", () => {
    expect(docFlowCss).toMatch(
      /\.product-doc \.invest-flow-shell__body \{[\s\S]*?gap: var\(--ct-doc-flow-inner-gap\)/,
    );
  });

  it("admin compact shell stays dense for dashboard bento", () => {
    expect(docFlowCss).toMatch(
      /\.admin-doc \.admin-doc-shell--compact[\s\S]*?gap: var\(--ct-space-3\)/,
    );
  });

  it("cockpit lab/studio and dashboard shells use doc-flow tokens", () => {
    expect(cockpitCss).toMatch(
      /\.scenario-lab-shell[\s\S]*?gap: var\(--ct-doc-flow-stack-gap\)/,
    );
    expect(cockpitCss).toMatch(
      /\.projection-studio-shell[\s\S]*?gap: var\(--ct-doc-flow-gap\)/,
    );
    expect(cockpitCss).toMatch(
      /\.dashboard-page-shell[\s\S]*?gap: var\(--ct-doc-flow-gap\)/,
    );
  });

  it("portfolio and onboarding shells use doc-flow tokens", () => {
    expect(portfolioCss).toMatch(
      /\.pf-container[\s\S]*?gap: var\(--ct-doc-flow-inner-gap\)/,
    );
    expect(portfolioCss).toMatch(
      /\.pf-section-stack[\s\S]*?gap: var\(--ct-doc-flow-stack-gap\)/,
    );
    expect(onboardingCss).toMatch(
      /\.onboarding-shell__frame[\s\S]*?gap: var\(--ct-doc-flow-stack-gap\)/,
    );
    expect(onboardingCss).toMatch(
      /@media \(min-width: 640px\)[\s\S]*?\.onboarding-shell__frame[\s\S]*?gap: var\(--ct-doc-flow-gap\)/,
    );
  });

  it("vault select cards override compact crush in product-doc", () => {
    expect(docFlowCss).toContain(
      ".product-doc .ct-card--compact:has(.vault-select-card)",
    );
  });

  it("doc-flow scopes loosen default ct-card--compact padding", () => {
    expect(docFlowCss).toMatch(
      /:is\(\.admin-doc, \.product-doc\) \.ct-card--compact:not\(\.p-0\)[\s\S]*?padding: var\(--ct-space-4\) var\(--ct-space-5\)/,
    );
  });
});
