import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

import { validateProjectionRun, defaultRunValidationContext } from "../run-validation";
import type { LatestStudyRunSummary } from "../latest-study-run";

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

const PAGE_SRC = readFileSync(
  new URL("../../../app/admin/projection/preview/page.tsx", import.meta.url),
  "utf8",
);
const BANNER_SRC = readFileSync(
  new URL("../../../components/admin/projection/preview-source-banner.tsx", import.meta.url),
  "utf8",
);

describe("validateProjectionRun", () => {
  it("Test 1: coherent run, but configured/unaudited → VALIDATED_ADMIN (not investor)", () => {
    const r = validateProjectionRun(RUN, {
      assumptionsConfigured: true,
      riskUnaudited: true,
    });
    expect(r.status).toBe("VALIDATED_ADMIN");
    expect(r.investorEligible).toBe(false);
  });

  it("Test 1b: a fully clean run (no blockers) → INVESTOR_ELIGIBLE", () => {
    const r = validateProjectionRun(RUN, {
      assumptionsConfigured: false,
      riskUnaudited: false,
      hasMockSource: false,
      hasUnjustifiedFallback: false,
      percentiles: { p5: 5, p50: 10, p95: 18 },
    });
    expect(r.status).toBe("INVESTOR_ELIGIBLE");
    expect(r.investorEligible).toBe(true);
  });

  it("Test 2: p5 > p50 → NEEDS_REVIEW", () => {
    const r = validateProjectionRun(RUN, {
      percentiles: { p5: 12, p50: 8, p95: 18 },
    });
    expect(r.status).toBe("NEEDS_REVIEW");
    expect(r.investorEligible).toBe(false);
  });

  it("Test 3: demo fixture → NO_RUN, investor blocked", () => {
    const r = validateProjectionRun(RUN, { isDemoFixture: true });
    expect(r.status).toBe("NO_RUN");
    expect(r.investorEligible).toBe(false);
  });

  it("Test 4: mock source → investor blocked", () => {
    const r = validateProjectionRun(RUN, {
      assumptionsConfigured: false,
      riskUnaudited: false,
      hasMockSource: true,
    });
    expect(r.investorEligible).toBe(false);
    expect(r.warnings.join(" ")).toMatch(/MOCK/);
  });

  it("Test 5: configured assumptions → investor blocked", () => {
    const r = validateProjectionRun(RUN, {
      assumptionsConfigured: true,
      riskUnaudited: false,
    });
    expect(r.investorEligible).toBe(false);
    expect(r.warnings.join(" ")).toMatch(/CONFIGURED/);
  });

  it("Test 6: unaudited risk → investor blocked", () => {
    const r = validateProjectionRun(RUN, {
      assumptionsConfigured: false,
      riskUnaudited: true,
    });
    expect(r.investorEligible).toBe(false);
    expect(r.warnings.join(" ")).toMatch(/UNAUDITED/);
  });

  it("Test 7: missing APY range → NEEDS_REVIEW", () => {
    const r = validateProjectionRun({ ...RUN, apyRange: null });
    expect(r.status).toBe("NEEDS_REVIEW");
    expect(r.reasons.join(" ")).toMatch(/APY range/);
  });

  it("incoherent APY range (low>high) → NEEDS_REVIEW", () => {
    const r = validateProjectionRun({ ...RUN, apyRange: { low: 20, high: 5 } });
    expect(r.status).toBe("NEEDS_REVIEW");
  });

  it("null run → NO_RUN, blocked", () => {
    const r = validateProjectionRun(null);
    expect(r.status).toBe("NO_RUN");
    expect(r.investorEligible).toBe(false);
  });

  it("Test 10: default context (current reality) never investor-eligible", () => {
    // No ctx → defaults assume CONFIGURED + UNAUDITED → blocked.
    const r = validateProjectionRun(RUN);
    expect(r.investorEligible).toBe(false);
  });

  it("defaultRunValidationContext mirrors assumptions-config (CONFIGURED → blocked)", () => {
    const r = validateProjectionRun(RUN, defaultRunValidationContext(false));
    expect(r.status).toBe("VALIDATED_ADMIN");
    expect(r.investorEligible).toBe(false);
    expect(r.warnings.join(" ")).toMatch(/CONFIGURED/);
  });
});

describe("preview wiring", () => {
  it("Test 8: page computes validation and passes it to the banner", () => {
    expect(PAGE_SRC).toContain("validateProjectionRun");
    expect(PAGE_SRC).toContain("defaultRunValidationContext");
    expect(PAGE_SRC).toContain("validation={validation}");
  });

  it("Test 9: banner renders validation status + GO ADMIN ONLY, both modes", () => {
    expect(BANNER_SRC).toContain("Validation:");
    expect(BANNER_SRC).toContain("Investor-blocked");
    expect(BANNER_SRC).toContain("GO ADMIN ONLY");
  });
});
