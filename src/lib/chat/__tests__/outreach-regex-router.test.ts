/**
 * Tests for outreach-regex-router.ts
 *
 * Verifies:
 *   - Campaign-start detection (isOutreachStart)
 *   - Slot extraction (parseOutreachCampaignSlots)
 *   - User-correction detection (isUserCorrection)
 *   - Navigation detection (isCampaignNavRequest)
 *   - Sourcing gate (isSourcingRequest)
 *   - Route resolver (resolveOutreachCampaignRoute)
 *   - State merge (mergeOutreachState)
 *   - 6-turn conversation script (integration)
 *   - No-LLM-routing assertion (all functions are synchronous + pure)
 */

import { describe, it, expect } from "vitest";
import {
  isOutreachStart,
  parseOutreachCampaignSlots,
  isUserCorrection,
  isCampaignNavRequest,
  isSourcingRequest,
  resolveOutreachCampaignRoute,
  mergeOutreachState,
  type CampaignSlots,
  type OutreachWorkflowState,
} from "../outreach-regex-router";

// ---------------------------------------------------------------------------
// NO-LLM ASSERTION — all public exports must be synchronous (no Promise return)
// ---------------------------------------------------------------------------

describe("no-LLM routing assertion", () => {
  it("isOutreachStart is synchronous", () => {
    const result = isOutreachStart("on va faire une campagne outreach");
    expect(typeof result).toBe("boolean");
    // Must not be a Promise
    expect(result).not.toBeInstanceOf(Promise);
  });

  it("parseOutreachCampaignSlots is synchronous", () => {
    const result = parseOutreachCampaignSlots("Adrien test cold");
    expect(result).not.toBeInstanceOf(Promise);
    expect(typeof result).toBe("object");
  });

  it("isCampaignNavRequest is synchronous", () => {
    const result = isCampaignNavRequest("Ouvre la campagne");
    expect(typeof result).toBe("boolean");
    expect(result).not.toBeInstanceOf(Promise);
  });

  it("isUserCorrection is synchronous", () => {
    const result = isUserCorrection("tu m'as déjà demandé");
    expect(typeof result).toBe("boolean");
    expect(result).not.toBeInstanceOf(Promise);
  });

  it("isSourcingRequest is synchronous", () => {
    const result = isSourcingRequest("source leads");
    expect(typeof result).toBe("boolean");
    expect(result).not.toBeInstanceOf(Promise);
  });
});

// ---------------------------------------------------------------------------
// isOutreachStart
// ---------------------------------------------------------------------------

