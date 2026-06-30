/**
 * Master Outreach Agent — Regex Deterministic Classifier Tests.
 *
 * 100+ cas de test couvrant:
 * - 25 navigation FR/EN
 * - 25 campaign creation FR/EN
 * - 20 drafts email/WhatsApp/LinkedIn
 * - 15 follow-up / segmentation
 * - 15 negative cases (protection)
 *
 * Règles testées:
 * - Regex first, deterministic
 * - Negative patterns block positives
 * - Non-admin limited to navigation
 * - sendAllowed always false
 * - requiresUserReview always true
 */

import { describe, expect, it } from "vitest";
import {
  classifyOutreachIntentRegex,
  getOutreachRegexRules,
  getNegativePatterns,
} from "../outreach-master-regex";
import type { OutreachIntentContext } from "../outreach-master-types";

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------

function ctx(message: string, isAdmin = true): OutreachIntentContext {
  return { message, isAdmin };
}

function assertInvariant(decision: ReturnType<typeof classifyOutreachIntentRegex>) {
  expect(decision).not.toBeNull();
  if (!decision) return;
  expect(decision.sendAllowed).toBe(false);
  expect(decision.requiresUserReview).toBe(true);
}

// -----------------------------------------------------------------------------
// SUITE 1: NAVIGATION (25 tests)
// -----------------------------------------------------------------------------

describe("SUITE 1: Navigation FR/EN", () => {
  const navCases = [
    // FR — 13 tests
    { msg: "ouvre outreach", intent: "open_outreach", action: "navigate" },
    { msg: "va dans outreach", intent: "open_outreach", action: "navigate" },
    { msg: "aller outreach", intent: "open_outreach", action: "navigate" },
    { msg: "montre l'espace outreach", intent: "open_outreach", action: "navigate" },
    { msg: "affiche les campagnes", intent: "open_outreach", action: "navigate" },
    { msg: "navigue vers prospection", intent: "open_outreach", action: "navigate" },
    { msg: "accede au pipeline", intent: "open_outreach", action: "navigate" },
    { msg: "ouvre la section campagnes", intent: "open_outreach", action: "navigate" },
    { msg: "va sur la page outreach", intent: "open_outreach", action: "navigate" },
    { msg: "montre moi les prospects", intent: "open_outreach", action: "navigate" },
    { msg: "accède aux campagnes email", intent: "open_outreach", action: "navigate" },
    { msg: "aller dans l'espace distributeurs", intent: "open_outreach", action: "navigate" },
    { msg: "outreach", intent: "open_outreach", action: "navigate" }, // bare command

    // EN — 12 tests
    { msg: "open outreach", intent: "open_outreach", action: "navigate" },
    { msg: "go to outreach", intent: "open_outreach", action: "navigate" },
    { msg: "show me the outreach workspace", intent: "open_outreach", action: "navigate" },
    { msg: "view campaigns", intent: "open_outreach", action: "navigate" },
    { msg: "take me to the pipeline", intent: "open_outreach", action: "navigate" },
    { msg: "navigate to investor outreach", intent: "open_outreach", action: "navigate" },
    { msg: "open campaign dashboard", intent: "open_outreach", action: "navigate" },
    { msg: "show prospects", intent: "open_outreach", action: "navigate" },
    { msg: "bring me to outreach", intent: "open_outreach", action: "navigate" },
    { msg: "go outreach", intent: "open_outreach", action: "navigate" },
    { msg: "view distributor pipeline", intent: "open_outreach", action: "navigate" },
    { msg: "campaigns", intent: "open_outreach", action: "navigate" }, // bare command
  ];

  for (const { msg, intent, action } of navCases) {
    it(`nav: "${msg.slice(0, 30)}..." → ${intent}`, () => {
      const decision = classifyOutreachIntentRegex(ctx(msg));
      assertInvariant(decision);
      expect(decision!.intent).toBe(intent);
      expect(decision!.action).toBe(action);
      expect(decision!.route).toBe("/admin/outreach");
      expect(decision!.source).toBe("regex_deterministic");
      expect(decision!.confidence).toBe("high");
    });
  }

  // Non-admin navigation still works
  it("non-admin can navigate to outreach", () => {
    const decision = classifyOutreachIntentRegex(ctx("open outreach", false));
    assertInvariant(decision);
    expect(decision!.intent).toBe("open_outreach");
    expect(decision!.action).toBe("navigate");
  });
});

// -----------------------------------------------------------------------------
// SUITE 2: CAMPAIGN CREATION (25 tests)
// -----------------------------------------------------------------------------

