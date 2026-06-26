import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RouterObservabilityTrends } from "@/components/admin/agentic/router-observability-trends";
import type {
  RouterDecisionTrendBucket,
  RouterMatchedRuleStat,
} from "@/lib/agentic/observability/types";

const BUFFER_NOTE =
  "Trends are computed from the capped v0 router trace buffer: max 200 traces, TTL 7 days.";

function bucket(
  partial: Partial<RouterDecisionTrendBucket> & { label: string; start: string },
): RouterDecisionTrendBucket {
  return {
    end: partial.start,
    total: 0,
    navigationFastPaths: 0,
    dangerousRefusals: 0,
    educationalTurns: 0,
    negatedNoNav: 0,
    normalOrUnknown: 0,
    ...partial,
  };
}

function render(
  buckets: RouterDecisionTrendBucket[],
  rules: RouterMatchedRuleStat[],
): string {
  return renderToStaticMarkup(
    <RouterObservabilityTrends
      window="24h"
      buckets={buckets}
      topMatchedRules={rules}
      bufferLimitNote={BUFFER_NOTE}
    />,
  );
}

describe("RouterObservabilityTrends", () => {
  const filled = [
    bucket({
      label: "11:00",
      start: "2026-06-25T11:00:00.000Z",
      total: 3,
      navigationFastPaths: 2,
      dangerousRefusals: 1,
    }),
  ];

  it("renders trend, distribution, and section labels in a unified module", () => {
    const html = render(filled, []);
    expect(html).toContain("Outcome trend");
    expect(html).toContain("Outcome distribution");
    expect(html).toContain("Top matched rules");
    expect(html).toContain("agentic-trends");
  });

  it("renders top matched rules with counts", () => {
    const html = render(filled, [
      { ruleId: "deploy.go_live", count: 4 },
      { ruleId: "send.email", count: 2 },
    ]);
    expect(html).toContain("deploy.go_live");
    expect(html).toContain("send.email");
  });

  it("renders an honest empty state when no rules", () => {
    const html = render(filled, []);
    expect(html).toContain("No matched rules recorded");
  });

  it("renders the buffer limitation note", () => {
    expect(render(filled, [])).toContain(BUFFER_NOTE);
  });

  it("renders an honest empty trend when the window has zero decisions", () => {
    const empty = [
      bucket({ label: "11:00", start: "2026-06-25T11:00:00.000Z", total: 0 }),
    ];
    const html = render(empty, []);
    expect(html).toContain("No router decisions in this window yet");
  });

  it("has NO form, input, or write button (read-only)", () => {
    const html = render(filled, [{ ruleId: "x", count: 1 }]);
    expect(html).not.toContain("<form");
    expect(html).not.toContain("<input");
    expect(html).not.toContain("<button");
  });

  it("uses DS color tokens via tone-driven classes, never a hardcoded hex", () => {
    const html = render(filled, []);
    // No raw hex anywhere, and no inline rgb()/rgba() color literals.
    expect(html).not.toMatch(/#[0-9a-fA-F]{6}/);
    expect(html).not.toMatch(/rgba?\(/);
    // Color is carried by the token-only agentic vocabulary (data-tone + classes
    // defined in admin-docs.css with var(--ct-*)), not inline style colors.
    expect(html).toContain('data-tone="accent"');
    expect(html).toContain("agentic-tag");
    expect(html).toContain("agentic-bar-fill");
  });
});
