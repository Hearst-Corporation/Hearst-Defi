import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RouterObservabilityLongTerm } from "@/components/admin/agentic/router-observability-longterm";
import type {
  RouterLongTermDay,
  RouterLongTermSummary,
} from "@/lib/agentic/observability/types";

function day(
  partial: Partial<RouterLongTermDay> & { date: string },
): RouterLongTermDay {
  return {
    total: 0,
    navigationFastPaths: 0,
    dangerousRefusals: 0,
    educationalTurns: 0,
    negatedNoNav: 0,
    normalOrUnknown: 0,
    ...partial,
  };
}

function summary(
  partial: Partial<RouterLongTermSummary>,
): RouterLongTermSummary {
  return {
    available: true,
    horizonDays: 30,
    retention: { retentionDays: 90, fromEnv: false },
    days: [],
    total: 0,
    totals: {
      navigationFastPaths: 0,
      dangerousRefusals: 0,
      educationalTurns: 0,
      negatedNoNav: 0,
      normalOrUnknown: 0,
    },
    note: "note",
    ...partial,
  };
}

function render(s: RouterLongTermSummary): string {
  return renderToStaticMarkup(<RouterObservabilityLongTerm longTerm={s} />);
}

describe("RouterObservabilityLongTerm", () => {
  it("renders the durable badge + horizon + retention", () => {
    const html = render(summary({ available: true, horizonDays: 30 }));
    expect(html).toContain("Long-term");
    expect(html).toContain("durable");
    expect(html).toContain("last 30d");
    expect(html).toContain("retention 90d");
  });

  it("shows retention source 'env' when configured", () => {
    const html = render(
      summary({ retention: { retentionDays: 14, fromEnv: true } }),
    );
    expect(html).toContain("retention 14d");
    expect(html).toContain("env");
  });

  it("renders per-day bars + horizon totals when there is data", () => {
    const html = render(
      summary({
        total: 3,
        days: [day({ date: "2026-06-25", total: 3, navigationFastPaths: 3 })],
        totals: {
          navigationFastPaths: 3,
          dangerousRefusals: 0,
          educationalTurns: 0,
          negatedNoNav: 0,
          normalOrUnknown: 0,
        },
      }),
    );
    expect(html).toContain("Per-day outcomes");
    expect(html).toContain("Horizon totals");
    expect(html).toContain("Navigation fast-path");
  });

  it("renders an honest unavailable state", () => {
    const html = render(summary({ available: false, note: "unavailable note" }));
    expect(html).toContain("unavailable");
    expect(html).not.toContain("Per-day outcomes");
  });

  it("renders an honest empty state when available but zero", () => {
    const html = render(summary({ available: true, total: 0, days: [] }));
    expect(html).toContain("No durable router traces");
  });

  it("has NO form, input, or write button (read-only)", () => {
    const html = render(summary({ total: 1, days: [day({ date: "2026-06-25", total: 1 })] }));
    expect(html).not.toContain("<form");
    expect(html).not.toContain("<input");
    expect(html).not.toContain("<button");
  });

  it("uses DS tokens, never a hardcoded hex", () => {
    const html = render(summary({ total: 1, days: [day({ date: "2026-06-25", total: 1, dangerousRefusals: 1 })] }));
    expect(html).not.toMatch(/#[0-9a-fA-F]{6}/);
    expect(html).toContain("var(--ct-");
  });
});
