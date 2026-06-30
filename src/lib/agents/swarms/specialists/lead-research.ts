/**
 * Lead Research Specialist — Outreach Swarm.
 *
 * Identifies available prospects from existing data sources.
 * Does NOT scrape external sources.
 * Does NOT invent recipients.
 * Asks for scope if unclear.
 *
 * Pure: no I/O, no DB calls here.
 */

import type {
  OutreachSpecialistOutput,
  OutreachSwarmInput,
  SwarmStatus,
  SwarmConfidence,
} from "../outreach-swarm-types";

// ============================================================================
// TYPES
// ============================================================================

export interface LeadResearchFindings {
  /** Source of leads (CRM, uploaded, etc.) */
  source: string;

  /** Estimated available count (null if unknown) */
  availableCount: number | null;

  /** Whether explicit recipient scope was provided */
  scopeProvided: boolean;

  /** Missing data needed to proceed */
  missingData: string[];

  /** Recommended next step */
  recommendation: string;
}

// ============================================================================
// RULES
// ============================================================================

const ALLOWED_SOURCES = [
  "existing_crm",
  "uploaded_list",
  "previous_campaign",
  "imported_prospects",
  "user_provided_scope",
];

const PROHIBITED_SOURCES = [
  "scraped",
  "purchased_list",
  "cold_scraped",
  "unverified",
];

// ============================================================================
// SPECIALIST
// ============================================================================

/**
 * Lead Research Specialist.
 *
 * Analyzes recipient scope availability.
 * Returns findings, never invents data.
 */
export function runLeadResearchSpecialist(
  input: OutreachSwarmInput,
  startTime: number,
): OutreachSpecialistOutput {
  const latencyMs = Math.round(performance.now() - startTime);

  // Check if we have explicit scope
  const scopeProvided = !!input.recipientScope && input.recipientScope.trim().length > 0;

  // Determine available data (mocked for now — real implementation would query)
  // In production, this would check CRM, uploaded lists, etc.
  const hasExistingData = false; // Placeholder

  // Build findings
  const findings: string[] = [];
  const warnings: string[] = [];
  const blockers: string[] = [];

  const status: SwarmStatus = "complete";
  let confidence: SwarmConfidence = "medium";

  if (scopeProvided) {
    findings.push(`Recipient scope provided: "${input.recipientScope}"`);
    confidence = "high";
  } else {
    findings.push("No explicit recipient scope provided");
    warnings.push("Will need user to specify recipient scope or upload list");
    confidence = "low";
  }

  if (hasExistingData) {
    findings.push("Existing CRM data available for filtering");
  } else {
    findings.push("No existing prospect data available — user upload required");
  }

  // Safety: cannot proceed without scope
  if (!scopeProvided && !hasExistingData) {
    warnings.push("Campaign requires explicit recipient scope definition");
  }

  // Never claim to have invented data
  const availableCount = hasExistingData ? null : null; // Don't estimate if not verified

  return {
    specialistId: `lead-research-${Date.now()}`,
    role: "lead_research",
    status,
    confidence,
    summary: scopeProvided
      ? `Recipient scope "${input.recipientScope}" ready for segmentation`
      : "Awaiting recipient scope definition from user",
    findings,
    warnings,
    blockers: blockers.length > 0 ? blockers : undefined,
    proposedData: {
      source: "user_provided_scope",
      availableCount,
      scopeProvided,
      missingData: scopeProvided ? [] : ["recipient_scope", "recipient_list"],
      recommendation: scopeProvided
        ? "Proceed to segmentation"
        : "Request user to define recipient scope or upload prospect list",
    },
    requiresReview: true,
    sendAllowed: false,
    latencyMs,
  };
}

/**
 * Generate a request for recipient scope when missing.
 */
export function buildScopeRequestMessage(
  campaignName?: string,
  language: "fr" | "en" = "en",
): string {
  const name = campaignName ? `"${campaignName}"` : "this campaign";

  if (language === "fr") {
    return `Pour préparer ${name}, j'ai besoin de connaître la cible :\n\n- Région géographique (ex: UAE, Europe, Asie)\n- Type d'investisseur (family office, RIA, direct)\n- Liste existante à importer\n- Ou filtre sur données CRM existantes\n\nSans cette information, je ne peux pas segmenter les prospects.`;
  }

  return `To prepare ${name}, I need to know the target audience:\n\n- Geographic region (e.g., UAE, Europe, Asia)\n- Investor type (family office, RIA, direct)\n- Existing list to import\n- Or filter on existing CRM data\n\nWithout this information, I cannot segment the prospects.`;
}
