/**
 * Outreach Swarm Specialists — Unit Tests.
 *
 * Individual specialist unit tests.
 */

import { describe, it, expect } from "vitest";
import type { OutreachSwarmInput } from "../outreach-swarm-types";
import { runLeadResearchSpecialist, buildScopeRequestMessage } from "../specialists/lead-research";
import { runSegmentationSpecialist, isSafeSegment } from "../specialists/segmentation";
import { runChannelStrategySpecialist, getChannelGuidance } from "../specialists/channel-strategy";
import { runDraftWriterSpecialist, getAvailableTemplates } from "../specialists/draft-writer";
import { runSafetyReviewSpecialist, COMPLIANCE_CHECKS } from "../specialists/safety-review";
import { runCampaignSummarySpecialist } from "../specialists/campaign-summary";

const baseInput: OutreachSwarmInput = {
  message: "Test message",
  intent: "create_campaign",
  isAdmin: true,
  userId: "test-user",
};

const startTime = performance.now();

describe("Lead Research Specialist", () => {
  it("identifies scope when provided", () => {
    const input = { ...baseInput, recipientScope: "UAE family offices" };
    const result = runLeadResearchSpecialist(input, startTime);

    expect(result.role).toBe("lead_research");
    expect(result.proposedData?.scopeProvided).toBe(true);
    expect(result.confidence).toBe("high");
    expect(result.status).toBe("complete");
  });

  it("warns when scope is missing", () => {
    const result = runLeadResearchSpecialist(baseInput, startTime);

    expect(result.proposedData?.scopeProvided).toBe(false);
    expect(result.confidence).toBe("low");
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.toLowerCase().includes("scope"))).toBe(true);
  });

  it("has correct safety invariants", () => {
    const result = runLeadResearchSpecialist(baseInput, startTime);

    expect(result.sendAllowed).toBe(false);
    expect(result.requiresReview).toBe(true);
  });

  it("tracks latency", () => {
    const result = runLeadResearchSpecialist(baseInput, startTime);

    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("recommends scope request when missing", () => {
    const result = runLeadResearchSpecialist(baseInput, startTime);
    const recommendation = result.proposedData?.recommendation as string;

    expect(recommendation).toContain("scope");
    expect(recommendation).toContain("user");
  });
});

describe("buildScopeRequestMessage", () => {
  it("generates English message", () => {
    const msg = buildScopeRequestMessage("My Campaign", "en");

    expect(msg).toContain("To prepare");
    expect(msg).toContain("My Campaign");
    expect(msg).toContain("target");
    expect(msg).toContain("region");
  });

  it("generates French message", () => {
    const msg = buildScopeRequestMessage("Ma Campagne", "fr");

    expect(msg).toContain("Pour préparer");
    expect(msg).toContain("Ma Campagne");
    expect(msg).toContain("cible");
    expect(msg).toContain("Région");
  });

  it("handles missing campaign name", () => {
    const msg = buildScopeRequestMessage(undefined, "en");

    expect(msg).toContain("this campaign");
  });
});

describe("Segmentation Specialist", () => {
  it("produces safe segments", () => {
    const input = { ...baseInput, recipientScope: "UAE family offices" };
    const result = runSegmentationSpecialist(input, startTime);

    expect(result.role).toBe("segmentation");
    expect(result.status).toBe("complete");

    const segments = result.proposedData?.segments as { id: string; label: string }[];
    expect(segments).toBeDefined();
    expect(segments.length).toBeGreaterThan(0);
  });

  it("only uses safe segment dimensions", () => {
    const input = { ...baseInput, recipientScope: "Europe" };
    const result = runSegmentationSpecialist(input, startTime);

    const segments = result.proposedData?.segments as { id: string }[];

    for (const segment of segments) {
      expect(isSafeSegment(segment.id)).toBe(true);
    }
  });

  it("has correct safety invariants", () => {
    const result = runSegmentationSpecialist(baseInput, startTime);

    expect(result.sendAllowed).toBe(false);
    expect(result.requiresReview).toBe(true);
  });

  it("uses explicitOnly flag", () => {
    const result = runSegmentationSpecialist(baseInput, startTime);

    expect(result.proposedData?.explicitOnly).toBe(true);
  });
});

describe("isSafeSegment", () => {
  it("allows safe segments", () => {
    expect(isSafeSegment("investor_type_fo")).toBe(true);
    expect(isSafeSegment("region_uae")).toBe(true);
    expect(isSafeSegment("channel_email")).toBe(true);
  });

  it("rejects prohibited segments", () => {
    expect(isSafeSegment("religion_christian")).toBe(false);
    expect(isSafeSegment("health_status")).toBe(false);
    expect(isSafeSegment("political_affiliation")).toBe(false);
    expect(isSafeSegment("net_worth_high")).toBe(false);
    expect(isSafeSegment("ethnicity_asian")).toBe(false);
  });
});

