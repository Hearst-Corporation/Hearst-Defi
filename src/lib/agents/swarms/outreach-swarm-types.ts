/**
 * Outreach Swarms — Types and Contracts.
 *
 * Multi-specialist swarm system for Outreach campaign preparation.
 * Pure types — no I/O, no DB, no secrets.
 *
 * Safety invariants:
 * - sendAllowed is always false
 * - requiresUserReview is always true
 * - No direct send
 * - No live scheduling
 * - No invented recipients
 * - No sensitive inference
 */

import type { OutreachIntent } from "../outreach-master-types";

// ============================================================================
// SWARM ROLES
// ============================================================================

export type OutreachSwarmRole =
  | "lead_research"      // Identify/verify available prospects
  | "segmentation"       // Group by type/region/relationship
  | "personalization"    // Prepare personalization angles
  | "channel_strategy"   // Recommend channel per segment
  | "draft_writer"       // Generate drafts using templates
  | "safety_review"      // Compliance check on all outputs
  | "follow_up_timing"   // Propose sequence timing (staged only)
  | "campaign_summary";  // Consolidate final action card

// ============================================================================
// SWARM STATUS
// ============================================================================

export type SwarmStatus =
  | "queued"      // Waiting to start
  | "running"     // Currently processing
  | "complete"    // Finished successfully
  | "degraded"    // Finished with warnings
  | "blocked"     // Cannot proceed (safety or data issue)
  | "error";      // Unexpected failure

export type SwarmConfidence = "high" | "medium" | "low" | "none";

// ============================================================================
// INDIVIDUAL SPECIALIST OUTPUT
// ============================================================================

export interface OutreachSpecialistOutput {
  /** Unique ID for this specialist run */
  specialistId: string;

  /** Role of this specialist */
  role: OutreachSwarmRole;

  /** Current status */
  status: SwarmStatus;

  /** Confidence in findings */
  confidence: SwarmConfidence;

  /** Human-readable summary (1-2 lines) */
  summary: string;

  /** Key findings/recommendations */
  findings: string[];

  /** Warnings (non-blocking) */
  warnings: string[];

  /** Blocking issues (if status=blocked) */
  blockers?: string[];

  /** Proposed data (never includes PII) */
  proposedData?: Record<string, unknown>;

  /** Always true — no auto-send */
  requiresReview: true;

  /** Always false — no direct send */
  sendAllowed: false;

  /** Processing time ms */
  latencyMs: number;
}

// ============================================================================
// SWARM RUN CONTRACT
// ============================================================================

export interface OutreachSwarmRun {
  /** Unique run ID */
  runId: string;

  /** Original user intent */
  userIntent: string;

  /** Normalized intent from Master Agent */
  normalizedIntent: OutreachIntent;

  /** Optional recipient scope if provided */
  recipientScope?: string;

  /** Optional product context */
  productContext?: string;

  /** Target channel if specified */
  channel?: "email" | "whatsapp" | "linkedin" | "general";

  /** Overall run status */
  status: "running" | "complete" | "degraded" | "blocked";

  /** All specialist outputs */
  outputs: OutreachSpecialistOutput[];

  /** Consolidated action card data */
  consolidatedAction: OutreachSwarmActionCard;

  /** Safety report */
  safety: {
    /** Always false */
    sendAllowed: false;

    /** Always true */
    requiresUserReview: true;

    /** Reasons if blocked */
    blockedReasons: string[];

    /** Non-blocking warnings */
    warnings: string[];

    /** Specialists that ran safety checks */
    safetySpecialists: string[];
  };

  /** Total latency */
  totalLatencyMs: number;

  /** Timestamp */
  createdAt: string;
}

// ============================================================================
// CONSOLIDATED ACTION CARD
// ============================================================================

export interface OutreachSwarmActionCard {
  /** Card ID */
  cardId: string;

  /** Display title */
  title: string;

  /** Campaign name if known */
  campaignName?: string;

  /** Recommended channel */
  recommendedChannel: "email" | "whatsapp" | "linkedin" | "multi" | "general";

  /** Segment summary */
  segmentSummary: {
    /** Estimated recipient count */
    estimatedCount: number | null;

    /** Segments identified */
    segments: string[];

    /** Confidence in segmentation */
    confidence: SwarmConfidence;
  };

  /** Draft previews (no PII) */
  draftPreviews: {
    emailSubject?: string;
    emailBodyPreview?: string;
    whatsAppPreview?: string;
    linkedInPreview?: string;
  };

  /** Personalization angles */
  personalizationAngles: string[];

  /** Timing recommendation (staged, not scheduled) */
  timingRecommendation: {
    /** Proposed sequence */
    sequence: "single" | "follow-up-3-day" | "follow-up-7-day" | "custom";

    /** Human-readable note */
    note: string;

    /** Not a scheduled date — just a recommendation */
    isRecommendationOnly: true;
  };