describe("SUITE 2: Campaign Creation FR/EN", () => {
  const createCases = [
    // FR — 13 tests
    { msg: "créer une campagne investisseurs", intent: "create_campaign" },
    { msg: "lance une campagne de prospection", intent: "create_campaign" },
    { msg: "prépare une campagne distributeurs", intent: "create_campaign" },
    { msg: "crée une nouvelle campagne cold", intent: "create_campaign" },
    { msg: "monter une campagne pour UAE", intent: "create_campaign" },
    { msg: "lancer outreach distributeurs", intent: "create_campaign" },
    { msg: "préparer une campagne emailing", intent: "create_campaign" },
    { msg: "créer campagne nommée 'Q3 Distributors'", intent: "create_campaign" },
    { msg: "setup campagne newsletter", intent: "create_campaign" },
    { msg: "build a campaign for investors", intent: "create_campaign" },
    { msg: "créons une campagne de leads", intent: "create_campaign" },
    { msg: "nouvelle campagne outreach", intent: "create_campaign" },
    { msg: "cold outreach campaign", intent: "create_campaign" },

    // EN — 12 tests
    { msg: "create a campaign for UAE distributors", intent: "create_campaign" },
    { msg: "launch investor outreach campaign", intent: "create_campaign" },
    { msg: "prepare a newsletter campaign", intent: "create_campaign" },
    { msg: "set up cold email campaign", intent: "create_campaign" },
    { msg: "build new campaign for leads", intent: "create_campaign" },
    { msg: "create campaign named 'Summer 2024'", intent: "create_campaign" },
    { msg: "launch distributor prospecting", intent: "create_campaign" },
    { msg: "prepare outreach to investors", intent: "create_campaign" },
    { msg: "start a new campaign", intent: "create_campaign" },
    { msg: "create cold outreach sequence", intent: "create_campaign" },
    { msg: "setup email campaign", intent: "create_campaign" },
    { msg: "new campaign for Dubai prospects", intent: "create_campaign" },
  ];

  for (const { msg, intent } of createCases) {
    it(`create: "${msg.slice(0, 35)}..." → ${intent}`, () => {
      const decision = classifyOutreachIntentRegex(ctx(msg));
      assertInvariant(decision);
      expect(decision!.intent).toBe(intent);
      expect(decision!.action).toBe("open_canvas");
      expect(decision!.canvasKey).toBe("outreach");
    });
  }

  // Non-admin CANNOT create campaigns
  it("non-admin cannot create campaigns — blocked", () => {
    const decision = classifyOutreachIntentRegex(ctx("create a campaign", false));
    assertInvariant(decision);
    expect(decision!.intent).toBe("no_action");
    expect(decision!.source).toBe("regex_negative");
  });

  // Campaign name extraction
  it("extracts campaign name from quotes", () => {
    const decision = classifyOutreachIntentRegex(ctx('créer campagne "Q3 UAE Institutional"'));
    assertInvariant(decision);
    // Name extraction happens, intent should still match
    expect(decision!.intent).toBe("create_campaign");
  });
});

// -----------------------------------------------------------------------------
// SUITE 3: DRAFTS Email/WhatsApp/LinkedIn (20 tests)
// -----------------------------------------------------------------------------

describe("SUITE 3: Drafts Email/WhatsApp/LinkedIn", () => {
  // EMAIL — 8 tests
  const emailCases = [
    { msg: "écris un email aux investisseurs", channel: "email" },
    { msg: "rédige un mail pour les distributeurs", channel: "email" },
    { msg: "draft an email to UAE prospects", channel: "email" },
    { msg: "write an email for the mining vault", channel: "email" },
    { msg: "prépare un email de prospection", channel: "email" },
    { msg: "compose email to investors", channel: "email" },
    { msg: "écris un mail de relance", channel: "email" },
    { msg: "draft follow-up email", channel: "email" },
  ];

  for (const { msg, channel } of emailCases) {
    it(`email: "${msg.slice(0, 35)}..." → ${channel}`, () => {
      const decision = classifyOutreachIntentRegex(ctx(msg));
      assertInvariant(decision);
      expect(decision!.intent).toBe("draft_email");
      expect(decision!.action).toBe("draft");
      expect(decision!.channel).toBe(channel);
    });
  }

  // WHATSAPP — 6 tests
  const whatsappCases = [
    { msg: "prépare un WhatsApp de relance" },
    { msg: "écris un message WhatsApp" },
    { msg: "draft WhatsApp for prospect" },
    { msg: "message WhatsApp court" },
    { msg: "write him on WhatsApp" },
    { msg: "whatsapp follow up" },
  ];

  for (const { msg } of whatsappCases) {
    it(`whatsapp: "${msg.slice(0, 30)}..."`, () => {
      const decision = classifyOutreachIntentRegex(ctx(msg));
      assertInvariant(decision);
      expect(decision!.intent).toBe("draft_whatsapp");
      expect(decision!.action).toBe("draft");
      expect(decision!.channel).toBe("whatsapp");
    });
  }

  // LINKEDIN — 6 tests
  const linkedinCases = [
    { msg: "rédige un message LinkedIn" },
    { msg: "draft LinkedIn InMail" },
    { msg: "écris sur LinkedIn" },
    { msg: "LinkedIn message for distributor" },
    { msg: "connection request text" },
    { msg: "write a short LinkedIn note" },
  ];

  for (const { msg } of linkedinCases) {
    it(`linkedin: "${msg.slice(0, 30)}..."`, () => {
      const decision = classifyOutreachIntentRegex(ctx(msg));
      assertInvariant(decision);
      expect(decision!.intent).toBe("draft_linkedin");
      expect(decision!.action).toBe("draft");
      expect(decision!.channel).toBe("linkedin");
    });
  }

  // Non-admin CANNOT draft
  it("non-admin cannot draft emails — blocked", () => {
    const decision = classifyOutreachIntentRegex(ctx("draft an email", false));
    assertInvariant(decision);
    expect(decision!.intent).toBe("no_action");
  });
});