describe("Channel Strategy Specialist", () => {
  it("respects user preference", () => {
    const input = { ...baseInput, preferredChannel: "whatsapp" as const };
    const result = runChannelStrategySpecialist(input, startTime);

    expect(result.proposedData?.recommendedChannel).toBe("whatsapp");
    expect(result.proposedData?.userPreferenceRespected).toBe(true);
  });

  it("infers WhatsApp from message", () => {
    const input = { ...baseInput, message: "Écris un message WhatsApp" };
    const result = runChannelStrategySpecialist(input, startTime);

    expect(result.proposedData?.recommendedChannel).toBe("whatsapp");
  });

  it("infers LinkedIn from message", () => {
    const input = { ...baseInput, message: "LinkedIn connection request" };
    const result = runChannelStrategySpecialist(input, startTime);

    expect(result.proposedData?.recommendedChannel).toBe("linkedin");
  });

  it("defaults to email when no preference", () => {
    const result = runChannelStrategySpecialist(baseInput, startTime);

    expect(result.proposedData?.recommendedChannel).toBe("email");
  });

  it("provides length guidance", () => {
    const result = runChannelStrategySpecialist(baseInput, startTime);

    expect(result.proposedData?.lengthGuidance).toBeDefined();
    expect(typeof result.proposedData?.lengthGuidance).toBe("string");
  });

  it("has correct safety invariants", () => {
    const result = runChannelStrategySpecialist(baseInput, startTime);

    expect(result.sendAllowed).toBe(false);
    expect(result.requiresReview).toBe(true);
  });
});

describe("getChannelGuidance", () => {
  it("returns email guidance", () => {
    const guide = getChannelGuidance("email");

    expect(guide.channel).toBe("email");
    expect(guide.formality).toBe("formal");
    expect(guide.bestFor.length).toBeGreaterThan(0);
  });

  it("returns WhatsApp guidance", () => {
    const guide = getChannelGuidance("whatsapp");

    expect(guide.channel).toBe("whatsapp");
    expect(guide.formality).toBe("semi-formal");
    expect(guide.limitations.length).toBeGreaterThan(0);
  });

  it("returns LinkedIn guidance", () => {
    const guide = getChannelGuidance("linkedin");

    expect(guide.channel).toBe("linkedin");
    expect(guide.lengthGuidance).toContain("char");
  });
});

describe("Draft Writer Specialist", () => {
  it("selects templates for channel", () => {
    const result = runDraftWriterSpecialist(baseInput, startTime, "email");

    const templates = result.proposedData?.selectedTemplates as { id: string; channel: string }[];
    expect(templates).toBeDefined();
    expect(templates.length).toBeGreaterThan(0);
  });

  it("detects French language", () => {
    const input = { ...baseInput, message: "Prépare un message" };
    const result = runDraftWriterSpecialist(input, startTime, "email");

    expect(result.proposedData?.language).toBe("fr");
  });

  it("detects English language", () => {
    const input = { ...baseInput, message: "Prepare a message" };
    const result = runDraftWriterSpecialist(input, startTime, "email");

    expect(result.proposedData?.language).toBe("en");
  });

  it("infers recipient type from scope", () => {
    const input = { ...baseInput, recipientScope: "family offices" };
    const result = runDraftWriterSpecialist(input, startTime, "email");

    expect(result.proposedData?.recipientType).toBe("family_office");
  });

  it("references existing templates", () => {
    const result = runDraftWriterSpecialist(baseInput, startTime, "email");

    expect(result.proposedData?.templateSource).toContain("outreach-writer-extended");
  });

  it("has correct safety invariants", () => {
    const result = runDraftWriterSpecialist(baseInput, startTime, "email");

    expect(result.sendAllowed).toBe(false);
    expect(result.requiresReview).toBe(true);
  });

  it("warns about draft status", () => {
    const result = runDraftWriterSpecialist(baseInput, startTime, "email");

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.toLowerCase().includes("review"))).toBe(true);
  });
});

describe("getAvailableTemplates", () => {
  it("returns templates", () => {
    const templates = getAvailableTemplates();

    expect(templates.length).toBeGreaterThan(0);
    expect(templates.every((t) => t.id && t.name)).toBe(true);
  });

  it("includes email templates", () => {
    const templates = getAvailableTemplates();

    expect(templates.some((t) => t.channel === "email")).toBe(true);
  });

  it("includes WhatsApp templates", () => {
    const templates = getAvailableTemplates();

    expect(templates.some((t) => t.channel === "whatsapp")).toBe(true);
  });

  it("includes LinkedIn templates", () => {
    const templates = getAvailableTemplates();

    expect(templates.some((t) => t.channel === "linkedin")).toBe(true);
  });
});

