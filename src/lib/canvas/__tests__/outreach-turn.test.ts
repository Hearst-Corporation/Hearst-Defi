import { describe, expect, it } from "vitest";

import {
  buildOutreachWorkflowStateFromMessages,
  buildOutreachDraftPreparedMessage,
  buildOutreachDraftComplaintFixedMessage,
  parseOutreachMessage,
  reduceOutreachWorkflowState,
  prepareOutreachDraftContent,
  buildOutreachAskFieldsMessage,
} from "@/lib/canvas/outreach-turn";

describe("parseOutreachMessage", () => {
  it("parses 'Adrien et c'est un colde'", () => {
    expect(parseOutreachMessage("Adrien et c'est un colde")).toEqual({
      intent: "outreach_slots",
      campaignName: "Adrien",
      campaignType: "cold",
    });
  });

  it("parses 'Adrien test cold'", () => {
    expect(parseOutreachMessage("Adrien test cold")).toEqual({
      intent: "outreach_slots",
      campaignName: "Adrien test",
      campaignType: "cold",
    });
  });

  it("parses 'Qatar LP newsletter'", () => {
    expect(parseOutreachMessage("Qatar LP newsletter")).toEqual({
      intent: "outreach_slots",
      campaignName: "Qatar LP",
      campaignType: "newsletter",
    });
  });

  it("parses type only for 'cold'", () => {
    expect(parseOutreachMessage("cold")).toEqual({
      intent: "outreach_slots",
      campaignType: "cold",
      missing: ["campaignName"],
    });
  });

  it("parses type only for 'newsletter'", () => {
    expect(parseOutreachMessage("newsletter")).toEqual({
      intent: "outreach_slots",
      campaignType: "newsletter",
      missing: ["campaignName"],
    });
  });

  it("parses name only for 'Adrien test'", () => {
    expect(parseOutreachMessage("Adrien test")).toEqual({
      intent: "outreach_slots",
      campaignName: "Adrien test",
      missing: ["campaignType"],
    });
  });

  it("parses complaint draft vide", () => {
    expect(parseOutreachMessage("T'as rien écrit dans le brouillon")).toEqual({
      intent: "outreach_draft_missing_complaint",
    });
  });

  it("parses open campaign intents", () => {
    expect(parseOutreachMessage("La campagne")).toEqual({
      intent: "outreach_open_campaign",
    });
    expect(parseOutreachMessage("Ouvre-moi à la bonne page de la campagne")).toEqual({
      intent: "outreach_open_campaign",
    });
  });
});

describe("Outreach deterministic workflow state", () => {
  it("prepares a non-empty draft as soon as name+type are known", () => {
    const state = buildOutreachWorkflowStateFromMessages([
      "On va faire un outreach",
      "Adrien et c'est un colde",
    ]);
    expect(state.campaignName).toBe("Adrien");
    expect(state.campaignType).toBe("cold");
    expect(state.draftStatus).toBe("prepared");
    expect(state.draftContent?.subject.trim().length).toBeGreaterThan(0);
    expect(state.draftContent?.body.trim().length).toBeGreaterThan(0);
  });

  it("complaint regenerates missing draft content without clearing slots", () => {
    const base = buildOutreachWorkflowStateFromMessages([
      "On va faire un outreach",
      "Adrien et c'est un colde",
    ]);
    const broken = {
      ...base,
      draftStatus: "none" as const,
      draftContent: undefined,
    };
    const repaired = reduceOutreachWorkflowState(
      broken,
      parseOutreachMessage("T'as rien écrit dans le brouillon."),
    );
    expect(repaired.campaignName).toBe("Adrien");
    expect(repaired.campaignType).toBe("cold");
    expect(repaired.draftStatus).toBe("prepared");
    expect(repaired.draftContent?.subject).toBeTruthy();
    expect(repaired.draftContent?.body).toBeTruthy();
  });

  it("never marks draft as created without a real campaignId", () => {
    const state = reduceOutreachWorkflowState(
      {
        workflow: "outreach_campaign",
        campaignName: "Adrien",
        campaignType: "cold",
        draftStatus: "created",
        campaignId: undefined,
        draftContent: prepareOutreachDraftContent({
          campaignName: "Adrien",
          campaignType: "cold",
        }),
      },
      parseOutreachMessage("La campagne"),
    );
    expect(state.draftStatus).toBe("prepared");
  });

  it("builds deterministic copy for ask/prepared/complaint", () => {
    const ask = buildOutreachAskFieldsMessage({ workflow: "outreach_campaign" });
    expect(ask).toContain("nom");
    const prepared = buildOutreachDraftPreparedMessage({
      workflow: "outreach_campaign",
      campaignName: "Adrien",
      campaignType: "cold",
      draftStatus: "prepared",
      draftContent: prepareOutreachDraftContent({
        campaignName: "Adrien",
        campaignType: "cold",
      }),
    });
    expect(prepared).toContain("Aucun envoi n’a été lancé");
    const fixed = buildOutreachDraftComplaintFixedMessage({
      workflow: "outreach_campaign",
      campaignName: "Adrien",
      campaignType: "cold",
      draftStatus: "prepared",
      draftContent: prepareOutreachDraftContent({
        campaignName: "Adrien",
        campaignType: "cold",
      }),
    });
    expect(fixed).toContain("Tu as raison");
    expect(fixed.toLowerCase()).not.toContain("sourcing");
  });
});
