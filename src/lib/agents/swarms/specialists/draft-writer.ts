/**
 * Draft Writer Specialist — Outreach Swarm.
 *
 * Reuses existing writer templates to generate drafts.
 * Does not create new templates — uses outreach-writer-extended.ts.
 *
 * Pure: no I/O, no real LLM call (returns structure for later generation).
 */

import type {
  OutreachSpecialistOutput,
  OutreachSwarmInput,
  SwarmStatus,
  SwarmConfidence,
} from "../outreach-swarm-types";

// ============================================================================
// DRAFT PARAMETERS
// ============================================================================

interface DraftParams {
  channel: "email" | "whatsapp" | "linkedin";
  campaignName?: string;
  brief?: string;
  recipientType: "family_office" | "ria" | "platform" | "direct";
  language: "fr" | "en";
}

// ============================================================================
// DRAFT TEMPLATES (references to existing templates)
// ============================================================================

interface DraftTemplate {
  id: string;
  name: string;
  channel: "email" | "whatsapp" | "linkedin";
  description: string;
  estimatedLength: string;
  tone: string;
}

const AVAILABLE_TEMPLATES: DraftTemplate[] = [
  {
    id: "cold-email-intro",
    name: "Cold Email Introduction",
    channel: "email",
    description: "First institutional contact with structured pitch",
    estimatedLength: "250-350 words",
    tone: "Formal, institutional, respectful",
  },
  {
    id: "cold-email-follow-up",
    name: "Follow-Up Email",
    channel: "email",
    description: "Polite re-engagement after initial outreach",
    estimatedLength: "150-250 words",
    tone: "Warm but professional",
  },
  {
    id: "newsletter",
    name: "Newsletter Update",
    channel: "email",
    description: "Warm update to existing contacts",
    estimatedLength: "200-400 words",
    tone: "Informative, low-pressure",
  },
  {
    id: "whatsapp-intro",
    name: "WhatsApp Short Intro",
    channel: "whatsapp",
    description: "Very brief institutional introduction",
    estimatedLength: "Under 400 characters",
    tone: "Concise, semi-formal",
  },
  {
    id: "whatsapp-follow-up",
    name: "WhatsApp Follow-Up",
    channel: "whatsapp",
    description: "Brief re-engagement message",
    estimatedLength: "Under 300 characters",
    tone: "Friendly, respectful",
  },
  {
    id: "linkedin-connection",
    name: "LinkedIn Connection Note",
    channel: "linkedin",
    description: "Short connection request with context",
    estimatedLength: "Under 300 characters",
    tone: "Professional, contextual",
  },
  {
    id: "linkedin-inmail",
    name: "LinkedIn InMail",
    channel: "linkedin",
    description: "Full message for LinkedIn InMail",
    estimatedLength: "100-800 characters",
    tone: "Professional, structured",
  },
];

// ============================================================================
// SELECTION LOGIC
// ============================================================================

function selectTemplates(params: DraftParams): DraftTemplate[] {
  const templates: DraftTemplate[] = [];

  // Primary template based on channel
  const primary = AVAILABLE_TEMPLATES.find(
    (t) => t.channel === params.channel && (t.id.includes("intro") || t.id.includes("newsletter")),
  );

  if (primary) {
    templates.push(primary);
  }

  // Follow-up template for sequences
  const followUp = AVAILABLE_TEMPLATES.find(
    (t) => t.channel === params.channel && t.id.includes("follow-up"),
  );

  if (followUp) {
    templates.push(followUp);
  }

  return templates;
}

// ============================================================================
// SPECIALIST
// ============================================================================

export function runDraftWriterSpecialist(
  input: OutreachSwarmInput,
  startTime: number,
  recommendedChannel: "email" | "whatsapp" | "linkedin" | "multi",
): OutreachSpecialistOutput {
  const latencyMs = Math.round(performance.now() - startTime);

  // Determine language
  const hasFrench = /\b(bonjour|salut|prépare|rédige|campagn|prospect|investisseur|distributeur)\b/i.test(
    input.message,
  );
  const language: "fr" | "en" = hasFrench ? "fr" : "en";

  // Determine recipient type from scope
  const scope = (input.recipientScope || "").toLowerCase();
  let recipientType: DraftParams["recipientType"] = "direct";

  if (scope.includes("family") || scope.includes("fo")) {
    recipientType = "family_office";
  } else if (scope.includes("ria") || scope.includes("advisor")) {
    recipientType = "ria";
  } else if (scope.includes("platform") || scope.includes("distributor")) {
    recipientType = "platform";
  }

  // Build params
  const params: DraftParams = {
    channel: recommendedChannel === "multi" ? "email" : recommendedChannel,
    campaignName: input.campaignName,
    brief: input.brief,
    recipientType,
    language,
  };

  // Select templates
  const templates = selectTemplates(params);

  // Build findings
  const findings = templates.map((t) => `${t.name} (${t.channel}): ${t.estimatedLength}`);

  // Draft previews (placeholder — real generation happens later with actual templates)
  const draftPreviews = {
    emailSubject: params.campaignName
      ? `Introduction: ${params.campaignName}`
      : "Introduction to Hearst Yield Vault",
    emailBodyPreview: "[Draft will be generated using outreach-writer-extended templates] Institutional DeFi structured yield product...",
    whatsAppPreview: "[Short draft] Brief intro to Hearst Yield Vault (8-15% target APY)...",
    linkedInPreview: "[Professional note] Connecting regarding institutional DeFi opportunities...",
  };

  return {
    specialistId: `draft-writer-${Date.now()}`,
    role: "draft_writer",
    status: "complete",
    confidence: "medium", // Medium because drafts not yet generated
    summary: `${templates.length} draft templates selected${templates.length > 0 ? `: ${templates.map((t) => t.name).join(", ")}` : ""}`,
    findings,
    warnings: [
      "Drafts are templates — actual generation requires recipient-specific data",
      "All drafts will be reviewed before any save",
    ],
    proposedData: {
      selectedTemplates: templates.map((t) => ({
        id: t.id,
        name: t.name,
        channel: t.channel,
        description: t.description,
      })),
      language,
      recipientType,
      draftPreviews,
      generationReady: templates.length > 0,
      // Reference to actual templates in outreach-writer-extended.ts
      templateSource: "src/lib/agents/outreach-writer-extended.ts",
    },
    requiresReview: true,
    sendAllowed: false,
    latencyMs,
  };
}

/**
 * Get available template list for UI.
 */
export function getAvailableTemplates(): DraftTemplate[] {
  return AVAILABLE_TEMPLATES;
}
