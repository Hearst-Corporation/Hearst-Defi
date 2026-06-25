import { describe, expect, it } from "vitest";

import {
  buildRouterDecisionTrendBuckets,
  getRouterTrendWindowStart,
  getTopMatchedRules,
  normalizeRouterTrendWindow,
} from "../trends";
import type { RouterDecisionTrace } from "../types";

const NOW = new Date("2026-06-25T12:00:00.000Z");

function trace(
  partial: Partial<RouterDecisionTrace> & { createdAt: string },
): RouterDecisionTrace {
  return {
    id: partial.id ?? `t-${partial.createdAt}`,
    kind: "navigation",
    actionPolicy: "allow_navigation",
    negated: false,
    matchedRuleIds: [],
    prohibitedAutonomousAction: false,
    outcome: "normal_llm",
    usedLegacyFallback: false,
    tookFastPath: false,
    source: "cockpit_chat",
    ...partial,
  };
}

describe("normalizeRouterTrendWindow", () => {
  it("accepts valid windows", () => {
    expect(normalizeRouterTrendWindow("1h")).toBe("1h");
    expect(normalizeRouterTrendWindow("24h")).toBe("24h");
    expect(normalizeRouterTrendWindow("7d")).toBe("7d");
  });

  it("defaults invalid/missing input to 24h", () => {
    expect(normalizeRouterTrendWindow(undefined)).toBe("24h");
    expect(normalizeRouterTrendWindow("")).toBe("24h");
    expect(normalizeRouterTrendWindow("90d")).toBe("24h");
    expect(normalizeRouterTrendWindow("garbage")).toBe("24h");
  });
});

