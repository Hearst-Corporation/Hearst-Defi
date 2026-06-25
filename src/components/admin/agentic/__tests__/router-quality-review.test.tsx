/**
 * RouterQualityReview (v0) — read-only render contract.
 *
 * Verifies the rates grid, the negated-no-nav count, the read-only watchlist
 * (active + inactive rows), the top-matched-rules list, the healthy/signal
 * header badge, and the no-data state — with NO write/action controls
 * (no <button>, <form>, <input>).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RouterQualityReview } from "@/components/admin/agentic/router-quality-review";
import type { RouterQualityReview as RouterQualityReviewT } from "@/lib/agentic/observability/types";

function review(
  over: Partial<RouterQualityReviewT> = {},
): RouterQualityReviewT {
  return {
    window: "24h",
    total: 100,
    rates: [
      { key: "unknown", label: "Unknown rate", count: 10, total: 100, rate: 0.1 },
      {
        key: "dangerous_refusal",
        label: "Dangerous-refusal rate",
        count: 5,
        total: 100,
        rate: 0.05,
      },
      { key: "educational", label: "Educational rate", count: 20, total: 100, rate: 0.2 },
      {
        key: "nav_fast_path",
        label: "Navigation fast-path rate",
        count: 40,
        total: 100,
        rate: 0.4,
      },
      {
        key: "legacy_fallback",
        label: "Legacy-fallback rate",
        count: 3,
        total: 100,
        rate: 0.03,
      },
    ],
    negatedNoNav: 7,
    topMatchedRules: [{ ruleId: "nav.resolver", count: 12 }],
    watchlist: [
      {
        key: "high_unknown",
        label: "High unknown rate",
        active: false,
        severity: "watch",
        detail: "Unknown 10.0% of 100 decisions",
      },
      {
        key: "high_dangerous_refusal",
        label: "High dangerous-refusal rate",
        active: true,
        severity: "alert",
        detail: "Dangerous refusals 20.0% of 100",
      },
      {
        key: "high_fallback",
        label: "High fallback / degraded source",
        active: false,
        severity: "watch",
        detail: "Legacy nav fallback 3.0% of 100",
      },
      {
        key: "no_recent_data",
        label: "No recent data",
        active: false,
        severity: "info",
        detail: "...",
      },
    ],
    activeSignalCount: 1,
    note: "Read-only interpretation of existing router observability. No rule, prompt, guard, or HITL change; no action — visibility only.",
    ...over,
  };
}

function render(r: RouterQualityReviewT | null | undefined): string {
  return renderToStaticMarkup(<RouterQualityReview review={r} />);
}

const NO_WRITE_CONTROLS = (html: string) => {
  expect(html).not.toContain("<button");
  expect(html).not.toContain("<form");
  expect(html).not.toContain("<input");
};

describe("RouterQualityReview v0", () => {
  it("renders heading, rates, negated count, and the no-behaviour note", () => {
    const html = render(review());
    expect(html).toContain("Router Quality Review");
    expect(html).toContain("Unknown rate");
    expect(html).toContain("Dangerous-refusal rate");
    expect(html).toContain("Navigation fast-path rate");
    expect(html).toContain("Legacy-fallback rate");
    expect(html).toContain("Negated · no nav");
    expect(html).toContain("no action — visibility only");
    NO_WRITE_CONTROLS(html);
  });

  it("shows the rate percentages and count/total", () => {
    const html = render(review());
    expect(html).toContain("10%"); // unknown 0.1 → 10%
    expect(html).toContain("40%"); // nav 0.4 → 40%
    expect(html).toContain("10/100");
  });

  it("renders the full watchlist with active + inactive rows", () => {
    const html = render(review());
    expect(html).toContain("High unknown rate");
    expect(html).toContain("High dangerous-refusal rate");
    expect(html).toContain("High fallback / degraded source");
    expect(html).toContain("No recent data");
    // active alert row toned, inactive rows show "ok"
    expect(html).toContain("alert");
    expect(html).toContain("ok");
    NO_WRITE_CONTROLS(html);
  });

  it("header badge shows signal count when signals are active", () => {
    const html = render(review({ activeSignalCount: 2 }));
    expect(html).toContain("2 signals");
  });

  it("header badge shows healthy when no signals are active", () => {
    const html = render(
      review({
        activeSignalCount: 0,
        watchlist: review().watchlist.map((s) => ({ ...s, active: false })),
      }),
    );
    expect(html).toContain("healthy");
  });

  it("renders the top matched rules read-only", () => {
    const html = render(review());
    expect(html).toContain("Top matched rules");
    expect(html).toContain("nav.resolver");
    expect(html).toContain("12");
    NO_WRITE_CONTROLS(html);
  });

  it("no-data state when total is 0", () => {
    const html = render(review({ total: 0 }));
    expect(html).toContain("No router decisions in this window to review");
    NO_WRITE_CONTROLS(html);
  });

  it("renders nothing when review is null/undefined", () => {
    expect(render(null)).toBe("");
    expect(render(undefined)).toBe("");
  });
});
