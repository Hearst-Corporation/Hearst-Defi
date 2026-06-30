/**
 * Channel Strategy Specialist — Outreach Swarm.
 *
 * Recommends optimal channel based on message characteristics and segment.
 * Never overrides user preference without reason.
 *
 * Pure: no I/O.
 */

import type {
  OutreachSpecialistOutput,
  OutreachSwarmInput,
  SwarmStatus,
  SwarmConfidence,
} from "../outreach-swarm-types";

// ============================================================================
// CHANNEL RULES
// ============================================================================

type Channel = "email" | "whatsapp" | "linkedin" | "multi";

interface ChannelRecommendation {
  channel: Channel;
  confidence: SwarmConfidence;
  reason: string;
  formality: "formal" | "semi-formal" | "informal";
  lengthGuidance: string;
  bestFor: string[];
  limitations: string[];
}

const CHANNEL_GUIDE: Record<Channel, ChannelRecommendation> = {
  email: {
    channel: "email",
    confidence: "high",
    reason: "Standard B2B institutional outreach — allows structured pitch, attachments, formal tone",
    formality: "formal",
    lengthGuidance: "200-400 words optimal",
    bestFor: [
      "First institutional contact",
      "Detailed product explanation",
      "Formal relationship opening",
      "Multi-step narrative",
    ],
    limitations: [
      "Lower open rates than WhatsApp for warm contacts",
      "Can feel cold if poorly personalized",
      "Spam filters on bulk sends",
    ],
  },
  whatsapp: {
    channel: "whatsapp",
    confidence: "medium",
    reason: "Best for warm/known contacts, urgent but not pushy follow-ups",
    formality: "semi-formal",
    lengthGuidance: "Under 400 characters (2-3 sentences)",
    bestFor: [
      "Follow-up to existing contact",
      "Warm introduction referrals",
      "Quick check-ins",
      "Time-sensitive (but not pushy) messages",
    ],
    limitations: [
      "Intrusive for cold outreach",
      "Very limited formatting",
      "Requires phone number",
      "Can feel unprofessional if misused",
    ],
  },
  linkedin: {
    channel: "linkedin",
    confidence: "medium",
    reason: "Good for professional network building, moderate formality",
    formality: "semi-formal",
    lengthGuidance: "Connection request: <300 chars; InMail: 100-800 chars",
    bestFor: [
      "Professional network expansion",
      "Mutual connection introductions",
      "Industry peer outreach",
      "Content-sharing context",
    ],
    limitations: [
      "InMail credits limited",
      "Connection request very short",
      "Can feel sales-y if templated",
    ],
  },
  multi: {
    channel: "multi",
    confidence: "low",
    reason: "Complex campaign requiring channel-specific variants",
    formality: "formal",
    lengthGuidance: "Create tailored versions per channel",
    bestFor: [
      "Large campaigns with segment channel preferences",
      "A/B testing channel effectiveness",
      "Multi-touch sequences",
    ],
    limitations: [
      "Higher complexity",
      "More drafts to review",
      "Requires clear channel routing rules",
    ],
  },
};

// ============================================================================
// SELECTION LOGIC
// ============================================================================

function selectChannel(input: OutreachSwarmInput): ChannelRecommendation {
  // Respect explicit user preference
  if (input.preferredChannel) {
    const preferred = CHANNEL_GUIDE[input.preferredChannel];
    return {
      ...preferred,
      reason: `User preferred ${input.preferredChannel}: ${preferred.reason}`,
    };
  }

  // Infer from intent keywords
  const msg = input.message.toLowerCase();

  if (msg.includes("whatsapp") || msg.includes("wa ") || msg.includes("message court")) {
    return {
      ...CHANNEL_GUIDE.whatsapp,
      reason: `Detected WhatsApp preference in message: ${CHANNEL_GUIDE.whatsapp.reason}`,
    };
  }

  if (msg.includes("linkedin") || msg.includes("inmail") || msg.includes("connection")) {
    return {
      ...CHANNEL_GUIDE.linkedin,
      reason: `Detected LinkedIn preference in message: ${CHANNEL_GUIDE.linkedin.reason}`,
    };
  }

  // Default to email for institutional
  return {
    ...CHANNEL_GUIDE.email,
    reason: `Default institutional channel (no preference specified): ${CHANNEL_GUIDE.email.reason}`,
  };
}

// ============================================================================
// SPECIALIST
// ============================================================================

export function runChannelStrategySpecialist(
  input: OutreachSwarmInput,
  startTime: number,
): OutreachSpecialistOutput {
  const latencyMs = Math.round(performance.now() - startTime);

  const recommendation = selectChannel(input);

  const findings = [
    `Recommended channel: ${recommendation.channel}`,
    `Formality level: ${recommendation.formality}`,
    `Length guidance: ${recommendation.lengthGuidance}`,
    `Rationale: ${recommendation.reason}`,
  ];

  return {
    specialistId: `channel-strategy-${Date.now()}`,
    role: "channel_strategy",
    status: "complete",
    confidence: recommendation.confidence,
    summary: `${recommendation.channel} recommended${input.preferredChannel ? " (user preference)" : ""} — ${recommendation.lengthGuidance}`,
    findings,
    warnings: recommendation.limitations.slice(0, 2), // Top 2 limitations as warnings
    proposedData: {
      recommendedChannel: recommendation.channel,
      formality: recommendation.formality,
      lengthGuidance: recommendation.lengthGuidance,
      bestUseCases: recommendation.bestFor,
      limitations: recommendation.limitations,
      userPreferenceRespected: !!input.preferredChannel,
    },
    requiresReview: true,
    sendAllowed: false,
    latencyMs,
  };
}

/**
 * Get channel guidance for a specific channel.
 */
export function getChannelGuidance(channel: Channel): ChannelRecommendation {
  return CHANNEL_GUIDE[channel];
}
