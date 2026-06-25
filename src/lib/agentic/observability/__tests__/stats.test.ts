import { describe, expect, it } from "vitest";

import { computeRouterDecisionStats } from "@/lib/agentic/observability/stats";
import type { RouterDecisionTrace } from "@/lib/agentic/observability/types";

function trace(
  outcome: RouterDecisionTrace["outcome"],
  kind: string,
): RouterDecisionTrace {
  return {
    id: `rdec:${outcome}:${kind}:${Math.round(Math.abs(Math.sin(kind.length)) * 1e6)}`,
    createdAt: "2026-06-25T10:00:00.000Z",
    kind,
    actionPolicy: "x",
    negated: outcome === "negated_no_nav",
    matchedRuleIds: [],
    prohibitedAutonomousAction: outcome === "dangerous_refusal",
    outcome,
    usedLegacyFallback: outcome === "legacy_fallback_nav",
    tookFastPath: outcome === "nav_fast_path",
    source: "cockpit_chat",
  };
}

describe("computeRouterDecisionStats", () => {
  it("returns zeroes for an empty set", () => {
    const s = computeRouterDecisionStats([]);
    expect(s.total).toBe(0);
    expect(s.dangerousRefusals).toBe(0);
    expect(s.byKind).toEqual({});
    expect(s.byOutcome).toEqual({});
  });

  it("counts by kind and by outcome", () => {
    const s = computeRouterDecisionStats([
      trace("nav_fast_path", "navigation"),
      trace("nav_fast_path", "navigation"),
      trace("dangerous_refusal", "deploy_request"),
      trace("educational_llm", "yield_explanation"),
      trace("negated_no_nav", "cancellation"),
      trace("legacy_fallback_nav", "navigation"),
      trace("normal_llm", "unknown"),
      trace("unknown", "unknown"),
    ]);
    expect(s.total).toBe(8);
    expect(s.navigationFastPaths).toBe(2);
    expect(s.dangerousRefusals).toBe(1);
    expect(s.educationalTurns).toBe(1);
    expect(s.negatedNoNav).toBe(1);
    expect(s.legacyFallbacks).toBe(1);
    expect(s.unknownTurns).toBe(1);
    expect(s.byKind.navigation).toBe(3);
    expect(s.byOutcome.normal_llm).toBe(1);
    expect(s.byOutcome.nav_fast_path).toBe(2);
  });
});
