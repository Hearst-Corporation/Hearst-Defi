/**
 * Outreach Swarm Orchestrator.
 *
 * Coordinates multiple specialists to prepare outreach campaigns.
 * Runs specialists in dependency order, collects outputs, consolidates.
 *
 * Safety: No I/O, deterministic where possible, safe by construction.
 */

import type {
  OutreachSwarmInput,
  OutreachSwarmRun,
  OutreachSwarmConfig,
  OutreachSpecialistOutput,
} from "./outreach-swarm-types";
import { validateSwarmRunSafety, DEFAULT_SWARM_CONFIG } from "./outreach-swarm-types";

// Specialists
import { runLeadResearchSpecialist } from "./specialists/lead-research";
import { runSegmentationSpecialist } from "./specialists/segmentation";
import { runChannelStrategySpecialist } from "./specialists/channel-strategy";
import { runDraftWriterSpecialist } from "./specialists/draft-writer";
import { runSafetyReviewSpecialist } from "./specialists/safety-review";
import { runCampaignSummarySpecialist } from "./specialists/campaign-summary";

// ============================================================================
// SWARM RUN
// ============================================================================

/**
 * Run the complete outreach swarm.
 *
 * Coordinates all specialists, enforces safety invariants.
 *
 * @param input Swarm input
 * @param config Optional configuration
 * @returns Complete swarm run with consolidated action card
 */
