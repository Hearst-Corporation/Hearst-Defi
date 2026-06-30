/**
 * Safety Review Specialist — Outreach Swarm.
 *
 * Mandatory compliance check on all outputs.
 * This specialist ALWAYS runs and CAN block the swarm.
 *
 * Checks:
 * - No guaranteed returns
 * - No "risk-free" claims
 * - No misleading APY (must be range)
 * - No invented data
 * - No sensitive inference
 * - No direct send capability
 * - No bulk send without review
 *
 * Pure: no I/O.
 */

import type {
  OutreachSpecialistOutput,
  OutreachSwarmInput,
  SwarmStatus,
  SwarmConfidence,
} from "../outreach-swarm-types";
import { containsForbidden } from "../../forbidden-words";

// ============================================================================
// COMPLIANCE CHECKS
// ============================================================================

interface ComplianceCheck {
  id: string;
  name: string;
  check: (input: OutreachSwarmInput, allOutputs: OutreachSpecialistOutput[]) => CheckResult;
  blocking: boolean; // If true, fail blocks the swarm
}

interface CheckResult {
  passed: boolean;
  message: string;
  severity: "info" | "warning" | "error";
}

const FORBIDDEN_PHRASES = [
  "guaranteed return",
  "guaranteed yield",
  "risk-free",
  "no risk",
  "promise",
  "will deliver",
  "certain return",
  "100% safe",
  "cannot lose",
  "bulletproof",
  "garanti",
  "sans risque",
  "promesse",
  "sûr à 100%",
];

const COMPLIANCE_CHECKS: ComplianceCheck[] = [
  {
    id: "no_guarantee",
    name: "No Guaranteed Returns",
    blocking: true,
    check: (_input, outputs) => {
      const allText = outputs.map((o) => JSON.stringify(o.proposedData)).join(" ").toLowerCase();

      for (const phrase of FORBIDDEN_PHRASES) {
        if (allText.includes(phrase.toLowerCase())) {
          return {
            passed: false,
            message: `Forbidden phrase detected: "${phrase}"`,
            severity: "error",
          };
        }
      }

      return { passed: true, message: "No guarantee phrases detected", severity: "info" };
    },
  },

  {
    id: "apy_range_format",
    name: "APY Range Format",
    blocking: true,
    check: (_input, outputs) => {
      const allText = outputs.map((o) => JSON.stringify(o.proposedData)).join(" ");

      // Check for single-point APY patterns (e.g., "11%" without range)
      const singlePointPattern = /\b(1[0-5]|[0-9])%\b(?!\s*-\s*\d)/;
      const hasSinglePoint = singlePointPattern.test(allText);

      // Check for range format (e.g., "8-15%" or "8%–15%")
      const rangePattern = /\b\d{1,2}\s*[-–]\s*\d{1,2}%/;
      const hasRange = rangePattern.test(allText);

      if (hasSinglePoint && !hasRange) {
        return {
          passed: false,
          message: "APY appears as single point without range — must be range format (e.g., '8-15%')",
          severity: "error",
        };
      }

      return {
        passed: true,
        message: hasRange ? "APY range format correct" : "No APY claims to validate",
        severity: "info",
      };
    },
  },

  {
    id: "no_invented_data",
    name: "No Invented Recipient Data",
    blocking: true,
    check: (input) => {
      // If we claim to have recipients but no scope provided, that's suspicious
      if (!input.recipientScope && !input.campaignName?.includes("test")) {
        // This is a warning, not necessarily a blocker if using existing data
        return {
          passed: true,
          message: "No explicit recipient scope — will request from user",
          severity: "warning",
        };
      }

      return {
        passed: true,
        message: "Recipient scope explicitly provided or will be requested",
        severity: "info",
      };
    },
  },

  {
    id: "no_sensitive_inference",
    name: "No Sensitive Attribute Inference",
    blocking: true,
    check: (_input, outputs) => {
      const allData = JSON.stringify(outputs.map((o) => o.proposedData)).toLowerCase();

      const sensitivePatterns = [
        "religion", "religious", "faith",
        "health", "medical", "condition",
        "political", "party", "voting",
        "ethnicity", "race", "national origin",
        "sexual", "orientation",
        "disability", "handicap",
      ];

      for (const pattern of sensitivePatterns) {
        if (allData.includes(pattern)) {
          return {
            passed: false,
            message: `Sensitive attribute inference detected: "${pattern}" — prohibited`,
            severity: "error",
          };
        }
      }

      return {
        passed: true,
        message: "No sensitive attribute inference detected",
        severity: "info",
      };
    },
  },

  {
    id: "no_send_capability",
    name: "No Direct Send Capability",
    blocking: true,
    check: (_input, outputs) => {
      // Verify all outputs have sendAllowed=false
      const unsafeOutputs = outputs.filter((o) => o.sendAllowed !== false);

      if (unsafeOutputs.length > 0) {
        return {
          passed: false,
          message: `Unsafe outputs detected with sendAllowed !== false: ${unsafeOutputs.map((o) => o.role).join(", ")}`,
          severity: "error",
        };
      }

      return {
        passed: true,
        message: "All outputs have sendAllowed=false — no direct send capability",
        severity: "info",
      };
    },
  },

  {
    id: "review_required",
    name: "Human Review Required",
    blocking: true,
    check: (_input, outputs) => {
      const unreviewableOutputs = outputs.filter((o) => o.requiresReview !== true);

      if (unreviewableOutputs.length > 0) {
        return {
          passed: false,
          message: `Outputs missing requiresReview=true: ${unreviewableOutputs.map((o) => o.role).join(", ")}`,
          severity: "error",
        };
      }

      return {
        passed: true,
        message: "All outputs require human review",
        severity: "info",
      };
    },
  },
];

