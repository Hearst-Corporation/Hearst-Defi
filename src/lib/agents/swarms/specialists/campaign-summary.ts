/**
 * Campaign Summary Specialist — Outreach Swarm.
 *
 * Consolidates all specialist outputs into a final action card.
 * This is the final specialist to run.
 *
 * Pure: no I/O.
 */

import type {
  OutreachSpecialistOutput,
  OutreachSwarmInput,
  OutreachSwarmActionCard,
  SwarmStatus,
  SwarmConfidence,
} from "../outreach-swarm-types";

// ============================================================================
// CONSOLIDATION LOGIC
// ============================================================================

export function runCampaignSummarySpecialist(
  input: OutreachSwarmInput,
  startTime: number,
  allOutputs: OutreachSpecialistOutput[],
): OutreachSpecialistOutput {
  const latencyMs = Math.round(performance.now() - startTime);

  // Extract outputs from other specialists
  const leadResearch = allOutputs.find((o) => o.role === "lead_research");
  const segmentation = allOutputs.find((o) => o.role === "segmentation");
  const channelStrategy = allOutputs.find((o) => o.role === "channel_strategy");
  const draftWriter = allOutputs.find((o) => o.role === "draft_writer");
  const safetyReview = allOutputs.find((o) => o.role === "safety_review");
  const timing = allOutputs.find((o) => o.role === "follow_up_timing");

  // Check if any specialist failed or blocked
  const blockedOutputs = allOutputs.filter(
    (o) => o.status === "blocked" || o.status === "error",
  );

  // Determine overall status
  let status: SwarmStatus = "complete";
  if (blockedOutputs.length > 0) {
    status = safetyReview?.status === "blocked" ? "blocked" : "degraded";
  } else if (allOutputs.some((o) => o.status === "degraded")) {
    status = "degraded";
  }

  // Build consolidated action card
  const consolidatedAction: OutreachSwarmActionCard = {
    cardId: `campaign-${Date.now()}`,
    title: input.campaignName || "Outreach Campaign Draft",
    campaignName: input.campaignName,
    recommendedChannel: (channelStrategy?.proposedData?.recommendedChannel as
      | "email"
      | "whatsapp"
      | "linkedin"
      | "multi"
      | "general") || "email",

    segmentSummary: {
      estimatedCount: leadResearch?.proposedData?.availableCount as number | null,
      segments:
        (segmentation?.proposedData?.segments as { id: string; label: string }[])?.map(
          (s) => s.label,
        ) || [],
      confidence: segmentation?.confidence || "low",
    },

    draftPreviews: {
      emailSubject: (draftWriter?.proposedData?.draftPreviews as { emailSubject?: string })?.emailSubject,
      emailBodyPreview: (draftWriter?.proposedData?.draftPreviews as { emailBodyPreview?: string })?.emailBodyPreview,
      whatsAppPreview: (draftWriter?.proposedData?.draftPreviews as { whatsAppPreview?: string })?.whatsAppPreview,
      linkedInPreview: (draftWriter?.proposedData?.draftPreviews as { linkedInPreview?: string })?.linkedInPreview,
    },

    personalizationAngles: [
      "Institutional DeFi yield product",
      "Mining-backed monthly USDC distributions",
      "Cayman SPV structure ($250k min)",
      ...(segmentation?.findings || []),
    ].slice(0, 4),

    timingRecommendation: {
      sequence: timing?.proposedData?.sequence as
        | "single"
        | "follow-up-3-day"
        | "follow-up-7-day"
        | "custom" || "single",
      note:
        (timing?.proposedData?.note as string) ||
        "Initial outreach with optional 7-day follow-up (staged, not scheduled)",
      isRecommendationOnly: true,
    },

    safetyBadges: buildSafetyBadges(allOutputs, safetyReview),

    recommendedNextStep: determineNextStep(status, allOutputs, input),

    specialistSummaries: allOutputs
      .filter((o) => o.status !== "error")
      .slice(0, 3)
      .map((o) => ({
        role: o.role,
        summary: o.summary,
      })),
  };

  // Build findings
  const findings = [
    `Campaign consolidated from ${allOutputs.filter((o) => o.status !== "error").length} specialists`,
    `Recommended channel: ${consolidatedAction.recommendedChannel}`,
    `Status: ${status}`,
    `Safety: ${consolidatedAction.safetyBadges.map((b) => b.badge).join(", ")}`,
  ];

  const warnings = allOutputs.flatMap((o) => o.warnings || []);

  const blockers = blockedOutputs.length > 0 ? blockedOutputs.map((o) => `${o.role}: ${o.status}`) : undefined;

  return {
    specialistId: `campaign-summary-${Date.now()}`,
    role: "campaign_summary",
    status,
    confidence: status === "blocked" ? "none" : status === "degraded" ? "low" : "medium",
    summary:
      status === "blocked"
        ? `Campaign blocked: ${blockers?.join("; ")}`
        : `Campaign draft ready: ${consolidatedAction.recommendedChannel} to ${consolidatedAction.segmentSummary.segments.length || "general"} segments`,
    findings,
    warnings,
    blockers,
    proposedData: {
      consolidatedAction,
      specialistsContributed: allOutputs.filter((o) => o.status !== "error").length,
      specialistsFailed: blockedOutputs.length,
      canProceed: status !== "blocked",
    },
    requiresReview: true,
    sendAllowed: false,
    latencyMs,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function buildSafetyBadges(
  allOutputs: OutreachSpecialistOutput[],
  safetyReview?: OutreachSpecialistOutput,
): OutreachSwarmActionCard["safetyBadges"] {
  const badges: OutreachSwarmActionCard["safetyBadges"] = [];

  // Core safety badges
  badges.push({
    badge: "No send — review required",
    severity: "info",
  });

  badges.push({
    badge: "Draft only",
    severity: "info",
  });

  // Check safety review status
  if (safetyReview?.status === "blocked") {
    badges.push({
      badge: "Compliance review failed",
      severity: "error",
    });
  } else if (safetyReview?.warnings && safetyReview.warnings.length > 0) {
    badges.push({
      badge: `${safetyReview.warnings.length} warnings — review recommended`,
      severity: "warning",
    });
  } else {
    badges.push({
      badge: "Safety review passed",
      severity: "info",
    });
  }

  // Check if we have scope
  const hasScope = allOutputs.some((o) => o.role === "lead_research" && (o.proposedData?.scopeProvided as boolean));
  if (!hasScope) {
    badges.push({
      badge: "Recipient scope needed",
      severity: "warning",
    });
  }

  return badges;
}

function determineNextStep(
  status: SwarmStatus,
  outputs: OutreachSpecialistOutput[],
  input: OutreachSwarmInput,
): string {
  if (status === "blocked") {
    const safety = outputs.find((o) => o.role === "safety_review");
    if (safety?.blockers && safety.blockers.length > 0) {
      return `Fix compliance issues: ${safety.blockers[0]}`;
    }
    return "Review blocking issues before proceeding";
  }

  // Check if we need recipient scope
  const leadResearch = outputs.find((o) => o.role === "lead_research");
  const needsScope = leadResearch?.proposedData?.missingData && (leadResearch.proposedData.missingData as string[]).includes("recipient_scope");

  if (needsScope) {
    return "Provide recipient scope (region, type) or upload prospect list";
  }

  // Check if drafts are ready
  const draftWriter = outputs.find((o) => o.role === "draft_writer");
  if (draftWriter?.proposedData?.generationReady) {
    return "Review campaign draft, then generate full drafts with recipient data";
  }

  // Default
  return input.campaignName
    ? `Review "${input.campaignName}" configuration and proceed to draft generation`
    : "Review campaign configuration and proceed to draft generation";
}