export function runOutreachSwarm(
  input: OutreachSwarmInput,
  config: Partial<OutreachSwarmConfig> = {},
): OutreachSwarmRun {
  const startTime = performance.now();

  // Merge config with defaults
  const fullConfig: OutreachSwarmConfig = {
    ...DEFAULT_SWARM_CONFIG,
    ...config,
  };

  // Determine which specialists to run
  const specialistsToRun = fullConfig.specialists || [
    "lead_research",
    "segmentation",
    "channel_strategy",
    "draft_writer",
    "follow_up_timing",
    "safety_review",
    "campaign_summary",
  ];

  // Collect outputs
  const outputs: OutreachSpecialistOutput[] = [];

  // Run specialists in dependency order
  // 1. Lead Research (independent)
  if (specialistsToRun.includes("lead_research")) {
    outputs.push(runLeadResearchSpecialist(input, performance.now()));
  }

  // 2. Segmentation (independent)
  if (specialistsToRun.includes("segmentation")) {
    outputs.push(runSegmentationSpecialist(input, performance.now()));
  }

  // 3. Channel Strategy (independent)
  if (specialistsToRun.includes("channel_strategy")) {
    outputs.push(runChannelStrategySpecialist(input, performance.now()));
  }

  // Get recommended channel for draft writer
  const channelStrategy = outputs.find((o) => o.role === "channel_strategy");
  const recommendedChannel = (channelStrategy?.proposedData?.recommendedChannel as
    | "email"
    | "whatsapp"
    | "linkedin"
    | "multi") || "email";

  // 4. Draft Writer (depends on channel strategy)
  if (specialistsToRun.includes("draft_writer")) {
    outputs.push(runDraftWriterSpecialist(input, performance.now(), recommendedChannel));
  }

  // 5. Follow-up Timing (independent, simple implementation)
  if (specialistsToRun.includes("follow_up_timing")) {
    outputs.push(runFollowUpTimingSpecialist(input, performance.now()));
  }

  // 6. Safety Review (depends on all above, always runs if required)
  const shouldRunSafety = fullConfig.requireSafetyReview || specialistsToRun.includes("safety_review");
  if (shouldRunSafety) {
    outputs.push(runSafetyReviewSpecialist(input, performance.now(), outputs));
  }

  // Check if safety blocked us
  const safetyOutput = outputs.find((o) => o.role === "safety_review");
  const safetyBlocked = safetyOutput?.status === "blocked";

  // 7. Campaign Summary (depends on all, but respect block)
  if (specialistsToRun.includes("campaign_summary") && !safetyBlocked) {
    outputs.push(runCampaignSummarySpecialist(input, performance.now(), outputs));
  } else if (specialistsToRun.includes("campaign_summary") && safetyBlocked) {
    // Still run summary but it will report blocked status
    outputs.push(runCampaignSummarySpecialist(input, performance.now(), outputs));
  }

  // Calculate total latency
  const totalLatencyMs = Math.round(performance.now() - startTime);

  // Determine overall status
  const statuses = outputs.map((o) => o.status);
  let status: OutreachSwarmRun["status"] = "complete";
  if (statuses.includes("blocked") || safetyBlocked) {
    status = "blocked";
  } else if (statuses.includes("degraded") || statuses.includes("error")) {
    status = "degraded";
  }

  // Get consolidated action from summary
  const summaryOutput = outputs.find((o) => o.role === "campaign_summary");
  const consolidatedAction = (summaryOutput?.proposedData?.consolidatedAction as
    | OutreachSwarmRun["consolidatedAction"]
    | undefined) || buildFallbackActionCard(input, outputs);

  // Build final safety report
  const safetyValidation = validateSwarmRunSafety({
    runId: "",
    userIntent: input.message,
    normalizedIntent: input.intent,
    status,
    outputs,
    consolidatedAction,
    safety: {
      sendAllowed: false,
      requiresUserReview: true,
      blockedReasons: safetyOutput?.blockers || [],
      warnings: [...(safetyOutput?.warnings || []), ...outputs.flatMap((o) => o.warnings || [])],
      safetySpecialists: [safetyOutput?.specialistId || "safety-none"],
    },
    totalLatencyMs,
    createdAt: new Date().toISOString(),
  });

  const run: OutreachSwarmRun = {
    runId: `swarm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    userIntent: input.message,
    normalizedIntent: input.intent,
    recipientScope: input.recipientScope,
    productContext: input.productContext,
    channel: input.preferredChannel || (recommendedChannel === "multi" ? "general" : recommendedChannel),
    status,
    outputs,
    consolidatedAction,
    safety: {
      sendAllowed: false,
      requiresUserReview: true,
      blockedReasons: safetyValidation.blocked
        ? safetyValidation.violations
        : safetyOutput?.blockers || [],
      warnings: [...new Set([...(safetyOutput?.warnings || []), ...outputs.flatMap((o) => o.warnings || [])])],
      safetySpecialists: outputs.filter((o) => o.role === "safety_review").map((o) => o.specialistId),
    },
    totalLatencyMs,
    createdAt: new Date().toISOString(),
  };

  return run;
}

// ============================================================================
// FALLBACK TIMING SPECIALIST
// ============================================================================

function runFollowUpTimingSpecialist(
  input: OutreachSwarmInput,
  startTime: number,
): OutreachSpecialistOutput {
  const latencyMs = Math.round(performance.now() - startTime);

  // Simple default recommendation
  const isFollowUp = input.message.toLowerCase().includes("follow up") || input.message.toLowerCase().includes("relance");

  return {
    specialistId: `follow-up-timing-${Date.now()}`,
    role: "follow_up_timing",
    status: "complete",
    confidence: "medium",
    summary: isFollowUp
      ? "Follow-up sequence: initial + 7-day (staged, not scheduled)"
      : "Single outreach recommended (no follow-up unless requested)",
    findings: [
      isFollowUp
        ? "Follow-up sequence proposed: initial message, then 7-day re-engagement"
        : "Single outreach recommended for first contact",
      "Timing is recommendation only — not scheduled",
      "All follow-ups require separate review and confirmation",
    ],
    warnings: ["Timing recommendations are not automated schedules"],
    proposedData: {
      sequence: isFollowUp ? "follow-up-7-day" : "single",
      note: isFollowUp
        ? "Initial outreach, then staged 7-day follow-up (not auto-scheduled)"
        : "Single outreach — follow-up can be added later",
      isRecommendationOnly: true,
    },
    requiresReview: true,
    sendAllowed: false,
    latencyMs,
  };
}

// ============================================================================
// FALLBACK ACTION CARD
// ============================================================================

function buildFallbackActionCard(
  input: OutreachSwarmInput,
  outputs: OutreachSpecialistOutput[],
): OutreachSwarmRun["consolidatedAction"] {
  const channelOutput = outputs.find((o) => o.role === "channel_strategy");
  const channel = (channelOutput?.proposedData?.recommendedChannel as
    | "email"
    | "whatsapp"
    | "linkedin"
    | "multi") || "email";

  return {
    cardId: `fallback-${Date.now()}`,
    title: input.campaignName || "Outreach Campaign (Configuration Needed)",
    campaignName: input.campaignName,
    recommendedChannel: channel,
    segmentSummary: {
      estimatedCount: null,
      segments: [],
      confidence: "low",
    },
    draftPreviews: {},
    personalizationAngles: ["Awaiting campaign configuration"],
    timingRecommendation: {
      sequence: "single",
      note: "Timing will be set after campaign configuration",
      isRecommendationOnly: true,
    },
    safetyBadges: [
      { badge: "Configuration required", severity: "warning" },
      { badge: "No send", severity: "info" },
      { badge: "Review required", severity: "info" },
    ],
    recommendedNextStep: "Provide campaign details (recipient scope, campaign name, channel preference)",
    specialistSummaries: outputs.slice(0, 3).map((o) => ({
      role: o.role,
      summary: o.summary,
    })),
  };
}

// ============================================================================
// CONDITIONAL SWARM RUN
// ============================================================================

/**
 * Determine if a swarm run is needed for this intent.
 *
 * Simple intents like "ouvre outreach" don't need swarm.
 * Campaign/draft/follow-up intents do.
 */
export function shouldRunSwarm(intent: string): boolean {
  const swarmTriggers = [
    "create_campaign",
    "draft_email",
    "draft_whatsapp",
    "draft_linkedin",
    "follow_up_leads",
    "source_leads",
    "analyze_recipients",
  ];

  return swarmTriggers.includes(intent);
}

/**
 * Run swarm only if needed, otherwise return null.
 */
export function runOutreachSwarmIfNeeded(
  input: OutreachSwarmInput,
  config?: Partial<OutreachSwarmConfig>,
): OutreachSwarmRun | null {
  if (!shouldRunSwarm(input.intent)) {
    return null;
  }

  return runOutreachSwarm(input, config);
}
