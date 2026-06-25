import { describe, expect, it } from "vitest";

import {
  composeReportingCrewBriefing,
  deriveRouterSignals,
  deriveToolBoundarySignals,
  deriveSafetySignals,
  buildRecommendedReadOnlyChecks,
} from "@/lib/agentic/reporting";
import type { ReportingCrewInputs } from "@/lib/agentic/reporting/types";
import type { AgenticControlCenterData } from "@/lib/agentic/control-center/types";
import type {
  RouterObservabilitySummary,
  RouterQualityReview,
} from "@/lib/agentic/observability/types";
import type { ToolBoundaryV1Summary } from "@/lib/agentic/tool-boundary/types";

// reporting-crew is a PURE deterministic composition over read-only inputs — no
// I/O, no DB. These tests build minimal inputs and assert the briefing shape.

function toolBoundary(
  over: Partial<ToolBoundaryV1Summary> = {},
): ToolBoundaryV1Summary {
  return {
    generatedAt: "static",
    source: "code_reflection",
    counts: {
      read_only: 11,
      draft_or_proposal: 6,
      confirmed_write: 1,
      forbidden_autonomous: 8,
      unknown: 0,
    },
    tools: [],
    consistencyIssues: [],
    safetyNotes: ["x"],
    ...over,
  };
}

function controlCenter(
  over: Partial<AgenticControlCenterData> = {},
): AgenticControlCenterData {
  return {
    generatedAt: "static registry v0.1 / read-only",
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
    gates: [
      {
        id: "deploy",
        action: "Mainnet deploy",
        domain: "contracts",
        autonomousAllowed: false,
        requiresHuman: true,
        requiresAdmin: true,
        requiresConfirmation: true,
        riskLevel: "critical",
        protectedActions: [],
        paths: [],
        notes: "",
      },
    ],
    tools: [],
    toolBoundaryV1: toolBoundary(),
    prompts: [],
    safetySummary: [
      { id: "s1", claim: "No autonomous writes", holds: true, evidence: "x" },
    ],
    nextSteps: [],
    ...over,
  };
}

function qualityReview(
  over: Partial<RouterQualityReview> = {},
): RouterQualityReview {
  return {
    window: "24h",
    total: 100,
    rates: [
      { key: "unknown", label: "Unknown rate", count: 5, total: 100, rate: 0.05 },
      {
        key: "dangerous_refusal",
        label: "Dangerous-refusal rate",
        count: 2,
        total: 100,
        rate: 0.02,
      },
      { key: "educational", label: "Educational rate", count: 20, total: 100, rate: 0.2 },
    ],
    negatedNoNav: 1,
    topMatchedRules: [],
    watchlist: [
      { key: "high_unknown", label: "High unknown rate", active: false, severity: "watch", detail: "x" },
      { key: "high_dangerous_refusal", label: "High dangerous-refusal rate", active: false, severity: "alert", detail: "x" },
      { key: "high_fallback", label: "High fallback", active: false, severity: "watch", detail: "x" },
      { key: "no_recent_data", label: "No recent data", active: false, severity: "info", detail: "x" },
    ],
    activeSignalCount: 0,
    note: "x",
    ...over,
  };
}