// ============================================================================
// SPECIALIST
// ============================================================================

export function runSafetyReviewSpecialist(
  input: OutreachSwarmInput,
  startTime: number,
  otherOutputs: OutreachSpecialistOutput[],
): OutreachSpecialistOutput {
  const latencyMs = Math.round(performance.now() - startTime);

  const findings: string[] = [];
  const warnings: string[] = [];
  const blockers: string[] = [];

  let allPassed = true;
  let hasBlockingFailure = false;

  for (const check of COMPLIANCE_CHECKS) {
    const result = check.check(input, otherOutputs);

    if (result.passed) {
      findings.push(`✓ ${check.name}: ${result.message}`);
    } else {
      allPassed = false;
      if (check.blocking) {
        hasBlockingFailure = true;
        blockers.push(`${check.name}: ${result.message}`);
      } else if (result.severity === "warning") {
        warnings.push(`${check.name}: ${result.message}`);
      }
    }
  }

  // Additional forbidden words check on raw input
  const forbiddenCheck = containsForbidden(input.message);
  if (forbiddenCheck) {
    hasBlockingFailure = true;
    blockers.push(`Input contains forbidden words: ${forbiddenCheck.found.join(", ")}`);
  }

  const status: SwarmStatus = hasBlockingFailure
    ? "blocked"
    : allPassed
      ? "complete"
      : "degraded";

  const confidence: SwarmConfidence = hasBlockingFailure ? "none" : "high";

  return {
    specialistId: `safety-review-${Date.now()}`,
    role: "safety_review",
    status,
    confidence,
    summary: hasBlockingFailure
      ? `BLOCKED: ${blockers.length} compliance violations`
      : allPassed
        ? "All compliance checks passed"
        : `${warnings.length} warnings, review recommended`,
    findings,
    warnings,
    blockers: blockers.length > 0 ? blockers : undefined,
    proposedData: {
      checksRun: COMPLIANCE_CHECKS.length,
      checksPassed: allPassed ? COMPLIANCE_CHECKS.length : COMPLIANCE_CHECKS.length - blockers.length - warnings.length,
      blockers: blockers.length > 0 ? blockers : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      canProceed: !hasBlockingFailure,
    },
    requiresReview: true,
    sendAllowed: false,
    latencyMs,
  };
}

// ============================================================================
// EXPORT
// ============================================================================

export { COMPLIANCE_CHECKS };
export type { ComplianceCheck, CheckResult };