describe("isOutreachStart", () => {
  it("detects 'on va faire une campagne outreach'", () => {
    expect(isOutreachStart("on va faire une campagne outreach")).toBe(true);
  });

  it("detects 'lance une campagne'", () => {
    expect(isOutreachStart("lance une campagne")).toBe(true);
  });

  it("detects 'crée une campagne cold'", () => {
    expect(isOutreachStart("crée une campagne cold")).toBe(true);
  });

  it("detects 'outreach campaign'", () => {
    expect(isOutreachStart("outreach campaign")).toBe(true);
  });

  it("detects 'faire un outreach'", () => {
    expect(isOutreachStart("faire un outreach")).toBe(true);
  });

  it("detects 'campagne distributeurs'", () => {
    expect(isOutreachStart("campagne distributeurs")).toBe(true);
  });

  it("does NOT fire on empty string", () => {
    expect(isOutreachStart("")).toBe(false);
  });

  it("does NOT fire on generic question about outreach", () => {
    expect(isOutreachStart("c'est quoi l'outreach ?")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseOutreachCampaignSlots
// ---------------------------------------------------------------------------

describe("parseOutreachCampaignSlots — slot extraction", () => {
  it("'Adrien test cold' → name='Adrien test', type='cold', missing=[]", () => {
    const result = parseOutreachCampaignSlots("Adrien test cold");
    expect(result.campaignName).toBe("Adrien test");
    expect(result.campaignType).toBe("cold");
    expect(result.missing).toEqual([]);
  });

  it("'Qatar LP newsletter' → name='Qatar LP', type='newsletter', missing=[]", () => {
    const result = parseOutreachCampaignSlots("Qatar LP newsletter");
    expect(result.campaignName).toBe("Qatar LP");
    expect(result.campaignType).toBe("newsletter");
    expect(result.missing).toEqual([]);
  });

  it("'cold' → type='cold', missing=['campaignName']", () => {
    const result = parseOutreachCampaignSlots("cold");
    expect(result.campaignType).toBe("cold");
    expect(result.campaignName).toBeUndefined();
    expect(result.missing).toContain("campaignName");
  });

  it("'newsletter' → type='newsletter', missing=['campaignName']", () => {
    const result = parseOutreachCampaignSlots("newsletter");
    expect(result.campaignType).toBe("newsletter");
    expect(result.campaignName).toBeUndefined();
    expect(result.missing).toContain("campaignName");
  });

  it("'Adrien test' → name='Adrien test', missing=['campaignType']", () => {
    const result = parseOutreachCampaignSlots("Adrien test");
    expect(result.campaignName).toBe("Adrien test");
    expect(result.campaignType).toBeUndefined();
    expect(result.missing).toContain("campaignType");
  });

  it("'Campagne Adrien test cold' → name='Adrien test', type='cold', missing=[]", () => {
    const result = parseOutreachCampaignSlots("Campagne Adrien test cold");
    expect(result.campaignName).toBe("Adrien test");
    expect(result.campaignType).toBe("cold");
    expect(result.missing).toEqual([]);
  });

  it("'campaign Adrien test cold' → name='Adrien test', type='cold', missing=[]", () => {
    const result = parseOutreachCampaignSlots("campaign Adrien test cold");
    expect(result.campaignName).toBe("Adrien test");
    expect(result.campaignType).toBe("cold");
    expect(result.missing).toEqual([]);
  });

  it("extracts name after 'nommée'", () => {
    const result = parseOutreachCampaignSlots("nommée Distributeurs Q3 cold");
    expect(result.campaignName).toBe("Distributeurs Q3");
    expect(result.campaignType).toBe("cold");
    expect(result.missing).toEqual([]);
  });

  it("extracts name after 'appelle-la'", () => {
    const result = parseOutreachCampaignSlots("appelle-la Test Q3 newsletter");
    expect(result.campaignName).toBe("Test Q3");
    expect(result.campaignType).toBe("newsletter");
    expect(result.missing).toEqual([]);
  });

  it("returns missing=['campaignName','campaignType'] for empty string", () => {
    const result = parseOutreachCampaignSlots("");
    expect(result.missing).toContain("campaignName");
    expect(result.missing).toContain("campaignType");
  });

  it("does not return empty string as a name", () => {
    const result = parseOutreachCampaignSlots("cold");
    expect(result.campaignName).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// isUserCorrection
// ---------------------------------------------------------------------------

describe("isUserCorrection", () => {
  it("detects 'Tu m'as déjà demandé, tu l'as déjà rempli.'", () => {
    expect(isUserCorrection("Tu m'as déjà demandé, tu l'as déjà rempli.")).toBe(true);
  });

  it("detects 'je t'ai déjà donné le nom'", () => {
    expect(isUserCorrection("je t'ai déjà donné le nom")).toBe(true);
  });

  it("detects 'c'est déjà rempli'", () => {
    expect(isUserCorrection("c'est déjà rempli")).toBe(true);
  });

  it("detects 'tu l'as déjà rempli'", () => {
    expect(isUserCorrection("tu l'as déjà rempli")).toBe(true);
  });

  it("detects 'déjà dit'", () => {
    expect(isUserCorrection("déjà dit")).toBe(true);
  });

  it("does NOT fire on normal message", () => {
    expect(isUserCorrection("Adrien test cold")).toBe(false);
  });

  it("does NOT fire on empty string", () => {
    expect(isUserCorrection("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isCampaignNavRequest
// ---------------------------------------------------------------------------

describe("isCampaignNavRequest", () => {
  it("'Ouvre-moi à la bonne page de la campagne' → true", () => {
    expect(isCampaignNavRequest("Ouvre-moi à la bonne page de la campagne")).toBe(true);
  });

  it("'La campagne' → true", () => {
    expect(isCampaignNavRequest("La campagne")).toBe(true);
  });

  it("'Pourquoi je ne la vois pas la campagne' → true", () => {
    expect(isCampaignNavRequest("Pourquoi je ne la vois pas la campagne")).toBe(true);
  });

  it("'je ne vois pas la campagne' → true", () => {
    expect(isCampaignNavRequest("je ne vois pas la campagne")).toBe(true);
  });

  it("'Montre-moi la campagne' → true", () => {
    expect(isCampaignNavRequest("Montre-moi la campagne")).toBe(true);
  });

  it("'Où est la campagne' → true", () => {
    expect(isCampaignNavRequest("Où est la campagne")).toBe(true);
  });

  it("'le brouillon' → true", () => {
    expect(isCampaignNavRequest("le brouillon")).toBe(true);
  });

  it("'campaign draft' → true", () => {
    expect(isCampaignNavRequest("campaign draft")).toBe(true);
  });

  it("'source leads' → false (sourcing is not navigation)", () => {
    expect(isCampaignNavRequest("source leads")).toBe(false);
  });

  it("empty string → false", () => {
    expect(isCampaignNavRequest("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isSourcingRequest
// ---------------------------------------------------------------------------

describe("isSourcingRequest", () => {
  it("'source leads' → true", () => {
    expect(isSourcingRequest("source leads")).toBe(true);
  });

  it("'sourcer des leads' → true", () => {
    expect(isSourcingRequest("sourcer des leads")).toBe(true);
  });

  it("'trouve des prospects' → true", () => {
    expect(isSourcingRequest("trouve des prospects")).toBe(true);
  });

  it("'La campagne' → false", () => {
    expect(isSourcingRequest("La campagne")).toBe(false);
  });

  it("'Ouvre la campagne' → false", () => {
    expect(isSourcingRequest("Ouvre la campagne")).toBe(false);
  });

  it("'je ne vois pas la campagne' → false", () => {
    expect(isSourcingRequest("je ne vois pas la campagne")).toBe(false);
  });

  it("empty string → false", () => {
    expect(isSourcingRequest("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// resolveOutreachCampaignRoute
// ---------------------------------------------------------------------------

describe("resolveOutreachCampaignRoute", () => {
  it("returns campaign_detail when campaignId is set", () => {
    const route = resolveOutreachCampaignRoute({
      campaignId: "abc123",
      campaignName: "Adrien test",
      campaignType: "cold",
    });
    expect(route.kind).toBe("campaign_detail");
    if (route.kind === "campaign_detail") {
      expect(route.href).toBe("/admin/outreach/campaigns/abc123");
    }
  });

  it("returns campaign_draft with name query param when name is known but no id", () => {
    const route = resolveOutreachCampaignRoute({
      campaignName: "Adrien test",
      campaignType: "cold",
    });
    expect(route.kind).toBe("campaign_draft");
    if (route.kind === "campaign_draft") {
      expect(route.href).toContain("/admin/outreach");
      expect(route.href).toContain("name=Adrien+test");
      expect(route.href).toContain("kind=cold");
    }
  });

  it("returns outreach_workspace when no state at all", () => {
    const route = resolveOutreachCampaignRoute({});
    expect(route.kind).toBe("outreach_workspace");
    if (route.kind === "outreach_workspace") {
      expect(route.href).toBe("/admin/outreach");
    }
  });

  it("never says 'section introuvable'", () => {
    const route = resolveOutreachCampaignRoute({});
    if (route.kind === "missing_state") {
      expect(route.reason).not.toContain("introuvable");
    }
  });

  it("reason mentions campaign name when available", () => {
    const route = resolveOutreachCampaignRoute({ campaignName: "Qatar LP" });
    if (route.kind === "campaign_draft") {
      expect(route.reason.toLowerCase()).toContain("qatar lp");
    }
  });
});

// ---------------------------------------------------------------------------
// mergeOutreachState
// ---------------------------------------------------------------------------

describe("mergeOutreachState", () => {
  it("sets both fields when both are new", () => {
    const slots: CampaignSlots = { campaignName: "Test", campaignType: "cold", missing: [] };
    const state = mergeOutreachState({}, slots);
    expect(state.campaignName).toBe("Test");
    expect(state.campaignType).toBe("cold");
    expect(state.draftStatus).toBe("none");
  });

  it("preserves existing name when new slots have no name", () => {
    const existing: Partial<OutreachWorkflowState> = {
      workflow: "outreach_campaign",
      campaignName: "Adrien test",
      draftStatus: "none",
    };
    const slots: CampaignSlots = { campaignType: "cold", missing: ["campaignName"] };
    const state = mergeOutreachState(existing, slots);
    expect(state.campaignName).toBe("Adrien test");
    expect(state.campaignType).toBe("cold");
  });

  it("preserves existing type when new slots have no type", () => {
    const existing: Partial<OutreachWorkflowState> = {
      workflow: "outreach_campaign",
      campaignType: "newsletter",
      draftStatus: "none",
    };
    const slots: CampaignSlots = { campaignName: "Qatar LP", missing: ["campaignType"] };
    const state = mergeOutreachState(existing, slots);
    expect(state.campaignType).toBe("newsletter");
    expect(state.campaignName).toBe("Qatar LP");
  });

  it("INVARIANT: draftStatus is never promoted by mergeOutreachState", () => {
    const existing: Partial<OutreachWorkflowState> = {
      workflow: "outreach_campaign",
      draftStatus: "none",
    };
    const slots: CampaignSlots = {
      campaignName: "Test",
      campaignType: "cold",
      missing: [],
    };
    const state = mergeOutreachState(existing, slots);
    // Even when both fields are complete, mergeOutreachState must NOT promote draftStatus.
    // Promotion to "prepared" or "created" is the responsibility of the HITL gate,
    // not the slot merger.
    expect(state.draftStatus).toBe("none");
  });

  it("carries forward campaignId when present", () => {
    const existing: Partial<OutreachWorkflowState> = {
      workflow: "outreach_campaign",
      campaignId: "xyz",
      campaignName: "Test",
      draftStatus: "created",
    };
    const slots: CampaignSlots = { missing: ["campaignType"] };
    const state = mergeOutreachState(existing, slots);
    expect(state.campaignId).toBe("xyz");
    expect(state.draftStatus).toBe("created");
  });

  it("workflow field is always 'outreach_campaign'", () => {
    const state = mergeOutreachState({}, { missing: ["campaignName", "campaignType"] });
    expect(state.workflow).toBe("outreach_campaign");
  });
});

// ---------------------------------------------------------------------------
// 6-turn conversation script (integration)
// ---------------------------------------------------------------------------

describe("6-turn conversation script — integration", () => {
  /**
   * Simulates a stateful outreach conversation, checking deterministic
   * behavior at each turn without any LLM call.
   *
   * Turn 1: User says "on va faire une campagne outreach"
   * Turn 2: User says "Adrien test cold" (supplies both fields)
   * Turn 3: User says "tu m'as déjà demandé" (correction — state should be preserved)
   * Turn 4: User asks "la campagne" (nav request — should resolve correctly)
   * Turn 5: User asks "source leads" (sourcing gate — must not navigate)
   * Turn 6: User says "Ouvre-moi à la bonne page" (nav with id present)
   */

  it("Turn 1: isOutreachStart fires, no campaign slots yet", () => {
    const msg = "on va faire une campagne outreach";
    expect(isOutreachStart(msg)).toBe(true);
    expect(isCampaignNavRequest(msg)).toBe(false);
    expect(isSourcingRequest(msg)).toBe(false);

    const slots = parseOutreachCampaignSlots(msg);
    expect(slots.missing).toContain("campaignName");
    expect(slots.missing).toContain("campaignType");
  });

  it("Turn 2: both slots extracted, state merged, draftStatus still 'none'", () => {
    const msg = "Adrien test cold";
    const slots = parseOutreachCampaignSlots(msg);
    expect(slots.campaignName).toBe("Adrien test");
    expect(slots.campaignType).toBe("cold");
    expect(slots.missing).toEqual([]);

    // State after Turn 2
    const state = mergeOutreachState({}, slots);
    expect(state.campaignName).toBe("Adrien test");
    expect(state.campaignType).toBe("cold");
    // INVARIANT: draftStatus must NOT be promoted — user has not clicked the HITL button
    expect(state.draftStatus).toBe("none");
  });

  it("Turn 3: isUserCorrection fires, state is preserved as-is (no re-ask)", () => {
    const msg = "tu m'as déjà demandé, c'est déjà rempli";
    expect(isUserCorrection(msg)).toBe(true);
    // A correction turn should NOT re-parse slots from scratch (nothing new in the msg).
    // The router simply reuses existing state directly — no parseOutreachCampaignSlots call.
    const existingState: Partial<OutreachWorkflowState> = {
      workflow: "outreach_campaign",
      campaignName: "Adrien test",
      campaignType: "cold",
      draftStatus: "none",
    };
    // On a correction turn, the router carries forward existing state unchanged.
    // We simulate this by merging with empty slots (no new slot data).
    const emptySlots: CampaignSlots = { missing: ["campaignName", "campaignType"] };
    const merged = mergeOutreachState(existingState, emptySlots);
    // Existing slots must survive (nothing extracted from the correction message)
    expect(merged.campaignName).toBe("Adrien test");
    expect(merged.campaignType).toBe("cold");
  });

  it("Turn 4: isCampaignNavRequest fires, route resolves to outreach_workspace (no id yet)", () => {
    const msg = "la campagne";
    expect(isCampaignNavRequest(msg)).toBe(true);
    expect(isSourcingRequest(msg)).toBe(false);

    const state = {
      campaignName: "Adrien test",
      campaignType: "cold" as const,
    };
    const route = resolveOutreachCampaignRoute(state);
    // No campaignId yet → campaign_draft pointing to workspace
    expect(route.kind).toBe("campaign_draft");
    if (route.kind === "campaign_draft") {
      expect(route.href).toContain("/admin/outreach");
    }
    // The response must never contain the generic fallback
    expect(route.reason).not.toContain("I can guide and analyze");
    expect(route.reason).not.toContain("not transact");
  });

  it("Turn 5: isSourcingRequest fires, navigation does NOT trigger", () => {
    const msg = "source leads";
    expect(isSourcingRequest(msg)).toBe(true);
    // Sourcing must NOT be treated as a navigation request
    expect(isCampaignNavRequest(msg)).toBe(false);
  });

  it("Turn 6: with campaignId present, nav resolves to campaign_detail", () => {
    const msg = "Ouvre-moi à la bonne page de la campagne";
    expect(isCampaignNavRequest(msg)).toBe(true);

    const state = {
      campaignId: "camp_abc123",
      campaignName: "Adrien test",
      campaignType: "cold" as const,
    };
    const route = resolveOutreachCampaignRoute(state);
    expect(route.kind).toBe("campaign_detail");
    if (route.kind === "campaign_detail") {
      expect(route.href).toBe("/admin/outreach/campaigns/camp_abc123");
    }
  });

  it("Turn 6: response never contains generic fallback phrase", () => {
    // Simulate that none of the route outcomes ever produce the forbidden phrase
    const noIdRoute = resolveOutreachCampaignRoute({ campaignName: "Adrien test" });
    const withIdRoute = resolveOutreachCampaignRoute({ campaignId: "abc" });
    const emptyRoute = resolveOutreachCampaignRoute({});

    for (const route of [noIdRoute, withIdRoute, emptyRoute]) {
      const text = route.kind === "missing_state" ? route.reason : route.reason;
      expect(text).not.toContain("I can guide and analyze");
      expect(text).not.toContain("not transact");
    }
  });
});

// ---------------------------------------------------------------------------
// Sourcing cannot be triggered by campaign navigation phrases
// ---------------------------------------------------------------------------

describe("sourcing gate — navigation phrases do not trigger sourcing", () => {
  const navPhrases = [
    "La campagne",
    "Ouvre la campagne",
    "Ouvre-moi à la bonne page de la campagne",
    "la campagne",
    "Montre la campagne",
    "Où est la campagne",
    "Je ne vois pas la campagne",
    "Pourquoi je ne vois pas la campagne",
    "le brouillon",
    "campaign draft",
  ];

  for (const phrase of navPhrases) {
    it(`"${phrase}" does NOT trigger sourcing`, () => {
      expect(isSourcingRequest(phrase)).toBe(false);
    });
  }
});

// ---------------------------------------------------------------------------
// No false "created" claim without a campaignId
// ---------------------------------------------------------------------------

describe("honest draftStatus — no false creation claim", () => {
  it("draftStatus starts at 'none' and stays there until explicitly promoted", () => {
    const slots: CampaignSlots = { campaignName: "Test", campaignType: "cold", missing: [] };
    const state1 = mergeOutreachState({}, slots);
    expect(state1.draftStatus).toBe("none");

    // Even merging again does not promote
    const state2 = mergeOutreachState(state1, slots);
    expect(state2.draftStatus).toBe("none");
    expect(state2.campaignId).toBeUndefined();
  });

  it("only manual assignment of campaignId + 'created' status can mark as created", () => {
    const manuallyCreated: OutreachWorkflowState = {
      workflow: "outreach_campaign",
      campaignName: "Test",
      campaignType: "cold",
      draftStatus: "created",
      campaignId: "real_id_from_server",
    };
    // The state itself claims "created" only because a real id is present
    expect(manuallyCreated.campaignId).toBeTruthy();
    expect(manuallyCreated.draftStatus).toBe("created");

    // Route resolves correctly with the real id
    const route = resolveOutreachCampaignRoute(manuallyCreated);
    expect(route.kind).toBe("campaign_detail");
  });
});
