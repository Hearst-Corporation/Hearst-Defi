/**
 * RouterObservabilitySection (v1) — read-only render contract.
 *
 * Verifies honest empty/unavailable/enabled states, the window selector, the
 * storage-mode badge, the outcome distribution, top matched rules, the recent
 * table, and the safety note — with NO write/action controls (no <button>,
 * <form>, <input>). The only interactive elements are <Link> (rendered as <a>).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RouterObservabilitySection } from "@/components/admin/agentic/router-observability-section";
import type {
  RouterDecisionTrace,
  RouterObservabilitySummary,
} from "@/lib/agentic/observability/types";

const SAFETY =
  "Read-only router metadata. No prompts, no message text, no secrets, no tool payloads, no autonomous writes.";

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
    safetyNote: SAFETY,
    privacyMode:
      "metadata-only (ids + enums + flags); user message text never stored",
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
  it("always renders heading, window selector, and safety note", () => {
    const html = render(summary({ state: "empty" }));
    expect(html).toContain("Router Observability");
    expect(html).toContain(SAFETY);
    // Window selector links present (rendered as <a href="?routerWindow=...">).
    expect(html).toContain("routerWindow=1h");
    expect(html).toContain("routerWindow=24h");
    expect(html).toContain("routerWindow=7d");
    NO_WRITE_CONTROLS(html);
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

  it("enabled state → stats, distribution, top rules, and table", () => {
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
    expect(html).toContain("Total decisions");
    expect(html).toContain("Navigation fast-paths");
    expect(html).toContain("Outcome distribution");
    expect(html).toContain("Top matched rules");
    expect(html).toContain("<table");
    expect(html).toContain("vaults"); // routeKey
    expect(html).toContain("nav.resolver"); // matched rule
    expect(html).toContain("nav fast-path"); // outcome label
    NO_WRITE_CONTROLS(html);
  });
});