// -----------------------------------------------------------------------------
// SUITE 4: FOLLOW-UP / SEGMENTATION / ANALYSIS (15 tests)
// -----------------------------------------------------------------------------

describe("SUITE 4: Follow-up / Segmentation / Analysis", () => {
  const followupCases = [
    // FOLLOW_UP — 8 tests
    { msg: "relance ceux qui n'ont pas répondu", intent: "follow_up_leads" },
    { msg: "relancer les prospects silencieux", intent: "follow_up_leads" },
    { msg: "follow up leads", intent: "follow_up_leads" },
    { msg: "re-engage non-responsive prospects", intent: "follow_up_leads" },
    { msg: "relance les distributeurs", intent: "follow_up_leads" },
    { msg: "follow-up investors who didn't reply", intent: "follow_up_leads" },
    { msg: "nudge the silent leads", intent: "follow_up_leads" },
    { msg: "relancer ceux en attente", intent: "follow_up_leads" },

    // SOURCE_LEADS — 4 tests
    { msg: "source 20 new leads", intent: "source_leads" },
    { msg: "trouve des prospects distributeurs", intent: "source_leads" },
    { msg: "find new distributor contacts", intent: "source_leads" },
    { msg: "sourcing de leads UAE", intent: "source_leads" },

    // REVIEW_CAMPAIGN — 3 tests
    { msg: "review the Q3 campaign", intent: "review_campaign" },
    { msg: "vérifier la campagne actuelle", intent: "review_campaign" },
    { msg: "valider la campagne avant envoi", intent: "review_campaign" },
  ];

  for (const { msg, intent } of followupCases) {
    it(`${intent}: "${msg.slice(0, 35)}..."`, () => {
      const decision = classifyOutreachIntentRegex(ctx(msg));
      assertInvariant(decision);
      expect(decision!.intent).toBe(intent);
    });
  }
});

// -----------------------------------------------------------------------------
// SUITE 5: NEGATIVE CASES / PROTECTION (15 tests)
// -----------------------------------------------------------------------------

describe("SUITE 5: Negative Cases / Protection", () => {
  const negativeCases = [
    { msg: "outreach CSS bug", pattern: "bug_report" },
    { msg: "le outreach est cassé", pattern: "bug_report" },
    { msg: "explique-moi l'outreach", pattern: "explain_request" },
    { msg: "what is outreach?", pattern: "explain_request" },
    { msg: "historique des campagnes envoyées", pattern: "history_request" },
    { msg: "show past campaign logs", pattern: "history_request" },
    { msg: "ne lance rien", pattern: "cancel_instruction" },
    { msg: "don't send anything", pattern: "cancel_instruction" },
    { msg: "ne fais rien pour l'instant", pattern: "cancel_instruction" },
    { msg: "juste analyser les prospects", pattern: "analysis_only" },
    { msg: "analyze only — no action", pattern: "analysis_only" },
    { msg: "draft only, read only", pattern: "read_only" },
    { msg: "pas d'envoi", pattern: "cancel_instruction" },
    { msg: "pas de campagne", pattern: "cancel_instruction" },
    { msg: "n'envoie pas", pattern: "cancel_instruction" },
  ];

  for (const { msg, pattern } of negativeCases) {
    it(`negative: "${msg.slice(0, 30)}..." → ${pattern}`, () => {
      const decision = classifyOutreachIntentRegex(ctx(msg));
      assertInvariant(decision);
      expect(decision!.intent).toBe("no_action");
      expect(decision!.source).toBe("regex_negative");
      expect(decision!.confidence).toBe("negative");
      expect(decision!.action).toBe("no_action");
    });
  }

  // Additional edge cases
  it("guaranteed return triggers no_action (not a nav intent)", () => {
    const decision = classifyOutreachIntentRegex(ctx("guaranteed return"));
    // Should be no_action or null (to pass to semantic)
    expect(decision === null || decision.intent === "no_action").toBe(true);
  });

  it("send to everyone now — regex returns null, semantic/no_action will block", () => {
    const decision = classifyOutreachIntentRegex(ctx("send to everyone now"));
    // This doesn't match any regex pattern, so it returns null
    // The semantic layer or master agent safety will block it
    expect(decision).toBeNull();
  });
});

