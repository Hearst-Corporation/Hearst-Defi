/**
 * RouterObservabilitySection — read-only render contract.
 *
 * Verifies honest empty/unavailable/enabled states, the window selector, the
 * storage-mode badge, stat cards, outcome trends, recent table, and that NO
 * write/action controls exist. The only interactive elements are <Link> (<a>).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  RouterObservabilitySection,
  ObservabilityWindowSelector,
} from "@/components/admin/agentic/router-observability-section";
import type {
  RouterDecisionTrace,
  RouterObservabilitySummary,
} from "@/lib/agentic/observability/types";

function summary(
  over: Partial<RouterObservabilitySummary> = {},
): RouterObservabilitySummary {
  return {
    state: "enabled",
    storage: "durable",
    window: "24h",
    recent: [],
    stats: {
      total: 0,
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
    capacity: 200,
    retentionNote: "Durable storage. Rows older than 90 days are pruned.",
    safetyNote: "Read-only router metadata. No prompts, no message text, no secrets, no tool payloads, no autonomous writes.",
    privacyMode:
      "metadata-only (ids + enums + flags); user message text never stored",
    trendWindow: "24h",
    trendBuckets: [],
    bufferLimitNote: "Trends computed from durable router traces (window 24h).",
    retentionDays: 90,
    retentionPolicyNote:
      "Retention policy: router decision metadata only, default 90 days. No user messages, prompts, secrets, or tool payloads are stored.",
    windowLimitationNote: null,
    aggregationMode: "sql",
    ...over,
  };
}

const TRACE: RouterDecisionTrace = {
  id: "rdec:turn_1",
  createdAt: "2026-06-25T10:11:12.000Z",
  chatId: "chat_1",
  kind: "navigation",
  actionPolicy: "allow_navigation",
  confidence: 0.95,
  negated: false,
  matchedRuleIds: ["nav.resolver"],
  routeKey: "vaults",
  prohibitedAutonomousAction: false,
  outcome: "nav_fast_path",
  usedLegacyFallback: false,
  tookFastPath: true,
  source: "cockpit_chat",
};

function render(s: RouterObservabilitySummary | null): string {
  return renderToStaticMarkup(<RouterObservabilitySection summary={s} />);
}

const NO_WRITE_CONTROLS = (html: string) => {
  expect(html).not.toContain("<button");
  expect(html).not.toContain("<form");
  expect(html).not.toContain("<input");
};

describe("RouterObservabilitySection v1", () => {
  // Canonized 2026-06-29: the "Observability" heading and the window selector
  // moved to the parent AdminSectionCard (header + trailing slot). The section
  // body renders the state-honest content; the selector is its own export.
  it("renders an honest body for the empty state", () => {
    const html = render(summary({ state: "empty" }));
    expect(html).toContain("No router traces in this window");
    NO_WRITE_CONTROLS(html);
  });

  it("the window selector export renders all four window links", () => {
    const html = renderToStaticMarkup(
      <ObservabilityWindowSelector current="24h" />,
    );
    // Window selector links present (rendered as <a href="?routerWindow=...">).
    expect(html).toContain("routerWindow=1h");
    expect(html).toContain("routerWindow=24h");
    expect(html).toContain("routerWindow=7d");
    expect(html).toContain("routerWindow=30d");
    NO_WRITE_CONTROLS(html);
  });

  it("renders the retention note in the status strip", () => {
    const html = render(summary({ state: "empty" }));
    expect(html).toContain("90 days");
    NO_WRITE_CONTROLS(html);
  });

  it("shows 'durable 30d' badge on the durable 30d window", () => {
    const html = render(summary({ state: "enabled", storage: "durable", window: "30d" }));
    expect(html).toContain("durable 30d");
    NO_WRITE_CONTROLS(html);
  });

  it("renders the window-limitation note when provided", () => {
    const html = render(
      summary({
        state: "enabled",
        storage: "redis_fallback",
        window: "30d",
        windowLimitationNote:
          "30d is powered by durable router traces when available. The current Redis/memory fallback only contains the capped recent buffer (max 200 traces, 7-day TTL), so this long window may be incomplete.",
      }),
    );
    expect(html).toContain("30d is powered by durable router traces");
    NO_WRITE_CONTROLS(html);
  });

  it("does NOT render a limitation note when not provided", () => {
    const html = render(summary({ state: "enabled", windowLimitationNote: null }));
    expect(html).not.toContain("may be incomplete");
  });

  it("null summary → unavailable card, no fake data, no write controls", () => {
    const html = render(null);
    expect(html).toContain("unavailable");
    expect(html).toContain("Router behaviour is");
    NO_WRITE_CONTROLS(html);
  });

  it("unavailable state → honest unavailable message", () => {
    const html = render(summary({ state: "unavailable", storage: "unavailable" }));
    expect(html).toContain("unavailable");
    NO_WRITE_CONTROLS(html);
  });

  it("durable storage badge is shown when storage is durable", () => {
    const html = render(summary({ state: "empty", storage: "durable" }));
    expect(html).toContain("durable");
  });

  it("omits the SQL aggregates badge when aggregationMode is sql (healthy default)", () => {
    const html = render(summary({ state: "empty", aggregationMode: "sql" }));
    expect(html).not.toContain("SQL aggregates");
    NO_WRITE_CONTROLS(html);
  });

  it("shows the in-memory fallback badge when aggregationMode is in_memory", () => {
    const html = render(
      summary({ state: "empty", aggregationMode: "in_memory" }),
    );
    expect(html).toContain("in-memory fallback");
    NO_WRITE_CONTROLS(html);
  });

  it("shows the in-memory fallback badge when aggregationMode is fallback", () => {
    const html = render(
      summary({ state: "empty", storage: "redis_fallback", aggregationMode: "fallback" }),
    );
    expect(html).toContain("in-memory fallback");
    NO_WRITE_CONTROLS(html);
  });

  it("omits the aggregation badge when aggregationMode is undefined (back-compat)", () => {
    const html = render(summary({ state: "empty", aggregationMode: undefined }));
    expect(html).not.toContain("aggregation:");
  });

  it("redis_fallback storage badge is shown honestly", () => {
    const html = render(
      summary({ state: "empty", storage: "redis_fallback" }),
    );
    expect(html).toContain("redis fallback");
  });

  it("empty state → honest empty message, no table", () => {
    const html = render(summary({ state: "empty" }));
    expect(html).toContain("No router traces in this window");
    expect(html).not.toContain("<table");
    NO_WRITE_CONTROLS(html);
  });

  it("enabled state → stats, top rules, and recent table", () => {
    const html = render(
      summary({
        state: "enabled",
        recent: [TRACE],
        topMatchedRules: [{ ruleId: "nav.resolver", count: 1 }],
        stats: {
          total: 1,
          byKind: { navigation: 1 },
          byOutcome: { nav_fast_path: 1 },
          dangerousRefusals: 0,
          negatedNoNav: 0,
          educationalTurns: 0,
          navigationFastPaths: 1,
          legacyFallbacks: 0,
          unknownTurns: 0,
        },
      }),
    );
    expect(html).toContain("Decisions");
    expect(html).toContain("Nav fast-paths");
    expect(html).toContain("<table");
    expect(html).toContain("vaults"); // routeKey
    expect(html).toContain("nav.resolver"); // matched rule
    expect(html).toContain("nav fast-path"); // outcome label
    NO_WRITE_CONTROLS(html);
  });
});
