import { describe, expect, it } from "vitest";

import {
  computeRouterQualityReview,
  UNKNOWN_RATE_WATCH,
  DANGEROUS_REFUSAL_RATE_WATCH,
  FALLBACK_RATE_WATCH,
  MIN_SAMPLE_FOR_RATES,
} from "@/lib/agentic/observability/quality-review";
import type {
  RouterDecisionStats,
  RouterDecisionTrendBucket,
  RouterObservabilitySummary,
} from "@/lib/agentic/observability/types";

// quality-review is a PURE interpretation of a RouterObservabilitySummary — no
// I/O, no DB. These tests build minimal summaries and assert rates + watchlist.

function emptyStats(): RouterDecisionStats {
  return {
    total: 0,
    byKind: {},
    byOutcome: {},
    dangerousRefusals: 0,
    negatedNoNav: 0,
    educationalTurns: 0,
    navigationFastPaths: 0,
    legacyFallbacks: 0,
    unknownTurns: 0,
  };
}

function bucket(total: number): RouterDecisionTrendBucket {
  return {
    label: "x",
    start: "2026-06-25T00:00:00.000Z",
    end: "2026-06-25T01:00:00.000Z",
    total,
    navigationFastPaths: 0,
    dangerousRefusals: 0,
    educationalTurns: 0,
    negatedNoNav: 0,
    normalOrUnknown: total,
  };
}

function summary(
  over: Omit<Partial<RouterObservabilitySummary>, "stats"> & {
    stats?: Partial<RouterDecisionStats>;
  } = {},
): RouterObservabilitySummary {
  const { stats: statsOver, ...rest } = over;
  return {
    state: "enabled",
    storage: "durable",
    window: "24h",
    recent: [],
    stats: { ...emptyStats(), ...statsOver },
    topMatchedRules: [],
    capacity: 5000,
    retentionNote: "",
    safetyNote: "",
    privacyMode: "",
    trendWindow: "24h",
    trendBuckets: [bucket(1), bucket(1), bucket(1)],
    bufferLimitNote: "",
    retentionDays: 90,
    retentionPolicyNote: "",
    windowLimitationNote: null,
    aggregationMode: "sql",
    ...rest,
  };
}

describe("computeRouterQualityReview — rates", () => {
  it("computes count/total rates, 0 when total is 0", () => {
    const r = computeRouterQualityReview(summary());
    expect(r.total).toBe(0);
    for (const rate of r.rates) {
      expect(rate.rate).toBe(0);
      expect(rate.total).toBe(0);
    }
  });

  it("computes rates that match the stats", () => {
    const r = computeRouterQualityReview(
      summary({
        stats: {
          total: 100,
          unknownTurns: 10,
          dangerousRefusals: 5,
          educationalTurns: 20,
          navigationFastPaths: 40,
          legacyFallbacks: 3,
          negatedNoNav: 7,
        },
      }),
    );
    const byKey = new Map(r.rates.map((x) => [x.key, x]));
    expect(byKey.get("unknown")!.rate).toBe(0.1);
    expect(byKey.get("dangerous_refusal")!.rate).toBe(0.05);
    expect(byKey.get("educational")!.rate).toBe(0.2);
    expect(byKey.get("nav_fast_path")!.rate).toBe(0.4);
    expect(byKey.get("legacy_fallback")!.rate).toBe(0.03);
    expect(r.negatedNoNav).toBe(7);
  });

  it("rounds rates to 4 decimal places", () => {
    const r = computeRouterQualityReview(
      summary({ stats: { total: 3, unknownTurns: 1 } }),
    );
    const unknown = r.rates.find((x) => x.key === "unknown")!;
    expect(unknown.rate).toBe(0.3333);
  });
});

