/**
 * Master Outreach Agent — Safety Gates Tests.
 *
 * Tests des garde-fous de sécurité:
 * - Invariants absolus (sendAllowed, requiresUserReview)
 * - Permissions (admin-only intents)
 * - Forbidden words dans les drafts
 * - Semantic confidence threshold
 * - Rapports de sécurité
 */

import { describe, expect, it } from "vitest";
import {
  validateDecisionInvariants,
  validatePermissions,
  validateSemanticConfidence,
  validateDraftContent,
  generateSafetyReport,
  guardDecisionOrThrow,
  guardAdminOnlyOrThrow,
  getAdminOnlyIntents,
  getSafetyConfig,
} from "../outreach-master-safety";
import type { OutreachAgentDecision } from "../outreach-master-types";

// -----------------------------------------------------------------------------
// FIXTURES
// -----------------------------------------------------------------------------

function baseDecision(overrides: Partial<OutreachAgentDecision> = {}): OutreachAgentDecision {
  return {
    intent: "create_campaign",
    source: "regex_deterministic",
    confidence: "high",
    action: "open_canvas",
    reason: "Test decision",
    safetyWarnings: [],
    sendAllowed: false,
    requiresUserReview: true,
    ...overrides,
  };
}

// -----------------------------------------------------------------------------
// INVARIANT TESTS
// -----------------------------------------------------------------------------

