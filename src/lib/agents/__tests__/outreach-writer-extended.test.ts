/**
 * Outreach Writer Extended — WhatsApp and LinkedIn templates tests.
 */

import { describe, expect, it } from "vitest";
import {
  buildEmailFollowUpTemplate,
  buildWhatsAppFollowUpTemplate,
  buildCampaignBriefTemplate,
  WhatsAppDraftSchema,
  LinkedInDraftSchema,
} from "../outreach-writer-extended";

// -----------------------------------------------------------------------------
// WHATSAPP TESTS
// -----------------------------------------------------------------------------

describe("WhatsApp Draft", () => {
  it("schema accepts valid short body", () => {
    const valid = { body: "Short message under 400 chars." };
    const result = WhatsAppDraftSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("schema rejects body over 400 chars", () => {
    const invalid = { body: "a".repeat(401) };
    const result = WhatsAppDraftSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("schema rejects empty body", () => {
    const invalid = { body: "" };
    const result = WhatsAppDraftSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("schema rejects short body", () => {
    const invalid = { body: "Hi" };
    const result = WhatsAppDraftSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// LINKEDIN TESTS
// -----------------------------------------------------------------------------

describe("LinkedIn Draft", () => {
  it("schema accepts valid body", () => {
    const valid = { body: "A professional message about the Hearst Yield Vault. It is a structured mining note that accumulates BTC over a 24-month term with rule-based take-profit. Estimated target range is 8-15% (BTC accumulated, not distributed, not guaranteed). Would you be interested in learning more?" };
    const result = LinkedInDraftSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("schema rejects body over 1200 chars", () => {
    const invalid = { body: "a".repeat(1201) };
    const result = LinkedInDraftSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("schema rejects short body", () => {
    const invalid = { body: "Hi" };
    const result = LinkedInDraftSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// FOLLOW-UP TEMPLATES
// -----------------------------------------------------------------------------

describe("Email Follow-Up Templates", () => {
  it("generates English follow-up under 3 days", () => {
    const result = buildEmailFollowUpTemplate("John", "Introduction", 2, "en");
    expect(result.subject).toBe("RE: Introduction");
    expect(result.body).toContain("Quick follow-up");
    expect(result.body).toContain("8-15%");
    expect(result.body).not.toContain("guarantee");
  });

  it("generates English follow-up over 3 days", () => {
    const result = buildEmailFollowUpTemplate("John", "Introduction", 7, "en");
    expect(result.body).toContain("family offices");
    expect(result.body).toContain("8-15%");
  });

  it("generates French follow-up under 3 days", () => {
    const result = buildEmailFollowUpTemplate("Jean", "Introduction", 2, "fr");
    expect(result.subject).toBe("RE: Introduction");
    expect(result.body).toContain("Bonjour Jean");
    expect(result.body).toContain("8-15%");
  });

  it("generates French follow-up over 3 days", () => {
    const result = buildEmailFollowUpTemplate("Jean", "Introduction", 7, "fr");
    expect(result.body).toContain("family offices");
  });
});

describe("WhatsApp Follow-Up Templates", () => {
  it("generates English short follow-up", () => {
    const result = buildWhatsAppFollowUpTemplate("John", 2, "en");
    expect(result.length).toBeLessThan(400);
    expect(result).toContain("8-15%");
    expect(result).toContain("quick follow-up");
  });

  it("generates French short follow-up", () => {
    const result = buildWhatsAppFollowUpTemplate("Jean", 7, "fr");
    expect(result.length).toBeLessThan(400);
    expect(result).toContain("8-15%");
    expect(result).toContain("Bonjour");
  });
});

// -----------------------------------------------------------------------------
// CAMPAIGN BRIEF TEMPLATES
// -----------------------------------------------------------------------------

describe("Campaign Brief Templates", () => {
  it("generates email brief in English", () => {
    const result = buildCampaignBriefTemplate("Q3 UAE Distributors", "email", 50, "en");
    expect(result).toContain("Email campaign");
    expect(result).toContain("Q3 UAE Distributors");
    expect(result).toContain("8-15%");
    expect(result).toContain("no auto-send");
  });

  it("generates WhatsApp brief in French", () => {
    const result = buildCampaignBriefTemplate("Relance Juin", "whatsapp", 30, "fr");
    expect(result).toContain("WhatsApp outreach");
    expect(result).toContain("Relance Juin");
    expect(result).toContain("8-15%");
    expect(result).toContain("pas d'envoi auto");
  });

  it("generates LinkedIn brief", () => {
    const result = buildCampaignBriefTemplate("LinkedIn Prospecting", "linkedin", 100, "en");
    expect(result).toContain("LinkedIn outreach");
    expect(result).toContain("100");
  });
});

// -----------------------------------------------------------------------------
// SAFETY: No forbidden words in templates
// -----------------------------------------------------------------------------

describe("Template Safety", () => {
  const forbiddenWords = ["guarantee", "promise", "certain", "risk-free", "garanti", "promesse", "sans risque"];

  it("no forbidden words in email follow-up templates", () => {
    const result = buildEmailFollowUpTemplate("John", "Test", 5, "en");
    for (const word of forbiddenWords) {
      expect(result.body.toLowerCase()).not.toContain(word);
    }
  });

  it("no forbidden words in WhatsApp follow-up templates", () => {
    const result = buildWhatsAppFollowUpTemplate("John", 5, "en");
    for (const word of forbiddenWords) {
      expect(result.toLowerCase()).not.toContain(word);
    }
  });

  it("no forbidden words in campaign brief templates", () => {
    const result = buildCampaignBriefTemplate("Test", "email", 50, "en");
    for (const word of forbiddenWords) {
      expect(result.toLowerCase()).not.toContain(word);
    }
  });
});

// -----------------------------------------------------------------------------
// Estimated-return Range Format
// -----------------------------------------------------------------------------

describe("Estimated-return Range Format", () => {
  it("all templates use range format not single point", () => {
    const email = buildEmailFollowUpTemplate("John", "Test", 5, "en");
    const whatsapp = buildWhatsAppFollowUpTemplate("John", 5, "en");
    const brief = buildCampaignBriefTemplate("Test", "email", 50, "en");

    // Should contain range notation
    expect(email.body).toContain("8-15%");
    expect(whatsapp).toContain("8-15%");
    expect(brief).toContain("8-15%");

    // Should NOT contain single point like "11%" or "12%"
    expect(email.body).not.toMatch(/\b1[0-9]%\b/); // No single point like 10%, 11%, etc
    expect(whatsapp).not.toMatch(/\b1[0-9]%\b/);
  });
});
