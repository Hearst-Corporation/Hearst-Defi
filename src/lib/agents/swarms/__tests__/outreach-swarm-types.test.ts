/**
 * Outreach Swarm Types — Tests.
 *
 * Validates type contracts and safety invariants.
 */

import { describe, it, expect } from "vitest";
import {
  validateSwarmSafety,
  validateSwarmRunSafety,
  DEFAULT_SWARM_CONFIG,
  type OutreachSpecialistOutput,
  type OutreachSwarmRun,
} from "../outreach-swarm-types";

describe("OutreachSwarmTypes — type contracts", () => {
  describe("DEFAULT_SWARM_CONFIG", () => {
    it("has sensible defaults", () => {
      expect(DEFAULT_SWARM_CONFIG.specialistTimeoutMs).toBeGreaterThan(0);
      expect(DEFAULT_SWARM_CONFIG.maxTotalLatencyMs).toBeGreaterThan(
        DEFAULT_SWARM_CONFIG.specialistTimeoutMs,
      );
      expect(DEFAULT_SWARM_CONFIG.requireSafetyReview).toBe(true);
      expect(DEFAULT_SWARM_CONFIG.strictMode).toBe(false);
    });
  });
});

describe("OutreachSwarmTypes — safety validation", () => {
  const baseOutput: OutreachSpecialistOutput = {
    specialistId: "test-1",
    role: "lead_research",
    status: "complete",
    confidence: "high",
    summary: "Test summary",
    findings: [],
    warnings: [],
    requiresReview: true,
    sendAllowed: false,
    latencyMs: 100,
  };

  describe("validateSwarmSafety", () => {
    it("validates correct output", () => {
      const result = validateSwarmSafety(baseOutput);
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it("detects sendAllowed !== false", () => {
      const badOutput = {
        ...baseOutput,
        sendAllowed: true as false, // Force wrong value
      };
      const result = validateSwarmSafety(badOutput);
      expect(result.valid).toBe(false);
      expect(result.violations).toContain("sendAllowed must be false");
    });

    it("detects requiresReview !== true", () => {
      const badOutput = {
        ...baseOutput,
        requiresReview: false as true, // Force wrong value
      };
      const result = validateSwarmSafety(badOutput);
      expect(result.valid).toBe(false);
      expect(result.violations).toContain("requiresReview must be true");
    });

    it("detects sensitive data in proposedData", () => {
      const badOutput: OutreachSpecialistOutput = {
        ...baseOutput,
        proposedData: {
          ssn: "123-45-6789",
          creditCard: "4111-1111-1111-1111",
        },
      };
      const result = validateSwarmSafety(badOutput);
      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.includes("ssn"))).toBe(true);
      expect(result.violations.some((v) => v.includes("credit card"))).toBe(true);
    });

    it("detects health data", () => {
      const badOutput: OutreachSpecialistOutput = {
        ...baseOutput,
        proposedData: {
          health: "good",
          medicalCondition: "none",
        },
      };
      const result = validateSwarmSafety(badOutput);
      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.includes("health"))).toBe(true);
    });
  });

  const safetyOutput: OutreachSpecialistOutput = {
    specialistId: "safety-1",
    role: "safety_review",
    status: "complete",
    confidence: "high",
    summary: "Safety check",
    findings: ["All clear"],
    warnings: [],
    requiresReview: true,
    sendAllowed: false,
    latencyMs: 100,
  };

  describe("validateSwarmRunSafety", () => {
    const buildRun = (overrides: Partial<OutreachSwarmRun> = {}): OutreachSwarmRun => ({
      runId: "test-run",
      userIntent: "test",
      normalizedIntent: "create_campaign",
      status: "complete",
      outputs: [baseOutput, safetyOutput],
      consolidatedAction: {
        cardId: "card-1",
        title: "Test",
        recommendedChannel: "email",
        segmentSummary: {
          estimatedCount: null,
          segments: [],
          confidence: "medium",
        },
        draftPreviews: {},
        personalizationAngles: [],
        timingRecommendation: {
          sequence: "single",
          note: "Test",
          isRecommendationOnly: true,
        },
        safetyBadges: [
          { badge: "No send — review required", severity: "info" },
        ],
        recommendedNextStep: "Review",
        specialistSummaries: [],
      },
      safety: {
        sendAllowed: false,
        requiresUserReview: true,
        blockedReasons: [],
        warnings: [],
        safetySpecialists: ["safety-1"],
      },
      totalLatencyMs: 100,
      createdAt: new Date().toISOString(),
      ...overrides,
    });

    it("validates correct run", () => {
      const run = buildRun();
      const result = validateSwarmRunSafety(run);
      expect(result.valid).toBe(true);
      expect(result.blocked).toBe(false);
    });

    it("detects missing safety specialist", () => {
      const run = buildRun({
        outputs: [], // No outputs at all
      });
      const result = validateSwarmRunSafety(run);
      expect(result.valid).toBe(false);
      expect(result.violations).toContain("Safety review specialist did not run");
    });

    it("detects missing safety badge", () => {
      const run = buildRun({
        consolidatedAction: {
          ...buildRun().consolidatedAction,
          safetyBadges: [], // No safety badges
        },
      });
      const result = validateSwarmRunSafety(run);
      expect(result.valid).toBe(false);
      expect(result.violations).toContain("Action card missing safety badge");
    });

    it("detects safety review failure", () => {
      const run = buildRun({
        status: "blocked",
        outputs: [
          {
            ...baseOutput,
            role: "safety_review",
            status: "blocked",
          },
        ],
      });
      const result = validateSwarmRunSafety(run);
      expect(result.valid).toBe(false);
      expect(result.violations).toContain("Safety review failed or blocked");
      expect(result.blocked).toBe(true);
    });

    it("detects sendAllowed !== false at run level", () => {
      const run = buildRun({
        safety: {
          ...buildRun().safety,
          sendAllowed: true as false,
        },
      });
      const result = validateSwarmRunSafety(run);
      expect(result.valid).toBe(false);
      expect(result.violations).toContain("Run sendAllowed must be false");
    });

    it("detects requiresUserReview !== true at run level", () => {
      const run = buildRun({
        safety: {
          ...buildRun().safety,
          requiresUserReview: false as true,
        },
      });
      const result = validateSwarmRunSafety(run);
      expect(result.valid).toBe(false);
      expect(result.violations).toContain("Run requiresUserReview must be true");
    });
  });
});
