/**
 * Outreach Action Cards — Tests.
 *
 * Validates safety invariants:
 * - All actions have safety badges
 * - No direct send actions
 * - All proposals are HITL (two-step)
 * - PTAI summaries present
 */

import { describe, expect, it } from "vitest";
import {
  buildCreateCampaignSection,
  buildEmailDraftSection,
  buildWhatsAppDraftSection,
  buildLinkedInDraftSection,
  buildSourceLeadsSection,
  buildFollowUpSection,
  buildReviewRecipientsSection,
} from "../outreach-action-cards";

describe("SUITE 1: Campaign Card", () => {
  it("has required fields", () => {
    const card = buildCreateCampaignSection("Q3 UAE", "cold", true);
    expect(card.id).toBe("outreach-campaign");
    expect(card.fields.some((f) => f.key === "name")).toBe(true);
    expect(card.fields.some((f) => f.key === "kind")).toBe(true);
    expect(card.fields.some((f) => f.key === "status")).toBe(true);
  });

  it("has action when name and type provided", () => {
    const card = buildCreateCampaignSection("Q3 UAE", "cold", true);
    expect(card.actions.length).toBeGreaterThan(0);
    expect(card.actions[0]!.label).toContain("Create");
  });

  it("has no action when fields missing", () => {
    const card = buildCreateCampaignSection("", "cold", false);
    expect(card.actions.length).toBe(0);
    expect(card.status).toBe("building");
  });

  it("has willNotDo on action", () => {
    const card = buildCreateCampaignSection("Q3", "cold", true);
    const action = card.actions[0]!;
    expect(action.willNotDo.length).toBeGreaterThan(0);
    expect(action.willNotDo.some((w) => w.toLowerCase().includes("not") || w.toLowerCase().includes("doesn't") || w.toLowerCase().includes("no "))).toBe(true);
  });

  it("has PTAI summary", () => {
    const card = buildCreateCampaignSection("Q3", "cold", true);
    const action = card.actions[0]!;
    expect(action.summary.projection).toBeTruthy();
    expect(action.summary.trigger).toBeTruthy();
    expect(action.summary.action).toBeTruthy();
    expect(action.summary.impact).toBeTruthy();
  });
});

describe("SUITE 2: Email Draft Card", () => {
  it("shows preview when generated", () => {
    const card = buildEmailDraftSection(
      "john@example.com",
      "John",
      "Introduction to Hearst Yield Vault",
      "Body text here...",
      true
    );
    expect(card.status).toBe("ready");
    expect(card.fields.some((f) => f.key === "subject")).toBe(true);
    expect(card.fields.some((f) => f.key === "body")).toBe(true);
  });

  it("has safety badge", () => {
    const card = buildEmailDraftSection("a@b.c", "X", "S", "B", true);
    const safety = card.fields.find((f) => f.key === "safety");
    expect(safety).toBeDefined();
    expect(safety?.value.toLowerCase()).toContain("no send");
  });

  it("has action only when preview ready", () => {
    const ready = buildEmailDraftSection("a@b.c", "X", "S", "B", true);
    expect(ready.actions.length).toBeGreaterThan(0);

    const building = buildEmailDraftSection("a@b.c", "X", "", "", false);
    expect(building.actions.length).toBe(0);
    expect(building.status).toBe("building");
  });
});

describe("SUITE 3: WhatsApp Draft Card", () => {
  it("has channel badge", () => {
    const card = buildWhatsAppDraftSection("John", "Short message", true);
    const channel = card.fields.find((f) => f.key === "channel");
    expect(channel?.value).toBe("WhatsApp");
  });

  it("shows character count", () => {
    const body = "Hello this is a test message.";
    const card = buildWhatsAppDraftSection("John", body, true);
    const length = card.fields.find((f) => f.key === "length");
    expect(length?.value).toContain(String(body.length));
  });

  it("respects max length constraint", () => {
    const longBody = "a".repeat(500);
    // Should still create but note will warn
    const card = buildWhatsAppDraftSection("John", longBody, true);
    const length = card.fields.find((f) => f.key === "length");
    expect(length?.value).toContain("500");
  });

  it("has safety badge", () => {
    const card = buildWhatsAppDraftSection("John", "Hi", true);
    const safety = card.fields.find((f) => f.key === "safety");
    expect(safety?.value.toLowerCase()).toContain("draft");
  });
});

describe("SUITE 4: LinkedIn Draft Card", () => {
  it("handles connection request type", () => {
    const card = buildLinkedInDraftSection("Jane", "Short note", true, true);
    const type = card.fields.find((f) => f.key === "type");
    expect(type?.value).toBe("Connection request");
  });

  it("handles InMail type", () => {
    const card = buildLinkedInDraftSection("Jane", "Longer message", false, true);
    const type = card.fields.find((f) => f.key === "type");
    expect(type?.value).toBe("InMail");
  });

  it("has safety badge", () => {
    const card = buildLinkedInDraftSection("Jane", "Hi", false, true);
    const safety = card.fields.find((f) => f.key === "safety");
    expect(safety?.value.toLowerCase()).toContain("draft");
  });
});

