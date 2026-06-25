import { describe, expect, it } from "vitest";

import { buildAgenticSystemMap } from "@/lib/agentic/system-map";
import type { AgenticControlCenterData } from "@/lib/agentic/control-center/types";
import type {
  RouterObservabilitySummary,
  RouterQualityReview,
} from "@/lib/agentic/observability/types";
import type { ToolBoundaryV1Summary } from "@/lib/agentic/tool-boundary/types";

// Controlled-fixture tests for status derivation + purity (the live integration
// test uses the real control-center data; this one drives edge cases). Pure — no
// I/O, no tool execution.

function toolBoundary(over: Partial<ToolBoundaryV1Summary> = {}): ToolBoundaryV1Summary {
  return {
    generatedAt: "static",
    source: "code_reflection",
    counts: { read_only: 11, draft_or_proposal: 6, confirmed_write: 1, forbidden_autonomous: 8, unknown: 0 },
    tools: [],
    consistencyIssues: [],
    safetyNotes: ["x"],
    ...over,
  };
}

function controlCenter(over: Partial<AgenticControlCenterData> = {}): AgenticControlCenterData {
  return {
    generatedAt: "static",
    version: "v0.1",
    router: {
      deterministicRouterExists: true,
      status: "active",
      mode: "non-shadow",
      version: "router v2",
      shadowFlag: { name: "AGENTIC_ROUTER_SHADOW", alive: false, notes: "dead" },
      routerPaths: [],
      activePaths: [],
      shadowOnlyPaths: [],
      educationalSteering: "",
      dangerousIntentPolicy: "",
      guardPolicy: "",
      guardAssertions: [],
      statusBlock: [],
      release: {
        lotStatus: "closed",
        mergeCommit: "x",
        mergePr: "x",
        lockReleaseCommit: "x",
        lockReleasePr: "x",
        vercel: "ready",
        validations: [],
      },
      paths: [],
      legacyFallback: { status: "legacy", notes: "" },
    },
    inventory: [],
    gates: [],
    tools: [],
    toolBoundaryV1: toolBoundary(),
    prompts: [],
    safetySummary: [{ id: "s1", claim: "No autonomous writes", holds: true, evidence: "x" }],
    nextSteps: [],
    ...over,
  };
}

function qualityReview(over: Partial<RouterQualityReview> = {}): RouterQualityReview {
  return {
    window: "24h",
    total: 100,
    rates: [],
    negatedNoNav: 0,
    topMatchedRules: [],
    watchlist: [],
    activeSignalCount: 0,
    note: "x",
    ...over,
  };
}

function observability(over: Partial<RouterObservabilitySummary> = {}): RouterObservabilitySummary {
  return {
    state: "enabled",
    storage: "durable",
    window: "24h",
    recent: [],
    stats: {
      total: 100,
      byKind: {},
      byOutcome: {},
      dangerousRefusals: 0,
      negatedNoNav: 0,
      educationalTurns: 0,
      navigationFastPaths: 0,
      legacyFallbacks: 0,
      unknownTurns: 0,
    },
    topMatchedRules: [],
    capacity: 5000,
    retentionNote: "",
    safetyNote: "",
    privacyMode: "",
    trendWindow: "24h",
    trendBuckets: [],
    bufferLimitNote: "",
    retentionDays: 90,
    retentionPolicyNote: "",
    windowLimitationNote: null,
    aggregationMode: "sql",
    qualityReview: qualityReview(),
    ...over,
  };
}

function nodeStatus(
  map: ReturnType<typeof buildAgenticSystemMap>,
  id: string,
): string | undefined {
  return map.nodes.find((n) => n.id === id)?.status;
}

describe("system map — status derivation (fixtures)", () => {
  it("router healthy when active + non-shadow + flag dead", () => {
    const map = buildAgenticSystemMap({
      controlCenter: controlCenter(),
      observability: observability(),
      reporting: null,
    });
    expect(nodeStatus(map, "router")).toBe("healthy");
  });

  it("router alert when shadow / not active", () => {
    const map = buildAgenticSystemMap({
      controlCenter: controlCenter({
        router: { ...controlCenter().router, status: "shadow", mode: "shadow" },
      }),
      observability: observability(),
      reporting: null,
    });
    expect(nodeStatus(map, "router")).toBe("alert");
  });

  it("router watch when shadow flag alive", () => {
    const map = buildAgenticSystemMap({
      controlCenter: controlCenter({
        router: {
          ...controlCenter().router,
          shadowFlag: { name: "AGENTIC_ROUTER_SHADOW", alive: true, notes: "alive" },
        },
      }),
      observability: observability(),
      reporting: null,
    });
    expect(nodeStatus(map, "router")).toBe("watch");
  });

  it("tool-boundary alert when unknown tools present", () => {
    const map = buildAgenticSystemMap({
      controlCenter: controlCenter({
        toolBoundaryV1: toolBoundary({
          counts: { read_only: 11, draft_or_proposal: 6, confirmed_write: 1, forbidden_autonomous: 8, unknown: 3 },
        }),
      }),
      observability: observability(),
      reporting: null,
    });
    expect(nodeStatus(map, "tool-boundary")).toBe("alert");
  });

  it("observability watch on a redis fallback source", () => {
    const map = buildAgenticSystemMap({
      controlCenter: controlCenter(),
      observability: observability({ storage: "redis_fallback", aggregationMode: "fallback" }),
      reporting: null,
    });
    expect(nodeStatus(map, "router-observability")).toBe("watch");
  });

  it("quality-review alert when an active alert signal is present", () => {
    const map = buildAgenticSystemMap({
      controlCenter: controlCenter(),
      observability: observability({
        qualityReview: qualityReview({
          activeSignalCount: 1,
          watchlist: [
            { key: "high_dangerous_refusal", label: "x", active: true, severity: "alert", detail: "x" },
          ],
        }),
      }),
      reporting: null,
    });
    expect(nodeStatus(map, "quality-review")).toBe("alert");
  });

  it("hitl-gates alert when a gate allows autonomous action", () => {
    const map = buildAgenticSystemMap({
      controlCenter: controlCenter({
        gates: [
          {
            id: "rogue",
            action: "Send",
            domain: "outreach",
            autonomousAllowed: true,
            requiresHuman: false,
            requiresAdmin: true,
            requiresConfirmation: false,
            riskLevel: "high",
            protectedActions: [],
            paths: [],
            notes: "",
          },
        ],
      }),
      observability: observability(),
      reporting: null,
    });
    expect(nodeStatus(map, "hitl-gates")).toBe("alert");
  });
});

describe("system map — purity", () => {
  it("never mutates the input control-center data", () => {
    const cc = controlCenter();
    const before = JSON.stringify(cc);
    buildAgenticSystemMap({ controlCenter: cc, observability: observability(), reporting: null });
    expect(JSON.stringify(cc)).toBe(before);
  });

  it("is deterministic (same input → same output)", () => {
    const cc = controlCenter();
    const obs = observability();
    const a = JSON.stringify(buildAgenticSystemMap({ controlCenter: cc, observability: obs, reporting: null }));
    const b = JSON.stringify(buildAgenticSystemMap({ controlCenter: cc, observability: obs, reporting: null }));
    expect(a).toBe(b);
  });
});
