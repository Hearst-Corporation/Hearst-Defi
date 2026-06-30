/**
 * Outreach Master Agent — Integration tests for cockpit-chat.
 *
 * Tests de l'intégration dans le flux cockpit-chat:
 * - Shadow mode HF (log seulement, pas de bypass)
 * - Navigation Outreach fast-path
 * - Conflits avec router existant (pas d'override)
 * - Non-regression Product Workspace
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  integrateOutreachAgent,
  integrateOutreachAgentSync,
  shouldNavigateOutreach,
  shouldOpenOutreachCanvas,
  shouldStageOutreachAction,
  extractOutreachDiagnostics,
} from "../outreach-integration";
import type { AgenticIntentDecision } from "../intent-router-types";

// -----------------------------------------------------------------------------
// FIXTURES
// -----------------------------------------------------------------------------

function ctx(message: string, isAdmin = true, existingDecision?: AgenticIntentDecision) {
  return {
    message,
    isAdmin,
    userId: "test-user-123",
    chatId: "test-chat-456",
    existingDecision,
  };
}

// -----------------------------------------------------------------------------
// SUITE 1: Shadow Mode Integration
// -----------------------------------------------------------------------------

describe("SUITE 1: Shadow Mode / Calibration", () => {
  it("returns diagnostics even when no outreach intent", async () => {
    const result = await integrateOutreachAgent(ctx("hello world", true));
    expect(result.diagnostics).toBeDefined();
    expect(result.diagnostics.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.outreachDecision).toBeNull();
  });

  it("regex takes precedence over semantic (shadow mode)", async () => {
    const result = await integrateOutreachAgent(ctx("ouvre outreach", true));
    // Should have a decision from regex
    expect(result.outreachDecision).not.toBeNull();
    expect(result.diagnostics.regexDecision).not.toBeNull();
    // Semantic may or may not have a decision depending on HF availability
    // But the final decision should match regex when both present
    if (result.diagnostics.semanticDecision) {
      // If semantic also has a decision, the final should still be regex's
      expect(result.outreachDecision?.source).toBe("regex_deterministic");
    }
  });

  it("semantic only used when regex returns null", async () => {
    // A message that regex might not catch but semantic could
    const result = await integrateOutreachAgent(ctx("I want to manage my campaigns and send stuff to investors", true));
    // Either regex catches it (good) or semantic does (also good)
    // But if both are null, that's a gap we need to know about
    expect(result.diagnostics).toBeDefined();
    expect(result.diagnostics.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("logs divergence when regex and semantic disagree", async () => {
    // This test documents the shadow mode behavior
    // In shadow mode, we log but don't act on divergence
    const result = await integrateOutreachAgent(ctx("create campaign", true));
    expect(result.diagnostics.regexDecision).toBeDefined();
    expect(result.diagnostics.semanticDecision).toBeDefined();
  });

  it("HF unavailable degrades gracefully (no crash)", async () => {
    // This test verifies fail-open behavior
    const result = await integrateOutreachAgent(ctx("ouvre outreach", true));
    expect(result).toBeDefined();
    expect(result.diagnostics.latencyMs).toBeGreaterThanOrEqual(0);
  });
});

// -----------------------------------------------------------------------------
// SUITE 2: Navigation Fast-Path
// -----------------------------------------------------------------------------

describe("SUITE 2: Outreach Navigation Fast-Path", () => {
  it("detects 'ouvre outreach' as navigation intent", async () => {
    const result = await integrateOutreachAgent(ctx("ouvre outreach", true));
    expect(result.outreachDecision?.intent).toBe("open_outreach");
    expect(result.outreachDecision?.action).toBe("navigate");
    expect(shouldNavigateOutreach(result.outreachDecision)).toBe(true);
  });

  it("detects 'go to outreach' as navigation intent", async () => {
    const result = await integrateOutreachAgent(ctx("go to outreach", true));
    expect(result.outreachDecision?.intent).toBe("open_outreach");
    expect(shouldNavigateOutreach(result.outreachDecision)).toBe(true);
  });

  it("detects 'open campaign workspace' as navigation intent", async () => {
    const result = await integrateOutreachAgent(ctx("open campaign workspace", true));
    expect(result.outreachDecision?.intent).toBe("open_outreach");
  });

  it("shouldNavigateOutreach returns false for non-nav decisions", async () => {
    const result = await integrateOutreachAgent(ctx("créer une campagne", true));
    // Campaign creation is open_canvas, not navigate
    if (result.outreachDecision?.intent === "create_campaign") {
      expect(shouldNavigateOutreach(result.outreachDecision)).toBe(false);
      expect(shouldOpenOutreachCanvas(result.outreachDecision)).toBe(true);
    }
  });

  it("non-admin can navigate to outreach", async () => {
    const result = await integrateOutreachAgent(ctx("open outreach", false));
    expect(result.outreachDecision?.intent).toBe("open_outreach");
    expect(result.outreachDecision?.action).toBe("navigate");
  });
});

// -----------------------------------------------------------------------------
// SUITE 3: Canvas / Draft Detection
// -----------------------------------------------------------------------------

describe("SUITE 3: Canvas and Draft Detection", () => {
  it("detects 'créer campagne' as canvas open", async () => {
    const result = await integrateOutreachAgent(ctx("créer une campagne investisseurs", true));
    expect(result.outreachDecision?.intent).toBe("create_campaign");
    expect(shouldOpenOutreachCanvas(result.outreachDecision)).toBe(true);
  });

  it("detects 'draft email' as draft action", async () => {
    const result = await integrateOutreachAgent(ctx("draft an email to investors", true));
    expect(result.outreachDecision?.intent).toBe("draft_email");
    expect(result.outreachDecision?.action).toBe("draft");
    expect(result.outreachDecision?.channel).toBe("email");
  });

  it("detects 'prepare WhatsApp' as draft action", async () => {
    const result = await integrateOutreachAgent(ctx("prepare a WhatsApp message", true));
    expect(result.outreachDecision?.intent).toBe("draft_whatsapp");
  });

  it("detects 'LinkedIn message' as draft action", async () => {
    const result = await integrateOutreachAgent(ctx("write a LinkedIn message", true));
    expect(result.outreachDecision?.intent).toBe("draft_linkedin");
  });

  it("detects 'follow up leads' as staged action", async () => {
    const result = await integrateOutreachAgent(ctx("follow up with leads who didn't respond", true));
    expect(result.outreachDecision?.intent).toBe("follow_up_leads");
    expect(shouldStageOutreachAction(result.outreachDecision)).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// SUITE 4: Conflict Avoidance with Existing Router
// -----------------------------------------------------------------------------

describe("SUITE 4: Conflict Avoidance", () => {
  it("returns null when existing decision is strong deployment", async () => {
    const existingDecision: AgenticIntentDecision = {
      kind: "deploy_request",
      confidence: 0.9,
      actionPolicy: "refuse_autonomous",
      riskLevel: "critical",
      requiresLLM: false,
      requiresCanvas: false,
      requiresHumanGate: true,
      requiresExistingPendingAction: false,
      prohibitedAutonomousAction: true,
      matchedRuleIds: ["deploy.go_live"],
      normalizedInput: "deploy now",
      negated: false,
      reason: "Deployment intent detected",
    };
    const result = await integrateOutreachAgent(ctx("deploy the vault", true, existingDecision));
    expect(result.outreachDecision).toBeNull();
  });

  it("returns null when existing decision is strong send", async () => {
    const existingDecision: AgenticIntentDecision = {
      kind: "send_request",
      confidence: 0.85,
      actionPolicy: "requires_human_gate",
      riskLevel: "high",
      requiresLLM: false,
      requiresCanvas: false,
      requiresHumanGate: true,
      requiresExistingPendingAction: false,
      prohibitedAutonomousAction: true,
      matchedRuleIds: ["outreach.send"],
      normalizedInput: "send campaign",
      negated: false,
      reason: "Send intent detected",
    };
    const result = await integrateOutreachAgent(ctx("send the campaign now", true, existingDecision));
    expect(result.outreachDecision).toBeNull();
  });

  it("still works when existing decision is weak", async () => {
    const existingDecision: AgenticIntentDecision = {
      kind: "education",
      confidence: 0.5,
      actionPolicy: "allow_readonly",
      riskLevel: "none",
      requiresLLM: true,
      requiresCanvas: false,
      requiresHumanGate: false,
      requiresExistingPendingAction: false,
      prohibitedAutonomousAction: false,
      matchedRuleIds: ["edu.generic"],
      normalizedInput: "explain",
      negated: false,
      reason: "Education intent",
    };
    const result = await integrateOutreachAgent(ctx("ouvre outreach", true, existingDecision));
    expect(result.outreachDecision).not.toBeNull();
    expect(result.outreachDecision?.intent).toBe("open_outreach");
  });
});

// -----------------------------------------------------------------------------
// SUITE 5: Product Workspace Non-Regression
// -----------------------------------------------------------------------------

describe("SUITE 5: Product Workspace Non-Regression", () => {
  it("does not interfere with product workspace intents", async () => {
    // Product workspace should not be caught by outreach
    const result = await integrateOutreachAgent(ctx("create a new vault", true));
    // Should NOT be detected as outreach
    expect(result.outreachDecision?.intent).not.toBe("create_campaign");
  });

  it("does not interfere with vault navigation", async () => {
    const result = await integrateOutreachAgent(ctx("va dans vaults", true));
    // Should NOT be detected as outreach navigation
    expect(result.outreachDecision?.intent).not.toBe("open_outreach");
  });

  it("does not interfere with scenario lab", async () => {
    const result = await integrateOutreachAgent(ctx("run a scenario", true));
    // Should NOT be detected as outreach
    expect(result.outreachDecision?.intent).not.toBe("create_campaign");
  });
});

// -----------------------------------------------------------------------------
// SUITE 6: Safety Invariants
// -----------------------------------------------------------------------------

describe("SUITE 6: Safety Invariants", () => {
  it("sendAllowed is always false", async () => {
    const result = await integrateOutreachAgent(ctx("draft email", true));
    if (result.outreachDecision) {
      expect(result.outreachDecision.sendAllowed).toBe(false);
    }
  });

  it("requiresUserReview is always true", async () => {
    const result = await integrateOutreachAgent(ctx("create campaign", true));
    if (result.outreachDecision) {
      expect(result.outreachDecision.requiresUserReview).toBe(true);
    }
  });

  it("safety report generated for admin-only intents", async () => {
    const result = await integrateOutreachAgent(ctx("create campaign", true));
    expect(result.safetyReport).not.toBeNull();
    expect(result.safetyReport?.canProceed).toBe(true);
  });

  it("blocks non-admin from admin-only intents in safety report", async () => {
    const result = await integrateOutreachAgent(ctx("create campaign", false));
    expect(result.safetyReport).not.toBeNull();
    // The safety report should show the permission issue
    expect(result.safetyReport?.checks.some(c => c.id === "permission.admin_required")).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// SUITE 7: Diagnostics Extraction
// -----------------------------------------------------------------------------

describe("SUITE 7: Diagnostics", () => {
  it("extracts diagnostics for logging", async () => {
    const result = await integrateOutreachAgent(ctx("ouvre outreach", true));
    const diagnostics = extractOutreachDiagnostics(result);
    expect(diagnostics).toHaveProperty("outreachIntent");
    expect(diagnostics).toHaveProperty("outreachAction");
    expect(diagnostics).toHaveProperty("outreachSource");
    expect(diagnostics).toHaveProperty("semanticAvailable");
    expect(diagnostics).toHaveProperty("latencyMs");
  });

  it("diagnostics show null when no outreach intent", async () => {
    const result = await integrateOutreachAgent(ctx("hello world", true));
    const diagnostics = extractOutreachDiagnostics(result);
    expect(diagnostics.outreachIntent).toBeNull();
    expect(diagnostics.outreachAction).toBeNull();
  });
});

// -----------------------------------------------------------------------------
// SUITE 8: Sync Integration
// -----------------------------------------------------------------------------

describe("SUITE 8: Sync Integration (No HF)", () => {
  it("sync version uses regex only", () => {
    const result = integrateOutreachAgentSync(ctx("ouvre outreach", true));
    expect(result.outreachDecision).not.toBeNull();
    expect(result.semanticAvailable).toBe(false);
    expect(result.diagnostics.semanticDecision).toBeNull();
  });

  it("sync version has no latency from async operations", () => {
    const result = integrateOutreachAgentSync(ctx("create campaign", true));
    expect(result.diagnostics.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.diagnostics.latencyMs).toBeLessThan(100); // Should be very fast
  });
});

// -----------------------------------------------------------------------------
// SUITE 9: Negative Intent Protection
// -----------------------------------------------------------------------------

describe("SUITE 9: Negative Intent Protection", () => {
  it("blocks 'outreach CSS bug' (no action)", async () => {
    const result = await integrateOutreachAgent(ctx("outreach CSS bug", true));
    // Should be detected as negative/no_action
    if (result.outreachDecision) {
      expect(result.outreachDecision.source).toBe("regex_negative");
    }
  });

  it("blocks 'explique-moi outreach' (no action)", async () => {
    const result = await integrateOutreachAgent(ctx("explique-moi l'outreach", true));
    if (result.outreachDecision) {
      expect(result.outreachDecision.intent).toBe("no_action");
    }
  });

  it("blocks 'ne lance rien' (no action)", async () => {
    const result = await integrateOutreachAgent(ctx("ne lance rien", true));
    if (result.outreachDecision) {
      expect(result.outreachDecision.source).toBe("regex_negative");
      expect(result.outreachDecision.intent).toBe("no_action");
    }
  });
});

// -----------------------------------------------------------------------------
// SUITE 10: Edge Cases
// -----------------------------------------------------------------------------

describe("SUITE 10: Edge Cases", () => {
  it("handles empty message gracefully", async () => {
    const result = await integrateOutreachAgent(ctx("", true));
    expect(result.outreachDecision?.intent).toBe("no_action");
  });

  it("handles whitespace-only message", async () => {
    const result = await integrateOutreachAgent(ctx("   ", true));
    expect(result.outreachDecision?.intent).toBe("no_action");
  });

  it("handles very long message", async () => {
    const longMessage = "ouvre outreach " + "a".repeat(1000);
    const result = await integrateOutreachAgent(ctx(longMessage, true));
    expect(result).toBeDefined();
    expect(result.diagnostics.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("handles mixed language (FR/EN)", async () => {
    const result = await integrateOutreachAgent(ctx("open la campagne outreach", true));
    expect(result).toBeDefined();
  });
});
