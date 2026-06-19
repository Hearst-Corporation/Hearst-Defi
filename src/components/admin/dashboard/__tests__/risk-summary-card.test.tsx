import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DashboardRiskSummaryCard } from "@/components/admin/dashboard/risk-summary-card";
import type { RiskFrameworkData } from "@/lib/data/risk-framework";

const RISK_DB: RiskFrameworkData = {
  composite: 47,
  band: "medium",
  bandLabel: "Moderate",
  dimensions: [
    {
      id: "market",
      label: "Market",
      score: 50,
      status: "ELEVATED",
      severity: "medium",
      detail: "Test",
    },
  ],
  source: "db",
};

describe("DashboardRiskSummaryCard — provenance honesty", () => {
  it("records manual provenance when db risk exists but live KPIs are off (seed/staging)", () => {
    const html = renderToStaticMarkup(
      <DashboardRiskSummaryCard data={RISK_DB} hasLiveKpis={false} />,
    );
    expect(html).toContain('data-risk-provenance="manual"');
    expect(html).not.toContain('data-risk-provenance="live"');
  });

  it("records live provenance when live KPIs and db risk align", () => {
    const html = renderToStaticMarkup(
      <DashboardRiskSummaryCard data={RISK_DB} hasLiveKpis />,
    );
    expect(html).toContain('data-risk-provenance="live"');
  });

  it("records simulated provenance in demo-builder context", () => {
    const html = renderToStaticMarkup(
      <DashboardRiskSummaryCard
        data={RISK_DB}
        hasLiveKpis={false}
        simulated
      />,
    );
    expect(html).toContain('data-risk-provenance="simulated"');
  });
});