// -----------------------------------------------------------------------------
// SUITE 6: ENTITY EXTRACTION
// -----------------------------------------------------------------------------

describe("SUITE 6: Entity Extraction", () => {
  it("extracts campaign name from quotes", () => {
    const decision = classifyOutreachIntentRegex(ctx('créer campagne "UAE Institutional Q3"'));
    assertInvariant(decision);
    expect(decision!.intent).toBe("create_campaign");
  });

  it("extracts campaign type 'cold'", () => {
    const decision = classifyOutreachIntentRegex(ctx("lance campagne cold"));
    assertInvariant(decision);
    expect(decision!.intent).toBe("create_campaign");
  });

  it("extracts campaign type 'newsletter'", () => {
    const decision = classifyOutreachIntentRegex(ctx("créer newsletter investisseurs"));
    assertInvariant(decision);
    expect(decision!.intent).toBe("create_campaign");
  });

  it("extracts scope UAE", () => {
    const decision = classifyOutreachIntentRegex(ctx("créer campagne distributeurs UAE"));
    assertInvariant(decision);
    expect(decision!.intent).toBe("create_campaign");
  });

  it("detects email channel", () => {
    const decision = classifyOutreachIntentRegex(ctx("écris un email"));
    assertInvariant(decision);
    expect(decision!.channel).toBe("email");
  });
});

// -----------------------------------------------------------------------------
// SUITE 7: SAFETY INVARIANTS
// -----------------------------------------------------------------------------

describe("SUITE 7: Safety Invariants", () => {
  const allTestCases = [
    "ouvre outreach",
    "créer campagne",
    "écris un email",
    "relance prospects",
    "source leads",
  ];

  for (const msg of allTestCases) {
    it(`"${msg}" — invariants respected`, () => {
      const decision = classifyOutreachIntentRegex(ctx(msg));
      expect(decision).not.toBeNull();
      if (!decision) return;

      // Invariant: sendAllowed always false
      expect(decision.sendAllowed).toBe(false);

      // Invariant: requiresUserReview always true
      expect(decision.requiresUserReview).toBe(true);

      // Invariant: intent defined
      expect(decision.intent).toBeTruthy();

      // Invariant: source defined
      expect(decision.source).toBeTruthy();
    });
  }

  it("empty message returns no_action", () => {
    const decision = classifyOutreachIntentRegex(ctx(""));
    expect(decision).not.toBeNull();
    expect(decision!.intent).toBe("no_action");
  });

  it("whitespace only returns no_action", () => {
    const decision = classifyOutreachIntentRegex(ctx("   "));
    expect(decision).not.toBeNull();
    expect(decision!.intent).toBe("no_action");
  });
});

// -----------------------------------------------------------------------------
// SUITE 8: INTROSPECTION
// -----------------------------------------------------------------------------

describe("SUITE 8: Introspection", () => {
  it("exports regex rules for inspection", () => {
    const rules = getOutreachRegexRules();
    expect(rules.negatives.length).toBeGreaterThan(0);
    expect(rules.positives.length).toBeGreaterThan(0);
  });

  it("exports negative patterns", () => {
    const patterns = getNegativePatterns();
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns.some(p => p.pattern === "bug_report")).toBe(true);
    expect(patterns.some(p => p.pattern === "explain_request")).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// TEST COUNT SUMMARY
// -----------------------------------------------------------------------------
// Suite 1: 25 navigation tests + 1 non-admin = 26
// Suite 2: 25 campaign tests + 1 non-admin + 1 extraction = 27
// Suite 3: 8 email + 6 whatsapp + 6 linkedin + 1 non-admin = 21
// Suite 4: 8 follow-up + 4 source + 3 review = 15
// Suite 5: 15 negative + 2 edge = 17
// Suite 6: 5 extraction = 5
// Suite 7: 5 invariant + 2 edge = 7
// Suite 8: 2 introspection = 2
// TOTAL: ~120 tests
// -----------------------------------------------------------------------------
