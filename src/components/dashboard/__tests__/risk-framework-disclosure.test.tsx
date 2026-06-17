import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RiskFrameworkSection } from "@/components/dashboard/risk-framework";
import type { RiskFrameworkData } from "@/lib/data/risk-framework";

// B2 — the hardcoded pre-audit baselines (smart-contract, counterparty) and the
// fixed volatility proxy must be disclosed, not presented as live measurements.

const DATA: RiskFrameworkData = {
  composite: 42,
  band: "medium",
  bandLabel: "Moderate",
  dimensions: [],
  source: "db",
};

describe("RiskFrameworkSection — baseline disclosure (B2)", () => {
  it("discloses pre-audit baseline assumptions in the footnote", () => {
    const html = renderToStaticMarkup(
      <RiskFrameworkSection data={DATA} view="bars" />,
    );
    expect(html).toContain("pre-audit baseline assumptions");
    expect(html).toContain("volatility input is a fixed");
  });

  it("uses the canonical dashboard panel header", () => {
    const html = renderToStaticMarkup(
      <RiskFrameworkSection data={DATA} view="bars" />,
    );
    expect(html).toContain("dashboard-card-header");
    expect(html).not.toContain("pf-widget-header");
  });
});

describe("RiskFrameworkSection — CompositeHeader visibility", () => {
  it('hides CompositeHeader in view="bars" (no duplicate with KPI strip)', () => {
    const html = renderToStaticMarkup(
      <RiskFrameworkSection data={DATA} view="bars" />,
    );
    // The header renders: <span class="stat-label">Composite</span>
    // The disclosure footnote never contains that exact markup.
    expect(html).not.toContain('stat-label">Composite');
  });

  it('shows CompositeHeader in view="waterfall"', () => {
    const html = renderToStaticMarkup(
      <RiskFrameworkSection data={DATA} view="waterfall" />,
    );
    expect(html).toContain('stat-label">Composite');
  });
});