describe("Safety Review Specialist", () => {
  it("runs all compliance checks", () => {
    const result = runSafetyReviewSpecialist(baseInput, startTime, []);

    expect(result.role).toBe("safety_review");
    expect(result.findings.length).toBeGreaterThanOrEqual(COMPLIANCE_CHECKS.length);
  });

  it("detects forbidden phrases", () => {
    const input = { ...baseInput, message: "Guaranteed returns for all investors" };
    const result = runSafetyReviewSpecialist(input, startTime, []);

    expect(result.status).toBe("blocked");
    expect(result.blockers?.length).toBeGreaterThan(0);
  });

  it("detects risk-free claims", () => {
    const input = { ...baseInput, message: "This is a risk-free investment" };
    const result = runSafetyReviewSpecialist(input, startTime, []);

    expect(result.status).toBe("blocked");
  });

  it("allows compliant messages", () => {
    const input = { ...baseInput, message: "Monthly distributions subject to market conditions" };
    const result = runSafetyReviewSpecialist(input, startTime, []);

    // May pass or degrade depending on content
    expect(["complete", "degraded"]).toContain(result.status);
  });

  it("has correct safety invariants", () => {
    const result = runSafetyReviewSpecialist(baseInput, startTime, []);

    expect(result.sendAllowed).toBe(false);
    expect(result.requiresReview).toBe(true);
  });

  it("includes canProceed flag", () => {
    const input = { ...baseInput, message: "Guaranteed returns" };
    const result = runSafetyReviewSpecialist(input, startTime, []);

    expect(result.proposedData?.canProceed).toBe(false);
  });

  it("counts checks run", () => {
    const result = runSafetyReviewSpecialist(baseInput, startTime, []);

    expect(result.proposedData?.checksRun).toBeGreaterThan(0);
  });
});

describe("COMPLIANCE_CHECKS", () => {
  it("has required checks", () => {
    const ids = COMPLIANCE_CHECKS.map((c) => c.id);

    expect(ids).toContain("no_guarantee");
    expect(ids).toContain("apy_range_format");
    expect(ids).toContain("no_sensitive_inference");
    expect(ids).toContain("no_send_capability");
    expect(ids).toContain("review_required");
  });

  it("all checks are properly configured", () => {
    for (const check of COMPLIANCE_CHECKS) {
      expect(check.id).toBeDefined();
      expect(check.name).toBeDefined();
      expect(typeof check.check).toBe("function");
      expect(typeof check.blocking).toBe("boolean");
    }
  });
});

describe("Campaign Summary Specialist", () => {
  const createMockOutputs = (): ReturnType<typeof runLeadResearchSpecialist>[] => {
    const input = baseInput;
    return [
      runLeadResearchSpecialist(input, startTime),
      runSegmentationSpecialist(input, startTime),
      runChannelStrategySpecialist(input, startTime),
      runDraftWriterSpecialist(input, startTime, "email"),
      runSafetyReviewSpecialist(input, startTime, []),
    ];
  };

  it("consolidates all outputs", () => {
    const outputs = createMockOutputs();
    const result = runCampaignSummarySpecialist(baseInput, startTime, outputs);

    expect(result.role).toBe("campaign_summary");
    expect(result.status).toBe("complete");
  });

  it("produces action card", () => {
    const outputs = createMockOutputs();
    const result = runCampaignSummarySpecialist(baseInput, startTime, outputs);

    const action = result.proposedData?.consolidatedAction as {
      cardId: string;
      title: string;
    };
    expect(action.cardId).toBeDefined();
    expect(action.title).toBeDefined();
  });

  it("includes safety badges", () => {
    const outputs = createMockOutputs();
    const result = runCampaignSummarySpecialist(baseInput, startTime, outputs);

    const action = result.proposedData?.consolidatedAction as {
      safetyBadges: { badge: string; severity: string }[];
    };
    expect(action.safetyBadges.length).toBeGreaterThan(0);
  });

  it("includes specialist summaries", () => {
    const outputs = createMockOutputs();
    const result = runCampaignSummarySpecialist(baseInput, startTime, outputs);

    const action = result.proposedData?.consolidatedAction as {
      specialistSummaries: unknown[];
    };
    expect(action.specialistSummaries.length).toBeGreaterThan(0);
    expect(action.specialistSummaries.length).toBeLessThanOrEqual(3);
  });

  it("has correct safety invariants", () => {
    const outputs = createMockOutputs();
    const result = runCampaignSummarySpecialist(baseInput, startTime, outputs);

    expect(result.sendAllowed).toBe(false);
    expect(result.requiresReview).toBe(true);
  });

  it("reports blocked status when safety blocks", () => {
    const blockedInput = { ...baseInput, message: "Guaranteed returns" };
    const outputs = [
      runSafetyReviewSpecialist(blockedInput, startTime, []),
    ];
    const result = runCampaignSummarySpecialist(blockedInput, startTime, outputs);

    expect(result.status).toBe("blocked");
    expect(result.proposedData?.canProceed).toBe(false);
  });

  it("provides next step recommendation", () => {
    const outputs = createMockOutputs();
    const result = runCampaignSummarySpecialist(baseInput, startTime, outputs);

    const action = result.proposedData?.consolidatedAction as {
      recommendedNextStep: string;
    };
    expect(action.recommendedNextStep.length).toBeGreaterThan(0);
  });
});
