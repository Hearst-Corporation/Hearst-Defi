import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

import { buildInvestorReportViewModel } from "../investor-report-view-model";
import type { LatestStudyRunSummary } from "../latest-study-run";
import type { ProjectionRunValidationResult } from "../run-validation";

const RUN: LatestStudyRunSummary = {
  id: "study_abcdef123456",
  shortId: "study_ab",
  ranAt: "2026-06-20T10:00:00Z",
  label: "base",
  methodologyVersion: "v1.0",
  scenarioRunCount: 2,
  apyRange: { low: 8, high: 15 },
  riskScore: 42,
  mode: "balanced",
  confidence: "medium",
};

function validation(
  over: Partial<ProjectionRunValidationResult> = {},
): ProjectionRunValidationResult {
  return {
    status: "VALIDATED_ADMIN",
    investorEligible: false,
    reasons: [],
    warnings: [],
    sourceSummary: { live: 0, fallback: 0, configured: 0, mock: 0, demo: 0, unaudited: 0 },
    ...over,
  };
}

const PAGE_SRC = readFileSync(
  new URL("../../../app/admin/projection/preview/page.tsx", import.meta.url),
  "utf8",
);

describe("buildInvestorReportViewModel — modes", () => {
  it("Test 1: no run → NO_RUN", () => {
    const r = buildInvestorReportViewModel(null, validation({ status: "NO_RUN" }));
    expect(r.mode).toBe("NO_RUN");
    expect(r.investorEligible).toBe(false);
  });

  it("Test 2: needs review → BLOCKED", () => {
    const r = buildInvestorReportViewModel(RUN, validation({ status: "NEEDS_REVIEW", reasons: ["APY range absent"] }));
    expect(r.mode).toBe("BLOCKED");
    expect(r.investorEligible).toBe(false);
  });

  it("Test 3: validated admin → ADMIN_PREVIEW", () => {
    const r = buildInvestorReportViewModel(RUN, validation({ status: "VALIDATED_ADMIN" }));
    expect(r.mode).toBe("ADMIN_PREVIEW");
    expect(r.investorEligible).toBe(false);
  });

  it("Test 4: investor eligible → INVESTOR_ELIGIBLE", () => {
    const r = buildInvestorReportViewModel(
      RUN,
      validation({ status: "INVESTOR_ELIGIBLE", investorEligible: true }),
    );
    expect(r.mode).toBe("INVESTOR_ELIGIBLE");
    expect(r.investorEligible).toBe(true);
  });
});

describe("disclaimers per truth condition", () => {
  it("Test 5: configured assumptions inject a disclaimer", () => {
    const r = buildInvestorReportViewModel(
      RUN,
      validation({ sourceSummary: { live: 0, fallback: 0, configured: 1, mock: 0, demo: 0, unaudited: 0 } }),
    );
    expect(r.disclaimers.join(" ")).toMatch(/configur/i);
    expect(r.sourceBadges.some((b) => /CONFIGURED/.test(b.label))).toBe(true);
  });

  it("Test 6: unaudited risk injects a disclaimer", () => {
    const r = buildInvestorReportViewModel(
      RUN,
      validation({ sourceSummary: { live: 0, fallback: 0, configured: 0, mock: 0, demo: 0, unaudited: 1 } }),
    );
    expect(r.disclaimers.join(" ")).toMatch(/audit/i);
    expect(r.sourceBadges.some((b) => /UNAUDITED/.test(b.label))).toBe(true);
  });

  it("Test 7: fallback source injects a disclaimer", () => {
    const r = buildInvestorReportViewModel(
      RUN,
      validation({ sourceSummary: { live: 0, fallback: 1, configured: 0, mock: 0, demo: 0, unaudited: 0 } }),
    );
    expect(r.disclaimers.join(" ")).toMatch(/fallback/i);
  });

  it("always carries the base not-a-guarantee disclaimer", () => {
    const r = buildInvestorReportViewModel(RUN, validation());
    expect(r.disclaimers.join(" ").toLowerCase()).toContain("guarantee");
  });
});

describe("safety", () => {
  it("Test 8: VALIDATED_ADMIN never says investor-ready (GO ADMIN ONLY)", () => {
    const r = buildInvestorReportViewModel(RUN, validation({ status: "VALIDATED_ADMIN" }));
    expect(r.investorEligible).toBe(false);
    expect(r.disclaimers.join(" ")).toMatch(/ADMIN ONLY/);
    const blob = JSON.stringify(r).toLowerCase();
    expect(blob).not.toMatch(/guaranteed|investor-ready|audited\b/);
  });

  it("Test 9: preserves run id and date", () => {
    const r = buildInvestorReportViewModel(RUN, validation());
    expect(r.runId).toBe(RUN.id);
    expect(r.createdAt).toBe(RUN.ranAt);
  });

  it("Test 10: preserves validation warnings", () => {
    const r = buildInvestorReportViewModel(
      RUN,
      validation({ warnings: ["Risk baselines UNAUDITED", "Assumptions CONFIGURED"] }),
    );
    expect(r.warnings).toEqual(["Risk baselines UNAUDITED", "Assumptions CONFIGURED"]);
  });
});

describe("preview wiring", () => {
  it("page builds + renders the readiness block", () => {
    expect(PAGE_SRC).toContain("buildInvestorReportViewModel");
    expect(PAGE_SRC).toContain("InvestorReportReadiness");
  });
});