describe("SAFETY: Invariant Validation", () => {
  it("passes when sendAllowed is false", () => {
    const decision = baseDecision({ sendAllowed: false });
    const checks = validateDecisionInvariants(decision);
    const check = checks.find(c => c.id === "invariant.send_blocked");
    expect(check?.passed).toBe(true);
    expect(check?.severity).toBe("BLOCKING");
  });

  it("fails when sendAllowed is true", () => {
    const decision = baseDecision({ sendAllowed: true as unknown as false });
    const checks = validateDecisionInvariants(decision);
    const check = checks.find(c => c.id === "invariant.send_blocked");
    expect(check?.passed).toBe(false);
    expect(check?.severity).toBe("BLOCKING");
  });

  it("passes when requiresUserReview is true", () => {
    const decision = baseDecision({ requiresUserReview: true });
    const checks = validateDecisionInvariants(decision);
    const check = checks.find(c => c.id === "invariant.review_required");
    expect(check?.passed).toBe(true);
  });

  it("fails when requiresUserReview is false", () => {
    const decision = baseDecision({ requiresUserReview: false as unknown as true });
    const checks = validateDecisionInvariants(decision);
    const check = checks.find(c => c.id === "invariant.review_required");
    expect(check?.passed).toBe(false);
    expect(check?.severity).toBe("BLOCKING");
  });

  it("passes when source is defined", () => {
    const decision = baseDecision({ source: "regex_deterministic" });
    const checks = validateDecisionInvariants(decision);
    const check = checks.find(c => c.id === "invariant.source_tracked");
    expect(check?.passed).toBe(true);
    expect(check?.severity).toBe("WARNING");
  });

  it("warns when source is missing", () => {
    const decision = baseDecision({ source: "" as OutreachAgentDecision["source"] });
    const checks = validateDecisionInvariants(decision);
    const check = checks.find(c => c.id === "invariant.source_tracked");
    expect(check?.passed).toBe(false);
  });

  it("passes when intent is defined", () => {
    const decision = baseDecision({ intent: "create_campaign" });
    const checks = validateDecisionInvariants(decision);
    const check = checks.find(c => c.id === "invariant.intent_defined");
    expect(check?.passed).toBe(true);
  });

  it("fails when intent is empty", () => {
    const decision = baseDecision({ intent: "" as OutreachAgentDecision["intent"] });
    const checks = validateDecisionInvariants(decision);
    const check = checks.find(c => c.id === "invariant.intent_defined");
    expect(check?.passed).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// PERMISSION TESTS
// -----------------------------------------------------------------------------

describe("SAFETY: Permission Validation", () => {
  const adminIntents = getAdminOnlyIntents();

  it("exports admin-only intents", () => {
    expect(adminIntents.length).toBeGreaterThan(0);
    expect(adminIntents).toContain("create_campaign");
    expect(adminIntents).toContain("draft_email");
    expect(adminIntents).toContain("source_leads");
  });

  for (const intent of adminIntents) {
    it(`blocks ${intent} for non-admin`, () => {
      const decision = baseDecision({ intent });
      const check = validatePermissions(decision, false);
      expect(check.passed).toBe(false);
      expect(check.severity).toBe("BLOCKING");
      expect(check.message).toContain("requires admin");
    });

    it(`allows ${intent} for admin`, () => {
      const decision = baseDecision({ intent });
      const check = validatePermissions(decision, true);
      expect(check.passed).toBe(true);
      expect(check.severity).toBe("INFO");
    });
  }

  it("allows navigation for non-admin", () => {
    const decision = baseDecision({ intent: "open_outreach" });
    const check = validatePermissions(decision, false);
    expect(check.passed).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// SEMANTIC CONFIDENCE TESTS
// -----------------------------------------------------------------------------

describe("SAFETY: Semantic Confidence", () => {
  it("skips check for non-semantic source", () => {
    const decision = baseDecision({ source: "regex_deterministic" });
    const check = validateSemanticConfidence(decision);
    expect(check.passed).toBe(true);
    expect(check.severity).toBe("INFO");
  });

  it("passes when semantic score >= 0.85", () => {
    const decision = baseDecision({
      source: "semantic_hf",
      semanticScore: 0.9,
    });
    const check = validateSemanticConfidence(decision);
    expect(check.passed).toBe(true);
    expect(check.message).toContain("90.0%");
  });

  it("warns when semantic score < 0.85", () => {
    const decision = baseDecision({
      source: "semantic_hf",
      semanticScore: 0.8,
    });
    const check = validateSemanticConfidence(decision);
    expect(check.passed).toBe(false);
    expect(check.severity).toBe("WARNING");
  });

  it("warns when semantic score is missing", () => {
    const decision = baseDecision({
      source: "semantic_hf",
      semanticScore: undefined,
    });
    const check = validateSemanticConfidence(decision);
    expect(check.passed).toBe(false);
    expect(check.severity).toBe("WARNING");
  });
});

// -----------------------------------------------------------------------------
// FORBIDDEN WORDS TESTS
// -----------------------------------------------------------------------------

describe("SAFETY: Forbidden Words in Drafts", () => {
  it("passes for clean content", () => {
    const check = validateDraftContent("Hello investors, here is our update.", "subject");
    expect(check.passed).toBe(true);
  });

  it("blocks content with 'guarantee'", () => {
    const check = validateDraftContent("We guarantee 15% returns", "body");
    expect(check.passed).toBe(false);
    expect(check.severity).toBe("BLOCKING");
    expect(check.message).toContain("guarantee");
  });

  it("blocks content with 'promise'", () => {
    const check = validateDraftContent("I promise you will make money", "body");
    expect(check.passed).toBe(false);
  });

  it("blocks content with 'risk-free'", () => {
    const check = validateDraftContent("This is risk-free investment", "body");
    expect(check.passed).toBe(false);
  });

  it("blocks guaranteed in any language context", () => {
    const check = validateDraftContent("Nous guaranteed le rendement", "body");
    expect(check.passed).toBe(false);
  });

  it("blocks 'certain'", () => {
    const check = validateDraftContent("You will certainly make profit", "body");
    expect(check.passed).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// SAFETY REPORT TESTS
// -----------------------------------------------------------------------------

describe("SAFETY: Full Report Generation", () => {
  it("generates report with all checks", () => {
    const decision = baseDecision({
      intent: "draft_email",
      action: "draft",
      source: "semantic_hf",
      semanticScore: 0.9,
    });

    const report = generateSafetyReport(decision, {
      isAdmin: true,
      draftContent: "Clean email content",
    });

    expect(report.checks.length).toBeGreaterThan(0);
    expect(report.timestamp).toBeTruthy();
    expect(report.decisionId).toBeTruthy();
  });

  it("blocks non-admin creating campaign", () => {
    const decision = baseDecision({ intent: "create_campaign" });
    const report = generateSafetyReport(decision, { isAdmin: false });

    expect(report.canProceed).toBe(false);
    expect(report.blockingReasons.length).toBeGreaterThan(0);
    expect(report.blockingReasons.some(r => r.includes("admin"))).toBe(true);
  });

  it("warns on low semantic confidence", () => {
    const decision = baseDecision({
      source: "semantic_hf",
      semanticScore: 0.7,
    });
    const report = generateSafetyReport(decision, { isAdmin: true });

    expect(report.warnings.length).toBeGreaterThan(0);
    expect(report.warnings.some(w => w.includes("score"))).toBe(true);
  });

  it("allows proceeding when all checks pass", () => {
    const decision = baseDecision({
      intent: "open_outreach",
      action: "navigate",
      source: "regex_deterministic",
    });
    const report = generateSafetyReport(decision, { isAdmin: false });

    expect(report.canProceed).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// GUARD THROW TESTS
// -----------------------------------------------------------------------------

describe("SAFETY: Guard Throws", () => {
  it("throws when sendAllowed is true", () => {
    const decision = baseDecision({ sendAllowed: true as unknown as false });
    expect(() => guardDecisionOrThrow(decision)).toThrow("CRITICAL SAFETY VIOLATION");
  });

  it("does not throw when sendAllowed is false", () => {
    const decision = baseDecision({ sendAllowed: false });
    expect(() => guardDecisionOrThrow(decision)).not.toThrow();
  });

  it("throws when requiresUserReview is false", () => {
    const decision = baseDecision({ requiresUserReview: false as unknown as true });
    expect(() => guardDecisionOrThrow(decision)).toThrow("CRITICAL SAFETY VIOLATION");
  });

  it("throws for non-admin on admin-only intent", () => {
    const decision = baseDecision({ intent: "create_campaign" });
    expect(() => guardAdminOnlyOrThrow(decision, false)).toThrow("PERMISSION VIOLATION");
  });

  it("does not throw for admin on admin-only intent", () => {
    const decision = baseDecision({ intent: "create_campaign" });
    expect(() => guardAdminOnlyOrThrow(decision, true)).not.toThrow();
  });

  it("does not throw for navigation regardless of role", () => {
    const decision = baseDecision({ intent: "open_outreach" });
    expect(() => guardAdminOnlyOrThrow(decision, false)).not.toThrow();
    expect(() => guardAdminOnlyOrThrow(decision, true)).not.toThrow();
  });
});

// -----------------------------------------------------------------------------
// CONFIG TESTS
// -----------------------------------------------------------------------------

describe("SAFETY: Config Introspection", () => {
  it("exports safety configuration", () => {
    const config = getSafetyConfig();
    expect(config.minSemanticScore).toBe(0.85);
    expect(config.adminOnlyIntents.length).toBeGreaterThan(0);
    expect(config.contentCreatingActions).toContain("draft");
    expect(config.contentCreatingActions).toContain("stage_action");
  });
});
