import { describe, expect, it } from "vitest";

import {
  buildRouterDecisionTrace,
  buildUnknownDecisionTrace,
} from "@/lib/agentic/observability/decision-summary";
import { classifyAgenticIntent } from "@/lib/agentic/intent-router";
import type { AgenticIntentDecision } from "@/lib/agentic/intent-router-types";

const CTX = (outcome: Parameters<typeof buildRouterDecisionTrace>[1]["outcome"]) => ({
  id: "rdec:turn_test",
  createdAt: "2026-06-25T10:00:00.000Z",
  outcome,
  chatId: "chat_abc",
  messageId: "turn_test",
});

const classify = (m: string): AgenticIntentDecision =>
  classifyAgenticIntent(m, { navProfile: "lp", isAdmin: false });

describe("decision-summary — outcome mapping & field preservation", () => {
  it("navigation → nav_fast_path, preserves routeKey + confidence + ruleIds", () => {
    const d = classify("va dans les vaults");
    const t = buildRouterDecisionTrace(d, CTX("nav_fast_path"));
    expect(t.outcome).toBe("nav_fast_path");
    expect(t.tookFastPath).toBe(true);
    expect(t.usedLegacyFallback).toBe(false);
    expect(t.kind).toBe("navigation");
    expect(t.routeKey).toBe("vaults");
    expect(typeof t.confidence).toBe("number");
    expect(t.matchedRuleIds.length).toBeGreaterThan(0);
  });

  it("negated nav → negated flag true, no routeKey", () => {
    const d = classify("ne montre pas les vaults");
    const t = buildRouterDecisionTrace(d, CTX("negated_no_nav"));
    expect(t.negated).toBe(true);
    expect(t.outcome).toBe("negated_no_nav");
    expect(t.routeKey).toBeUndefined();
  });

  it("dangerous → prohibitedAutonomousAction true, dangerous_refusal", () => {
    const d = classify("déploie ce produit");
    const t = buildRouterDecisionTrace(d, CTX("dangerous_refusal"));
    expect(t.prohibitedAutonomousAction).toBe(true);
    expect(t.outcome).toBe("dangerous_refusal");
  });

  it("education → educationalKind set for yield/product/risk", () => {
    const y = buildRouterDecisionTrace(
      classify("explique comment fonctionne le yield"),
      CTX("educational_llm"),
    );
    expect(y.kind).toBe("yield_explanation");
    expect(y.educationalKind).toBe("yield_explanation");

    const p = buildRouterDecisionTrace(
      classify("explique-moi comment marchent les produits"),
      CTX("educational_llm"),
    );
    expect(p.educationalKind).toBe("product_explanation");
  });

  it("non-educational kind has no educationalKind", () => {
    const t = buildRouterDecisionTrace(classify("va dans les vaults"), CTX("nav_fast_path"));
    expect(t.educationalKind).toBeUndefined();
  });

  it("NEVER copies user-text fields (normalizedInput / reason) into the trace", () => {
    const d = classify("explique comment fonctionne le yield");
    // sanity: the decision itself carries the normalized text + a reason
    expect(d.normalizedInput.length).toBeGreaterThan(0);
    expect(d.reason.length).toBeGreaterThan(0);
    const t = buildRouterDecisionTrace(d, CTX("educational_llm"));
    const serialized = JSON.stringify(t);
    expect(serialized).not.toContain(d.normalizedInput);
    expect(serialized).not.toContain(d.reason);
    // explicit: the trace object has no such keys
    expect("normalizedInput" in t).toBe(false);
    expect("reason" in t).toBe(false);
  });

  it("matchedRuleIds is a defensive copy (not the decision's array)", () => {
    const d = classify("va dans les vaults");
    const t = buildRouterDecisionTrace(d, CTX("nav_fast_path"));
    expect(t.matchedRuleIds).not.toBe(d.matchedRuleIds);
    expect(t.matchedRuleIds).toEqual(d.matchedRuleIds);
  });

  it("source is always cockpit_chat", () => {
    const t = buildRouterDecisionTrace(classify("bonjour"), CTX("normal_llm"));
    expect(t.source).toBe("cockpit_chat");
  });

  it("unknown trace (no decision) records ids + outcome with safe defaults", () => {
    const t = buildUnknownDecisionTrace(CTX("unknown"));
    expect(t.kind).toBe("unknown");
    expect(t.actionPolicy).toBe("unknown");
    expect(t.negated).toBe(false);
    expect(t.matchedRuleIds).toEqual([]);
    expect(t.prohibitedAutonomousAction).toBe(false);
    expect(t.chatId).toBe("chat_abc");
    expect(t.source).toBe("cockpit_chat");
  });
});
