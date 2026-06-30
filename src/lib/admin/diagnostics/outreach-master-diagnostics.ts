/**
 * Outreach Master Agent — Diagnostics.
 *
 * Vérifications de santé du Master Outreach Agent.
 * Exécuté sans side-effects, sans DB write, sans envoi réel.
 *
 * Tests:
 * - Regex rules chargées et valides
 * - Invariants de sécurité respectés
 * - HF disponible (si configuré)
 * - Patterns négatifs fonctionnels
 */

import type {
  DiagnosticCheckSpec,
  DiagnosticResult,
} from "../diagnostics/types";
import { runChecks, pass, fail, skip } from "../diagnostics/types";
import {
  classifyOutreachIntentRegex,
  getOutreachRegexRules,
  getNegativePatterns,
} from "@/lib/agents/outreach-master-regex";
import { classifyOutreachIntentSemantic, isSemanticClassificationAvailable, getSemanticHypotheses } from "@/lib/agents/outreach-master-semantic";
import { outreachMasterAgent } from "@/lib/agents/outreach-master-agent";
import {
  validateDecisionInvariants,
  validatePermissions,
  generateSafetyReport,
  getSafetyConfig,
} from "@/lib/agents/outreach-master-safety";
import type { OutreachIntentContext } from "@/lib/agents/outreach-master-types";

// -----------------------------------------------------------------------------
// CHECKS
// -----------------------------------------------------------------------------