function observability(
  over: Partial<RouterObservabilitySummary> = {},
): RouterObservabilitySummary {
  return {
    state: "enabled",
    storage: "durable",
    window: "24h",
    recent: [],
    stats: {
      total: 100,
      byKind: {},
      byOutcome: {},
      dangerousRefusals: 2,
      negatedNoNav: 1,
      educationalTurns: 20,
      navigationFastPaths: 50,
      legacyFallbacks: 1,
      unknownTurns: 5,
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

function inputs(over: Partial<ReportingCrewInputs> = {}): ReportingCrewInputs {
  return {
    controlCenter: controlCenter(),
    observability: observability(),
    ...over,
  };
}

describe("composeReportingCrewBriefing — status", () => {
  it("healthy on a clean durable window with no active signals", () => {
    const b = composeReportingCrewBriefing(inputs());
    expect(b.status).toBe("healthy");
    expect(b.mode).toBe("read_only");
    expect(b.sections.length).toBeGreaterThanOrEqual(5);
    expect(b.generatedAt).toMatch(/static marker/i);
  });

  it("watch when an observability fallback source is active", () => {
    const b = composeReportingCrewBriefing(
      inputs({
        observability: observability({
          storage: "redis_fallback",
          aggregationMode: "fallback",
        }),
      }),
    );
    expect(b.status).toBe("watch");
    const watchlist = b.sections.find((s) => s.id === "watchlist")!;
    expect(watchlist.signals.some((s) => s.id === "router-storage-fallback")).toBe(
      true,
    );
  });

  it("alert when the quality review has an active dangerous-refusal signal", () => {
    const b = composeReportingCrewBriefing(
      inputs({
        observability: observability({
          qualityReview: qualityReview({
            activeSignalCount: 1,
            watchlist: [
              {
                key: "high_dangerous_refusal",
                label: "High dangerous-refusal rate",
                active: true,
                severity: "alert",
                detail: "spike",
              },
            ],
          }),
        }),
      }),
    );
    expect(b.status).toBe("alert");
    const watchlist = b.sections.find((s) => s.id === "watchlist")!;
    expect(
      watchlist.signals.some((s) => s.id === "quality:high_dangerous_refusal"),
    ).toBe(true);
  });

  it("alert when tool boundary has unknown tools", () => {
    const b = composeReportingCrewBriefing(
      inputs({
        controlCenter: controlCenter({
          toolBoundaryV1: toolBoundary({
            counts: {
              read_only: 11,
              draft_or_proposal: 6,
              confirmed_write: 1,
              forbidden_autonomous: 8,
              unknown: 2,
            },
          }),
        }),
      }),
    );
    expect(b.status).toBe("alert");
  });

  it("no_data when there is no observability summary", () => {
    const b = composeReportingCrewBriefing(inputs({ observability: null }));
    expect(b.status).toBe("no_data");
    const watchlist = b.sections.find((s) => s.id === "watchlist")!;
    expect(watchlist.signals.some((s) => s.id === "no-data-observability")).toBe(
      true,
    );
  });
});

describe("signal derivation", () => {
  it("deriveRouterSignals folds active quality watchlist signals", () => {
    const sigs = deriveRouterSignals(
      observability({
        qualityReview: qualityReview({
          watchlist: [
            { key: "high_unknown", label: "High unknown rate", active: true, severity: "watch", detail: "x" },
          ],
        }),
      }),
    );
    expect(sigs.some((s) => s.id === "quality:high_unknown")).toBe(true);
  });

  it("deriveRouterSignals returns an info signal when observability is null", () => {
    const sigs = deriveRouterSignals(null);
    expect(sigs[0]!.severity).toBe("info");
  });

  it("deriveToolBoundarySignals alerts on unknown tools + critical issues", () => {
    const sigs = deriveToolBoundarySignals(
      toolBoundary({
        counts: {
          read_only: 11,
          draft_or_proposal: 6,
          confirmed_write: 1,
          forbidden_autonomous: 8,
          unknown: 1,
        },
        consistencyIssues: [
          { id: "write-without-gate:x", severity: "critical", message: "x" },
        ],
      }),
    );
    expect(sigs.some((s) => s.id === "tool-boundary-unknown" && s.severity === "alert")).toBe(true);
    expect(sigs.some((s) => s.id.startsWith("tool-boundary-critical"))).toBe(true);
  });

  it("deriveSafetySignals alerts on a non-holding safety claim + autonomous gate", () => {
    const sigs = deriveSafetySignals(
      controlCenter({
        safetySummary: [
          { id: "s1", claim: "No autonomous writes", holds: false, evidence: "x" },
        ],
        gates: [
          {
            id: "g1",
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
    );
    expect(sigs.some((s) => s.id.startsWith("safety-fail")) && sigs.some((s) => s.id.startsWith("gate-autonomous"))).toBe(true);
  });
});

describe("recommendations are read-only", () => {
  const FORBIDDEN = [
    "send",
    "source",
    "deploy",
    "mark live",
    "execute",
    "run tool",
    "approve",
    "mutate",
  ];

  it("contains baseline read-only checks", () => {
    const checks = buildRecommendedReadOnlyChecks({
      controlCenter: controlCenter(),
      observability: observability(),
      signals: [],
    });
    expect(checks.length).toBeGreaterThan(0);
    expect(checks.join(" ")).toMatch(/review|check|verify|confirm/i);
  });

  it("no recommendation enables a forbidden write/dangerous action", () => {
    const checks = buildRecommendedReadOnlyChecks({
      controlCenter: controlCenter(),
      observability: observability(),
      signals: [
        { id: "quality:high_dangerous_refusal", title: "x", severity: "alert", detail: "x", source: "x" },
        { id: "tool-boundary-critical:x", title: "x", severity: "alert", detail: "x", source: "x" },
        { id: "router-storage-fallback", title: "x", severity: "watch", detail: "x", source: "x" },
      ],
    });
    // Every check is a verb-imperative read-only verification. Assert none reads
    // as an actionable forbidden command (e.g. "Send the…", "Deploy the…").
    for (const check of checks) {
      const lower = check.toLowerCase();
      for (const verb of FORBIDDEN) {
        // Allow the verb only inside an explicit "do not enable …" / negated phrase.
        if (lower.includes(verb)) {
          expect(
            /do not|don't|keep .* gated|non-autonomous|read-only|before/.test(lower),
            `forbidden verb "${verb}" in actionable position: "${check}"`,
          ).toBe(true);
        }
      }
    }
  });

  it("the whole briefing never recommends an autonomous write", () => {
    const b = composeReportingCrewBriefing(inputs());
    const blob = b.recommendedReadOnlyChecks.join(" ").toLowerCase();
    expect(blob).toMatch(/keep write tools gated/);
    expect(blob).not.toMatch(/\bsend the\b|\bdeploy the\b|\bsource leads\b|\bmark .* live\b/);
  });
});

describe("purity", () => {
  it("never mutates the input objects", () => {
    const inp = inputs();
    const before = JSON.stringify(inp);
    composeReportingCrewBriefing(inp);
    expect(JSON.stringify(inp)).toBe(before);
  });

  it("is deterministic (same input → same output)", () => {
    const inp = inputs();
    expect(JSON.stringify(composeReportingCrewBriefing(inp))).toBe(
      JSON.stringify(composeReportingCrewBriefing(inp)),
    );
  });

  it("carries the verbatim read-only safety note", () => {
    const b = composeReportingCrewBriefing(inputs());
    expect(b.safetyNotes.join(" ")).toMatch(
      /no tools are executed, no writes are performed/i,
    );
  });
});