describe("getRouterTrendWindowStart", () => {
  it("1h window starts one hour before now", () => {
    const start = getRouterTrendWindowStart("1h", NOW);
    expect(NOW.getTime() - start.getTime()).toBe(60 * 60 * 1000);
  });
  it("24h window starts 24h before now", () => {
    const start = getRouterTrendWindowStart("24h", NOW);
    expect(NOW.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });
  it("7d window starts 7 days before now", () => {
    const start = getRouterTrendWindowStart("7d", NOW);
    expect(NOW.getTime() - start.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe("buildRouterDecisionTrendBuckets — bucket counts", () => {
  it("1h creates 12 buckets", () => {
    expect(buildRouterDecisionTrendBuckets([], "1h", NOW)).toHaveLength(12);
  });
  it("24h creates 24 buckets", () => {
    expect(buildRouterDecisionTrendBuckets([], "24h", NOW)).toHaveLength(24);
  });
  it("7d creates 7 buckets", () => {
    expect(buildRouterDecisionTrendBuckets([], "7d", NOW)).toHaveLength(7);
  });
  it("empty traces → all buckets zero", () => {
    const buckets = buildRouterDecisionTrendBuckets([], "24h", NOW);
    expect(buckets.every((b) => b.total === 0)).toBe(true);
  });
});

describe("buildRouterDecisionTrendBuckets — categorization", () => {
  it("counts each outcome into the right category", () => {
    const traces = [
      trace({ createdAt: "2026-06-25T11:58:00.000Z", outcome: "nav_fast_path" }),
      trace({
        createdAt: "2026-06-25T11:58:30.000Z",
        outcome: "dangerous_refusal",
      }),
      trace({ createdAt: "2026-06-25T11:59:00.000Z", outcome: "educational_llm" }),
      trace({ createdAt: "2026-06-25T11:59:10.000Z", outcome: "negated_no_nav" }),
      trace({ createdAt: "2026-06-25T11:59:20.000Z", outcome: "normal_llm" }),
      trace({ createdAt: "2026-06-25T11:59:30.000Z", outcome: "unknown" }),
      trace({
        createdAt: "2026-06-25T11:59:40.000Z",
        outcome: "legacy_fallback_nav",
      }),
    ];
    const buckets = buildRouterDecisionTrendBuckets(traces, "1h", NOW);
    const sum = (k: keyof (typeof buckets)[number]) =>
      buckets.reduce((s, b) => s + (b[k] as number), 0);

    expect(sum("total")).toBe(7);
    expect(sum("navigationFastPaths")).toBe(1);
    expect(sum("dangerousRefusals")).toBe(1);
    expect(sum("educationalTurns")).toBe(1);
    expect(sum("negatedNoNav")).toBe(1);
    // normal + unknown + legacy_fallback_nav → normalOrUnknown
    expect(sum("normalOrUnknown")).toBe(3);
  });

  it("places a trace in the correct time bucket", () => {
    // 24h window: 24 buckets of 1h, oldest first. A trace 90 min ago lands in
    // the second-to-last bucket.
    const ninetyMinAgo = new Date(NOW.getTime() - 90 * 60 * 1000).toISOString();
    const buckets = buildRouterDecisionTrendBuckets(
      [trace({ createdAt: ninetyMinAgo, outcome: "nav_fast_path" })],
      "24h",
      NOW,
    );
    const filled = buckets.filter((b) => b.total > 0);
    expect(filled).toHaveLength(1);
    expect(filled[0]!.navigationFastPaths).toBe(1);
    expect(buckets.indexOf(filled[0]!)).toBe(22); // index 22 of 0..23
  });
});

describe("buildRouterDecisionTrendBuckets — robustness", () => {
  it("ignores invalid timestamps", () => {
    const buckets = buildRouterDecisionTrendBuckets(
      [
        trace({ createdAt: "not-a-date", outcome: "nav_fast_path" }),
        trace({ createdAt: "", outcome: "dangerous_refusal" }),
      ],
      "24h",
      NOW,
    );
    expect(buckets.reduce((s, b) => s + b.total, 0)).toBe(0);
  });

  it("ignores traces outside the window", () => {
    const tenDaysAgo = new Date(
      NOW.getTime() - 10 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const future = new Date(NOW.getTime() + 60 * 1000).toISOString();
    const buckets = buildRouterDecisionTrendBuckets(
      [
        trace({ createdAt: tenDaysAgo, outcome: "nav_fast_path" }),
        trace({ createdAt: future, outcome: "nav_fast_path" }),
      ],
      "7d",
      NOW,
    );
    expect(buckets.reduce((s, b) => s + b.total, 0)).toBe(0);
  });
});

describe("getTopMatchedRules", () => {
  it("counts and ranks matched rules descending", () => {
    const traces = [
      trace({ createdAt: NOW.toISOString(), matchedRuleIds: ["deploy.go_live"] }),
      trace({
        createdAt: NOW.toISOString(),
        matchedRuleIds: ["deploy.go_live", "send.email"],
      }),
      trace({ createdAt: NOW.toISOString(), matchedRuleIds: ["send.email"] }),
      trace({ createdAt: NOW.toISOString(), matchedRuleIds: ["send.email"] }),
    ];
    const top = getTopMatchedRules(traces);
    expect(top[0]).toEqual({ ruleId: "send.email", count: 3 });
    expect(top[1]).toEqual({ ruleId: "deploy.go_live", count: 2 });
  });

  it("respects the limit and returns [] for no rules", () => {
    expect(getTopMatchedRules([])).toEqual([]);
    const traces = [
      trace({ createdAt: NOW.toISOString(), matchedRuleIds: ["a"] }),
      trace({ createdAt: NOW.toISOString(), matchedRuleIds: ["b"] }),
      trace({ createdAt: NOW.toISOString(), matchedRuleIds: ["c"] }),
    ];
    expect(getTopMatchedRules(traces, 2)).toHaveLength(2);
  });

  it("ignores empty rule ids", () => {
    const top = getTopMatchedRules([
      trace({ createdAt: NOW.toISOString(), matchedRuleIds: ["", "x"] }),
    ]);
    expect(top).toEqual([{ ruleId: "x", count: 1 }]);
  });
});