  /** Safety badges for UI */
  safetyBadges: {
    /** e.g., "No send", "Draft only", "Review required" */
    badge: string;

    /** Severity for styling */
    severity: "info" | "warning" | "error";
  }[];

  /** Next recommended human action */
  recommendedNextStep: string;

  /** Specialist summaries for display (max 3) */
  specialistSummaries: {
    role: OutreachSwarmRole;
    summary: string;
  }[];
}

// ============================================================================
// SWARM INPUT
// ============================================================================

export interface OutreachSwarmInput {
  /** Original user message */
  message: string;

  /** Normalized intent from Master Agent */
  intent: OutreachIntent;

  /** User is admin (required for most swarm runs) */
  isAdmin: boolean;

  /** User ID for traceability */
  userId: string;

  /** Optional explicit recipient scope */
  recipientScope?: string;

  /** Optional campaign name */
  campaignName?: string;

  /** Preferred channel if specified */
  preferredChannel?: "email" | "whatsapp" | "linkedin";

  /** Brief/context for drafting */
  brief?: string;

  /** Product context for alignment */
  productContext?: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface OutreachSwarmConfig {
  /** Which specialists to run (default: all) */
  specialists?: OutreachSwarmRole[];

  /** Timeout per specialist (ms) */
  specialistTimeoutMs: number;

  /** Max total latency (ms) */
  maxTotalLatencyMs: number;

  /** Require safety specialist to complete */
  requireSafetyReview: true;

  /** Fail run if any specialist errors */
  strictMode: boolean;

  /** Log level for observability */
  logLevel: "debug" | "info" | "warn" | "error";
}

/** Default configuration — safety-first */
export const DEFAULT_SWARM_CONFIG: OutreachSwarmConfig = {
  specialistTimeoutMs: 5000,
  maxTotalLatencyMs: 30000,
  requireSafetyReview: true,
  strictMode: false, // Degraded is acceptable
  logLevel: "info",
};

// ============================================================================
// SAFETY INVARIANT VALIDATION
// ============================================================================

/**
 * Validate that a swarm output respects safety invariants.
 * Pure function — can be called anywhere.
 */
export function validateSwarmSafety(output: OutreachSpecialistOutput): {
  valid: boolean;
  violations: string[];
} {
  const violations: string[] = [];

  if (output.sendAllowed !== false) {
    violations.push("sendAllowed must be false");
  }

  if (output.requiresReview !== true) {
    violations.push("requiresReview must be true");
  }

  // Check for suspicious data patterns
  if (output.proposedData) {
    const dataStr = JSON.stringify(output.proposedData).toLowerCase();
    // Also check for camelCase/pascalCase by inserting spaces before capitals
    const normalizedStr = JSON.stringify(output.proposedData)
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .toLowerCase();

    const forbiddenPatterns = [
      "ssn",
      "social security",
      "credit card",
      "creditcard",
      "password",
      "health",
      "medical",
      "religion",
      "political",
      "sexual",
      "ethnicity",
      "race",
      "net worth",
      "income level",
    ];

    const allData = dataStr + " " + normalizedStr;

    for (const pattern of forbiddenPatterns) {
      if (allData.includes(pattern)) {
        violations.push(`Potential sensitive data detected: ${pattern}`);
      }
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Validate complete swarm run safety.
 */
export function validateSwarmRunSafety(run: OutreachSwarmRun): {
  valid: boolean;
  violations: string[];
  blocked: boolean;
} {
  const violations: string[] = [];

  // Check run-level invariants
  if (run.safety.sendAllowed !== false) {
    violations.push("Run sendAllowed must be false");
  }

  if (run.safety.requiresUserReview !== true) {
    violations.push("Run requiresUserReview must be true");
  }

  // Check safety specialist ran
  const safetySpecialist = run.outputs.find((o) => o.role === "safety_review");
  if (!safetySpecialist) {
    violations.push("Safety review specialist did not run");
  } else if (safetySpecialist.status === "error" || safetySpecialist.status === "blocked") {
    violations.push("Safety review failed or blocked");
  }

  // Check all outputs
  for (const output of run.outputs) {
    const validation = validateSwarmSafety(output);
    if (!validation.valid) {
      violations.push(...validation.violations.map((v) => `[${output.role}] ${v}`));
    }
  }

  // Check consolidated action card
  if (!run.consolidatedAction.safetyBadges.some((b) => b.badge.toLowerCase().includes("review") || b.badge.toLowerCase().includes("no send"))) {
    violations.push("Action card missing safety badge");
  }

  return {
    valid: violations.length === 0,
    violations,
    blocked: run.status === "blocked" || violations.some((v) => v.includes("safety")),
  };
}
