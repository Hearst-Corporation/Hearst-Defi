/**
 * Segmentation Specialist — Outreach Swarm.
 *
 * Segments recipients by safe, non-sensitive attributes.
 * Never infers sensitive data (religion, health, etc.).
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
// SAFE SEGMENTATION DIMENSIONS
// ============================================================================

export const SAFE_SEGMENTS = [
  "investor_type",      // family_office, ria, direct, platform
  "region",             // uae, europe, asia, americas (explicit)
  "relationship_warmth",  // cold, warm, existing
  "product_fit",        // yield_focused, defensive, btc_plus
  "risk_profile",       // conservative, moderate, aggressive (self-declared)
  "preferred_channel",  // email, linkedin, whatsapp
  "engagement_history", // new, engaged, dormant
] as const;

export type SafeSegment = (typeof SAFE_SEGMENTS)[number];

/** Segments we will NEVER infer */
export const PROHIBITED_SEGMENTS = [
  "net_worth",
  "income",
  "religion",
  "political_affiliation",
  "health_status",
  "family_status",
  "ethnicity",
  "age_exact",
  "gender_inference",
];

// ============================================================================
// SEGMENTATION LOGIC
// ============================================================================

interface SegmentDefinition {
  id: string;
  label: string;
  criteria: string;
  estimatedProportion: number | null; // null if unknown
}

/**
 * Build segments based on explicit input only.
 */
function buildSegments(input: OutreachSwarmInput): SegmentDefinition[] {
  const segments: SegmentDefinition[] = [];

  // Region from scope
  if (input.recipientScope) {
    const scope = input.recipientScope.toLowerCase();
    if (scope.includes("uae") || scope.includes("dubai") || scope.includes("emirates")) {
      segments.push({
        id: "region_uae",
        label: "UAE / Middle East",
        criteria: "Explicitly scoped to UAE region",
        estimatedProportion: null, // Don't estimate
      });
    }
    if (scope.includes("europe") || scope.includes("eu")) {
      segments.push({
        id: "region_europe",
        label: "Europe",
        criteria: "Explicitly scoped to European markets",
        estimatedProportion: null,
      });
    }
    if (scope.includes("asia") || scope.includes("singapore") || scope.includes("hk")) {
      segments.push({
        id: "region_asia",
        label: "Asia / APAC",
        criteria: "Explicitly scoped to Asian markets",
        estimatedProportion: null,
      });
    }
  }

  // Default investor type segments (safe to assume for institutional outreach)
  segments.push(
    {
      id: "type_fo",
      label: "Family Offices",
      criteria: "Institutional multi-generational wealth",
      estimatedProportion: null,
    },
    {
      id: "type_ria",
      label: "Registered Investment Advisors",
      criteria: "Professional wealth management",
      estimatedProportion: null,
    },
    {
      id: "type_platform",
      label: "Platforms / Distributors",
      criteria: "Institutional distribution partners",
      estimatedProportion: null,
    },
  );

  // Channel based on preference or intent
  const preferredChannel = input.preferredChannel;
  if (preferredChannel) {
    segments.push({
      id: `channel_${preferredChannel}`,
      label: `${preferredChannel.charAt(0).toUpperCase() + preferredChannel.slice(1)} Preferred`,
      criteria: `User specified ${preferredChannel} channel`,
      estimatedProportion: null,
    });
  }

  return segments;
}

// ============================================================================
// SPECIALIST
// ============================================================================

export function runSegmentationSpecialist(
  input: OutreachSwarmInput,
  startTime: number,
): OutreachSpecialistOutput {
  const latencyMs = Math.round(performance.now() - startTime);

  const segments = buildSegments(input);

  const findings = segments.map((s) => `${s.label}: ${s.criteria}`);

  // Safety check: ensure we didn't create prohibited segments
  const safeSegments = segments.filter((s) => {
    const idLower = s.id.toLowerCase();
    return !PROHIBITED_SEGMENTS.some((p) => idLower.includes(p.toLowerCase()));
  });

  const warnings: string[] = [];
  if (segments.length !== safeSegments.length) {
    warnings.push("Some segment proposals were filtered for safety");
  }

  // Don't estimate counts without data
  const hasScope = !!input.recipientScope;
  const confidence: SwarmConfidence = hasScope ? "medium" : "low";

  return {
    specialistId: `segmentation-${Date.now()}`,
    role: "segmentation",
    status: "complete",
    confidence,
    summary: `Identified ${safeSegments.length} safe segments${hasScope ? " based on explicit scope" : " (general institutional types)"}`,
    findings,
    warnings,
    proposedData: {
      segments: safeSegments.map((s) => ({
        id: s.id,
        label: s.label,
        criteria: s.criteria,
      })),
      prohibitedSegmentsSkipped: segments.length - safeSegments.length,
      segmentDimensions: SAFE_SEGMENTS,
      explicitOnly: true,
    },
    requiresReview: true,
    sendAllowed: false,
    latencyMs,
  };
}

/**
 * Validate that a segment is safe (no sensitive inference).
 */
export function isSafeSegment(segmentId: string): boolean {
  const lower = segmentId.toLowerCase();
  return !PROHIBITED_SEGMENTS.some((p) => lower.includes(p.toLowerCase()));
}