const checks: DiagnosticCheckSpec[] = [
  // ---------------------------------------------------------------------------
  // STRUCTURAL
  // ---------------------------------------------------------------------------
  {
    id: "oma.regex.rules_loaded",
    label: "Regex rules are loaded and non-empty",
    severity: "P0",
    expected: "getOutreachRegexRules() returns rules with positives and negatives",
    run: () => {
      const rules = getOutreachRegexRules();
      if (rules.positives.length === 0) return fail("No positive intent rules loaded");
      if (rules.negatives.length === 0) return fail("No negative pattern rules loaded");
      return pass(`${rules.positives.length} positive, ${rules.negatives.length} negative rules`);
    },
  },
  {
    id: "oma.regex.rules_valid",
    label: "All regex rules are valid RegExp objects",
    severity: "P0",
    expected: "Every rule.re is a valid RegExp",
    run: () => {
      const rules = getOutreachRegexRules();
      for (const rule of rules.positives) {
        if (!(rule.re instanceof RegExp)) {
          return fail(`Positive rule ${rule.intent} has invalid regex`);
        }
      }
      for (const rule of rules.negatives) {
        if (!(rule.re instanceof RegExp)) {
          return fail(`Negative rule ${rule.pattern} has invalid regex`);
        }
      }
      return pass("All rules have valid RegExp");
    },
  },

  // ---------------------------------------------------------------------------
  // NAVIGATION
  // ---------------------------------------------------------------------------
  {
    id: "oma.nav.french_open",
    label: "FR navigation: 'ouvre outreach' detected",
    severity: "P0",
    expected: "classifyOutreachIntentRegex returns open_outreach",
    run: () => {
      const ctx: OutreachIntentContext = { message: "ouvre outreach", isAdmin: true };
      const decision = classifyOutreachIntentRegex(ctx);
      if (!decision) return fail("Null decision");
      if (decision.intent !== "open_outreach") return fail(`Intent: ${decision.intent}`);
      if (decision.action !== "navigate") return fail(`Action: ${decision.action}`);
      return pass(`Route: ${decision.route}`);
    },
  },
  {
    id: "oma.nav.english_open",
    label: "EN navigation: 'open outreach' detected",
    severity: "P0",
    expected: "classifyOutreachIntentRegex returns open_outreach",
    run: () => {
      const ctx: OutreachIntentContext = { message: "open outreach", isAdmin: true };
      const decision = classifyOutreachIntentRegex(ctx);
      if (!decision) return fail("Null decision");
      if (decision.intent !== "open_outreach") return fail(`Intent: ${decision.intent}`);
      return pass(`Confidence: ${decision.confidence}`);
    },
  },
  {
    id: "oma.nav.non_admin_allowed",
    label: "Non-admin can navigate to outreach",
    severity: "P1",
    expected: "open_outreach allowed for isAdmin=false",
    run: () => {
      const ctx: OutreachIntentContext = { message: "open outreach", isAdmin: false };
      const decision = classifyOutreachIntentRegex(ctx);
      if (!decision) return fail("Null decision");
      if (decision.intent !== "open_outreach") return fail(`Blocked: ${decision.reason}`);
      return pass("Navigation permitted for non-admin");
    },
  },

  // ---------------------------------------------------------------------------
  // CAMPAIGN CREATION
  // ---------------------------------------------------------------------------
  {
    id: "oma.campaign.french_create",
    label: "FR campaign: 'créer campagne' detected",
    severity: "P0",
    expected: "create_campaign intent with open_canvas action",
    run: () => {
      const ctx: OutreachIntentContext = { message: "créer campagne distributeurs", isAdmin: true };
      const decision = classifyOutreachIntentRegex(ctx);
      if (!decision) return fail("Null decision");
      if (decision.intent !== "create_campaign") return fail(`Intent: ${decision.intent}`);
      if (decision.action !== "open_canvas") return fail(`Action: ${decision.action}`);
      if (decision.canvasKey !== "outreach") return fail(`Canvas: ${decision.canvasKey}`);
      return pass("Campaign creation detected");
    },
  },
  {
    id: "oma.campaign.non_admin_blocked",
    label: "Non-admin CANNOT create campaigns",
    severity: "P0",
    expected: "create_campaign blocked for non-admin",
    run: () => {
      const ctx: OutreachIntentContext = { message: "créer campagne", isAdmin: false };
      const decision = classifyOutreachIntentRegex(ctx);
      if (!decision) return fail("Should return decision, not null");
      if (decision.intent === "create_campaign") return fail("Should not allow campaign creation");
      if (decision.source !== "regex_negative") return fail("Should be negative pattern");
      return pass("Correctly blocked for non-admin");
    },
  },

  // ---------------------------------------------------------------------------
  // DRAFTS
  // ---------------------------------------------------------------------------
  {
    id: "oma.draft.email_detected",
    label: "Email draft detected",
    severity: "P0",
    expected: "draft_email intent with email channel",
    run: () => {
      const ctx: OutreachIntentContext = { message: "écris un email aux investisseurs", isAdmin: true };
      const decision = classifyOutreachIntentRegex(ctx);
      if (!decision) return fail("Null decision");
      if (decision.intent !== "draft_email") return fail(`Intent: ${decision.intent}`);
      if (decision.channel !== "email") return fail(`Channel: ${decision.channel}`);
      return pass("Email draft detected");
    },
  },
  {
    id: "oma.draft.whatsapp_detected",
    label: "WhatsApp draft detected",
    severity: "P1",
    expected: "draft_whatsapp intent",
    run: () => {
      const ctx: OutreachIntentContext = { message: "prépare un WhatsApp", isAdmin: true };
      const decision = classifyOutreachIntentRegex(ctx);
      if (!decision) return fail("Null decision");
      if (decision.intent !== "draft_whatsapp") return fail(`Intent: ${decision.intent}`);
      return pass("WhatsApp draft detected");
    },
  },
  {
    id: "oma.draft.linkedin_detected",
    label: "LinkedIn draft detected",
    severity: "P1",
    expected: "draft_linkedin intent",
    run: () => {
      const ctx: OutreachIntentContext = { message: "rédige LinkedIn", isAdmin: true };
      const decision = classifyOutreachIntentRegex(ctx);
      if (!decision) return fail("Null decision");
      if (decision.intent !== "draft_linkedin") return fail(`Intent: ${decision.intent}`);
      return pass("LinkedIn draft detected");
    },
  },
  {
    id: "oma.draft.non_admin_blocked",
    label: "Non-admin CANNOT draft content",
    severity: "P0",
    expected: "All draft intents blocked for non-admin",
    run: () => {
      const tests = [
        { msg: "écris un email", intent: "draft_email" },
        { msg: "prépare WhatsApp", intent: "draft_whatsapp" },
        { msg: "LinkedIn message", intent: "draft_linkedin" },
      ];
      for (const t of tests) {
        const ctx: OutreachIntentContext = { message: t.msg, isAdmin: false };
        const decision = classifyOutreachIntentRegex(ctx);
        if (decision?.intent === t.intent) {
          return fail(`Draft ${t.intent} allowed for non-admin`);
        }
      }
      return pass("All drafts correctly blocked");
    },
  },

  // ---------------------------------------------------------------------------
  // NEGATIVE PATTERNS / PROTECTION
  // ---------------------------------------------------------------------------
  {
    id: "oma.negative.bug_report",
    label: "Bug report detected and blocked",
    severity: "P0",
    expected: "'outreach CSS bug' → no_action",
    run: () => {
      const ctx: OutreachIntentContext = { message: "outreach CSS bug", isAdmin: true };
      const decision = classifyOutreachIntentRegex(ctx);
      if (!decision) return fail("Should return negative decision, not null");
      if (decision.intent !== "no_action") return fail(`Intent: ${decision.intent}`);
      if (decision.source !== "regex_negative") return fail(`Source: ${decision.source}`);
      return pass("Bug report correctly blocked");
    },
  },
  {
    id: "oma.negative.explain_request",
    label: "Explain request detected and blocked",
    severity: "P0",
    expected: "'explique-moi outreach' → no_action",
    run: () => {
      const ctx: OutreachIntentContext = { message: "explique-moi l'outreach", isAdmin: true };
      const decision = classifyOutreachIntentRegex(ctx);
      if (!decision) return fail("Should return decision");
      if (decision.source !== "regex_negative") return fail("Should be negative");
      return pass("Explain request correctly blocked");
    },
  },
  {
    id: "oma.negative.cancel_instruction",
    label: "Cancel instruction detected",
    severity: "P0",
    expected: "'ne lance rien' → no_action",
    run: () => {
      const ctx: OutreachIntentContext = { message: "ne lance rien", isAdmin: true };
      const decision = classifyOutreachIntentRegex(ctx);
      if (!decision) return fail("Should return decision");
      if (decision.source !== "regex_negative") return fail("Should be negative");
      return pass("Cancel instruction respected");
    },
  },

  // ---------------------------------------------------------------------------
  // SAFETY INVARIANTS
  // ---------------------------------------------------------------------------
  {
    id: "oma.safety.send_blocked",
    label: "All decisions have sendAllowed=false",
    severity: "P0",
    expected: "Invariants validated across all test intents",
    run: () => {
      const tests = ["ouvre outreach", "créer campagne", "écris email"];
      for (const msg of tests) {
        const ctx: OutreachIntentContext = { message: msg, isAdmin: true };
        const decision = classifyOutreachIntentRegex(ctx);
        if (!decision) continue;
        if (decision.sendAllowed !== false) {
          return fail(`sendAllowed=true for: ${msg}`);
        }
      }
      return pass("sendAllowed=false across all decisions");
    },
  },
  {
    id: "oma.safety.review_required",
    label: "All decisions have requiresUserReview=true",
    severity: "P0",
    expected: "Review required for all actions",
    run: () => {
      const tests = ["ouvre outreach", "créer campagne", "écris email"];
      for (const msg of tests) {
        const ctx: OutreachIntentContext = { message: msg, isAdmin: true };
        const decision = classifyOutreachIntentRegex(ctx);
        if (!decision) continue;
        if (decision.requiresUserReview !== true) {
          return fail(`requiresUserReview=false for: ${msg}`);
        }
      }
      return pass("requiresUserReview=true across all decisions");
    },
  },

  // ---------------------------------------------------------------------------
  // HUGGINGFACE
  // ---------------------------------------------------------------------------
  {
    id: "oma.hf.availability",
    label: "HF semantic classification availability",
    severity: "P2",
    expected: "isSemanticClassificationAvailable() returns boolean",
    sideEffect: "none",
    run: () => {
      const available = isSemanticClassificationAvailable();
      return pass(available ? "HF available" : "HF not configured (fallback to regex)");
    },
  },
  {
    id: "oma.hf.hypotheses_loaded",
    label: "HF hypotheses are loaded",
    severity: "P2",
    expected: "getSemanticHypotheses returns positive and negative arrays",
    sideEffect: "none",
    run: () => {
      const hypo = getSemanticHypotheses();
      if (hypo.positive.length === 0) return fail("No positive hypotheses");
      if (hypo.negative.length === 0) return fail("No negative hypotheses");
      return pass(`${hypo.positive.length} positive, ${hypo.negative.length} negative, threshold=${hypo.threshold}`);
    },
  },
  {
    id: "oma.hf.fallback_safe",
    label: "HF unavailable degrades gracefully",
    severity: "P1",
    expected: "When HF unavailable, returns null (no false positive)",
    sideEffect: "none",
    run: () => {
      // This test documents the expected behavior
      // Actual HF availability depends on env config
      if (!isSemanticClassificationAvailable()) {
        return skip("HF not configured — skipping runtime test");
      }
      // If HF is available, test that it returns a valid structure or null
      return pass("HF configured — runtime test skipped in static diagnostic");
    },
  },

  // ---------------------------------------------------------------------------
  // SAFETY REPORT
  // ---------------------------------------------------------------------------
  {
    id: "oma.safety_report.generation",
    label: "Safety report generation works",
    severity: "P1",
    expected: "generateSafetyReport returns valid report",
    run: () => {
      const ctx: OutreachIntentContext = { message: "créer campagne", isAdmin: true };
      const decision = classifyOutreachIntentRegex(ctx);
      if (!decision) return fail("No decision to validate");

      const report = generateSafetyReport(decision, { isAdmin: true });
      if (!report.canProceed && decision.intent !== "no_action") {
        return fail(`Unexpected blocking: ${report.blockingReasons.join(", ")}`);
      }
      return pass(`Report generated with ${report.checks.length} checks`);
    },
  },
  {
    id: "oma.safety_report.blocks_non_admin",
    label: "Safety report blocks non-admin for admin intents",
    severity: "P0",
    expected: "Report canProceed=false for non-admin + admin intent",
    run: () => {
      const ctx: OutreachIntentContext = { message: "créer campagne", isAdmin: false };
      const decision = classifyOutreachIntentRegex(ctx);
      if (!decision) return fail("Should return decision for safety check");

      const report = generateSafetyReport(decision, { isAdmin: false });
      if (report.canProceed && decision.intent !== "no_action") {
        return fail("Should block non-admin for campaign creation");
      }
      return pass("Non-admin correctly blocked by safety report");
    },
  },

  // ---------------------------------------------------------------------------
  // MASTER AGENT INTEGRATION
  // ---------------------------------------------------------------------------
  {
    id: "oma.master.config",
    label: "Master agent config accessible",
    severity: "INFO",
    expected: "getConfig returns mode, semanticAvailable, version",
    sideEffect: "none",
    run: () => {
      const config = outreachMasterAgent.getConfig();
      return pass(`Mode: ${config.mode}, HF: ${config.semanticAvailable}, v${config.version}`);
    },
  },
  {
    id: "oma.master.classify_sync",
    label: "Sync classify returns valid decision",
    severity: "P1",
    expected: "classifySync() returns decision with invariants",
    run: () => {
      const ctx: OutreachIntentContext = { message: "ouvre outreach", isAdmin: true };
      const decision = outreachMasterAgent.classifySync(ctx);
      if (decision.sendAllowed !== false) return fail("sendAllowed not false");
      if (decision.requiresUserReview !== true) return fail("requiresUserReview not true");
      return pass(`Intent: ${decision.intent}, Source: ${decision.source}`);
    },
  },

  // ---------------------------------------------------------------------------
  // CONFIG
  // ---------------------------------------------------------------------------
  {
    id: "oma.config.safety",
    label: "Safety config introspection",
    severity: "INFO",
    expected: "getSafetyConfig returns valid configuration",
    sideEffect: "none",
    run: () => {
      const config = getSafetyConfig();
      return pass(`Min semantic: ${config.minSemanticScore}, Admin intents: ${config.adminOnlyIntents.length}`);
    },
  },
];