describe("computeRouterQualityReview — watchlist thresholds", () => {
  function signal(r: ReturnType<typeof computeRouterQualityReview>, key: string) {
    return r.watchlist.find((s) => s.key === key)!;
  }

  it("does NOT raise rate signals below the minimum sample", () => {
    // 1 of 2 unknown = 50% but sample < MIN_SAMPLE_FOR_RATES → not active.
    const r = computeRouterQualityReview(
      summary({ stats: { total: 2, unknownTurns: 1 } }),
    );
    expect(MIN_SAMPLE_FOR_RATES).toBeGreaterThan(2);
    expect(signal(r, "high_unknown").active).toBe(false);
  });

  it("raises high_unknown when unknown rate >= threshold with enough sample", () => {
    const total = MIN_SAMPLE_FOR_RATES + 30;
    const unknownTurns = Math.ceil(total * (UNKNOWN_RATE_WATCH + 0.05));
    const r = computeRouterQualityReview(
      summary({ stats: { total, unknownTurns } }),
    );
    expect(signal(r, "high_unknown").active).toBe(true);
    expect(signal(r, "high_unknown").severity).toBe("watch");
  });

  it("raises high_dangerous_refusal (alert) when above threshold", () => {
    const total = MIN_SAMPLE_FOR_RATES + 30;
    const dangerousRefusals = Math.ceil(total * (DANGEROUS_REFUSAL_RATE_WATCH + 0.05));
    const r = computeRouterQualityReview(
      summary({ stats: { total, dangerousRefusals } }),
    );
    expect(signal(r, "high_dangerous_refusal").active).toBe(true);
    expect(signal(r, "high_dangerous_refusal").severity).toBe("alert");
  });

  it("raises high_fallback when the legacy-fallback rate is high", () => {
    const total = MIN_SAMPLE_FOR_RATES + 30;
    const legacyFallbacks = Math.ceil(total * (FALLBACK_RATE_WATCH + 0.05));
    const r = computeRouterQualityReview(
      summary({ stats: { total, legacyFallbacks } }),
    );
    expect(signal(r, "high_fallback").active).toBe(true);
  });

  it("raises high_fallback when the storage source is degraded (redis fallback)", () => {
    const r = computeRouterQualityReview(
      summary({
        storage: "redis_fallback",
        aggregationMode: "fallback",
        stats: { total: 50, navigationFastPaths: 50 },
      }),
    );
    expect(signal(r, "high_fallback").active).toBe(true);
    expect(signal(r, "high_fallback").detail).toMatch(/degraded source/i);
  });

  it("raises high_fallback when aggregationMode is fallback even on durable storage label", () => {
    const r = computeRouterQualityReview(
      summary({
        storage: "memory_fallback",
        aggregationMode: "fallback",
        stats: { total: 50, navigationFastPaths: 50 },
      }),
    );
    expect(signal(r, "high_fallback").active).toBe(true);
  });

  it("raises no_recent_data when total is 0", () => {
    const r = computeRouterQualityReview(summary({ stats: { total: 0 } }));
    expect(signal(r, "no_recent_data").active).toBe(true);
    expect(signal(r, "no_recent_data").detail).toMatch(/no router decisions/i);
  });

  it("raises no_recent_data when the latest buckets are all empty", () => {
    const r = computeRouterQualityReview(
      summary({
        stats: { total: 100, navigationFastPaths: 100 },
        trendBuckets: [bucket(100), bucket(0), bucket(0), bucket(0)],
      }),
    );
    expect(signal(r, "no_recent_data").active).toBe(true);
    expect(signal(r, "no_recent_data").detail).toMatch(/recent buckets/i);
  });

  it("stays healthy (no active signals) on a clean durable window", () => {
    const r = computeRouterQualityReview(
      summary({
        storage: "durable",
        aggregationMode: "sql",
        stats: {
          total: 100,
          navigationFastPaths: 60,
          educationalTurns: 30,
          unknownTurns: 5,
          dangerousRefusals: 2,
          legacyFallbacks: 1,
        },
        trendBuckets: [bucket(30), bucket(30), bucket(40)],
      }),
    );
    expect(r.activeSignalCount).toBe(0);
    expect(r.watchlist.every((s) => !s.active)).toBe(true);
  });

  it("always returns the full watchlist (every signal present, active or not)", () => {
    const r = computeRouterQualityReview(summary({ stats: { total: 100 } }));
    expect(r.watchlist.map((s) => s.key).sort()).toEqual([
      "high_dangerous_refusal",
      "high_fallback",
      "high_unknown",
      "no_recent_data",
    ]);
  });
});

describe("computeRouterQualityReview — passthrough + purity", () => {
  it("echoes window + top matched rules read-only", () => {
    const r = computeRouterQualityReview(
      summary({
        window: "7d",
        topMatchedRules: [{ ruleId: "nav.resolver", count: 9 }],
        stats: { total: 50 },
      }),
    );
    expect(r.window).toBe("7d");
    expect(r.topMatchedRules).toEqual([{ ruleId: "nav.resolver", count: 9 }]);
  });

  it("never mutates the input summary", () => {
    const s = summary({ stats: { total: 50, unknownTurns: 5 } });
    const before = JSON.stringify(s);
    computeRouterQualityReview(s);
    expect(JSON.stringify(s)).toBe(before);
  });

  it("carries an honest no-behaviour-change note", () => {
    const r = computeRouterQualityReview(summary());
    expect(r.note).toMatch(/no rule, prompt, guard, or HITL change/i);
  });
});
