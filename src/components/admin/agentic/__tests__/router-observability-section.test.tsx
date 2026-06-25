/**
 * RouterObservabilitySection — read-only render contract.
 *
 * Verifies the section renders honest empty/unavailable/enabled states, the
 * safety note, the stat labels, and a recent-decisions table — with NO write or
 * action controls (no <button>, no <form>, no <input>).
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
    storage: "memory",
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
    capacity: 100,
    safetyNote: SAFETY,
    privacyMode: "metadata-only (ids + enums + flags); user message text never stored",
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

const NO_CONTROLS = (html: string) => {
  expect(html).not.toContain("<button");
  expect(html).not.toContain("<form");
  expect(html).not.toContain("<input");
};

describe("RouterObservabilitySection", () => {
  it("always renders the section heading + safety note", () => {
    const html = render(summary({ state: "empty" }));
    expect(html).toContain("Router Observability");
    expect(html).toContain(SAFETY);
    NO_CONTROLS(html);
  });

  it("null summary → unavailable card, no fake data, no controls", () => {
    const html = render(null);
    expect(html).toContain("unavailable");
    expect(html).toContain("no safe existing persistence");
    NO_CONTROLS(html);
  });

  it("unavailable state → honest unavailable message", () => {
    const html = render(summary({ state: "unavailable", storage: "none" }));
    expect(html).toContain("unavailable");
    NO_CONTROLS(html);
  });

  it("empty state → honest empty message, no table rows", () => {
    const html = render(summary({ state: "empty" }));
    expect(html).toContain("No router traces recorded yet");
    expect(html).not.toContain("<table");
    NO_CONTROLS(html);
  });

  it("enabled state → stat labels + decisions table with the trace", () => {
    const html = render(
      summary({
        state: "enabled",
        recent: [TRACE],
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
    expect(html).toContain("Recent decisions");
    expect(html).toContain("Navigation fast-paths");
    expect(html).toContain("Dangerous refusals");
    expect(html).toContain("<table");
    expect(html).toContain("vaults"); // routeKey rendered
    expect(html).toContain("nav.resolver"); // matched rule rendered
    expect(html).toContain("nav fast-path"); // outcome label
    NO_CONTROLS(html);
  });
});