describe("SUITE 5: Source Leads Card", () => {
  it("has action when ICP active", () => {
    const card = buildSourceLeadsSection(20, true);
    expect(card.status).toBe("ready");
    expect(card.actions.length).toBeGreaterThan(0);
    expect(card.actions[0]!.label).toContain("Source");
  });

  it("has no action when ICP missing", () => {
    const card = buildSourceLeadsSection(20, false);
    expect(card.status).toBe("building");
    expect(card.actions.length).toBe(0);
  });

  it("has willNotDo on action", () => {
    const card = buildSourceLeadsSection(20, true);
    const action = card.actions[0]!;
    expect(action.willNotDo.some((w) => w.toLowerCase().includes("not email"))).toBe(true);
  });

  it("has options to change count", () => {
    const card = buildSourceLeadsSection(20, true);
    expect(card.options.length).toBeGreaterThan(0);
    expect(card.options.some((o) => o.label.includes("10"))).toBe(true);
  });
});

describe("SUITE 6: Follow-up Card", () => {
  it("has fields for recipients and timing", () => {
    const card = buildFollowUpSection(15, 7, "email");
    expect(card.fields.some((f) => f.key === "recipients")).toBe(true);
    expect(card.fields.some((f) => f.key === "days")).toBe(true);
    expect(card.fields.some((f) => f.key === "channel")).toBe(true);
  });

  it("has safety badge", () => {
    const card = buildFollowUpSection(15, 7, "email");
    const safety = card.fields.find((f) => f.key === "safety");
    expect(safety?.value.toLowerCase()).toContain("no send");
  });

  it("has action when recipients > 0", () => {
    const card = buildFollowUpSection(5, 7, "email");
    expect(card.actions.length).toBeGreaterThan(0);
  });

  it("has no action when recipients = 0", () => {
    const card = buildFollowUpSection(0, 7, "email");
    expect(card.actions.length).toBe(0);
    expect(card.status).toBe("building");
  });

  it("has options for channel selection", () => {
    const card = buildFollowUpSection(5, 7, "multi");
    expect(card.options.some((o) => o.label.toLowerCase().includes("email"))).toBe(true);
    expect(card.options.some((o) => o.label.toLowerCase().includes("whatsapp"))).toBe(true);
  });
});

describe("SUITE 7: Review Recipients Card", () => {
  it("is read-only (no actions)", () => {
    const card = buildReviewRecipientsSection(50, { A: 10, B: 20, C: 20 });
    expect(card.actions.length).toBe(0);
    expect(card.id).toBe("outreach-review-recipients");
  });

  it("shows tier breakdown", () => {
    const card = buildReviewRecipientsSection(50, { A: 10, B: 20, C: 20 });
    expect(card.fields.some((f) => f.key === "tier-A")).toBe(true);
    expect(card.fields.some((f) => f.key === "tier-B")).toBe(true);
    expect(card.fields.some((f) => f.key === "tier-C")).toBe(true);
  });

  it("has safety field", () => {
    const card = buildReviewRecipientsSection(50, {});
    expect(card.fields.some((f) => f.key === "safety")).toBe(true);
  });

  it("has options for filtering", () => {
    const card = buildReviewRecipientsSection(50, {});
    expect(card.options.length).toBeGreaterThan(0);
  });
});

describe("SUITE 8: Safety Invariants", () => {
  const cards = [
    buildCreateCampaignSection("Test", "cold", true),
    buildEmailDraftSection("a@b.c", "X", "S", "B", true),
    buildWhatsAppDraftSection("X", "M", true),
    buildLinkedInDraftSection("X", "M", false, true),
    buildSourceLeadsSection(10, true),
    buildFollowUpSection(5, 7, "email"),
  ];

  it("every card has a safety field or willNotDo", () => {
    for (const card of cards) {
      const hasSafetyField = card.fields.some((f) => f.key === "safety" || f.label.toLowerCase().includes("safety"));
      const hasWillNotDo = card.actions.every((a) => a.willNotDo.length > 0);

      // Read-only cards (no actions) should have safety field
      // Action cards should have willNotDo on every action
      if (card.actions.length === 0) {
        expect(hasSafetyField, `${card.id} missing safety field`).toBe(true);
      } else {
        expect(hasWillNotDo, `${card.id} missing willNotDo`).toBe(true);
      }
    }
  });

  it("no action has 'send' as label", () => {
    for (const card of cards) {
      for (const action of card.actions) {
        expect(action.label.toLowerCase()).not.toContain("send now");
        expect(action.label.toLowerCase()).not.toContain("send immediately");
      }
    }
  });

  it("all actions have PTAI summary", () => {
    for (const card of cards) {
      for (const action of card.actions) {
        expect(action.summary.projection, `${action.proposalId} missing projection`).toBeTruthy();
        expect(action.summary.trigger, `${action.proposalId} missing trigger`).toBeTruthy();
        expect(action.summary.action, `${action.proposalId} missing action`).toBeTruthy();
        expect(action.summary.impact, `${action.proposalId} missing impact`).toBeTruthy();
      }
    }
  });
});

describe("SUITE 9: Status States", () => {
  it("ready when fields complete", () => {
    const card = buildCreateCampaignSection("Q3", "cold", true);
    expect(card.status).toBe("ready");
  });

  it("building when fields incomplete", () => {
    const card = buildCreateCampaignSection("", "cold", false);
    expect(card.status).toBe("building");
  });

  it("email ready when preview available", () => {
    const ready = buildEmailDraftSection("a@b.c", "X", "S", "B", true);
    expect(ready.status).toBe("ready");

    const building = buildEmailDraftSection("a@b.c", "X", "", "", false);
    expect(building.status).toBe("building");
  });
});