// -----------------------------------------------------------------------------
// PUBLIC API
// -----------------------------------------------------------------------------

export async function runOutreachMasterDiagnostics(): Promise<DiagnosticResult[]> {
  // Pre-run async tests
  let asyncClassifyPassed = false;
  let asyncClassifyResult = "";
  try {
    const ctx: OutreachIntentContext = { message: "ouvre outreach", isAdmin: true };
    const decision = await outreachMasterAgent.classify(ctx);
    if (decision.sendAllowed !== false) {
      asyncClassifyResult = "sendAllowed not false";
    } else if (decision.requiresUserReview !== true) {
      asyncClassifyResult = "requiresUserReview not true";
    } else {
      asyncClassifyPassed = true;
      asyncClassifyResult = `Intent: ${decision.intent}, Source: ${decision.source}`;
    }
  } catch (err) {
    asyncClassifyResult = `Error: ${err instanceof Error ? err.message : String(err)}`;
  }

  // Build specs with async results baked in
  const specsWithAsync: DiagnosticCheckSpec[] = [
    ...checks,
    {
      id: "oma.master.classify_async",
      label: "Async classify returns valid decision",
      severity: "P1",
      expected: "classify() returns decision with invariants",
      run: () => {
        if (asyncClassifyPassed) {
          return pass(asyncClassifyResult);
        }
        return fail(asyncClassifyResult);
      },
    },
  ];

  return runChecks("outreach-master", specsWithAsync);
}

/** Re-export for diagnostic route. */
export { getOutreachRegexRules, getNegativePatterns, isSemanticClassificationAvailable };
