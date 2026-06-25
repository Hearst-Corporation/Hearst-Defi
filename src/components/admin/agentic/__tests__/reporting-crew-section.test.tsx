/**
 * ReportingCrewSection (v0) — read-only render contract.
 *
 * Verifies the status badge, executive summary, section cards (metrics + signals),
 * the watchlist, the recommended read-only checks, and the safety note — with NO
 * write/action controls (no <button>, <form>, <input>, no run/send/deploy/source).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ReportingCrewSection } from "@/components/admin/agentic/reporting-crew-section";
import type { ReportingCrewBriefing } from "@/lib/agentic/reporting/types";

function briefing(over: Partial<ReportingCrewBriefing> = {}): ReportingCrewBriefing {
  return {
    generatedAt: "read-only composition (static marker)",
    mode: "read_only",
    status: "healthy",
    executiveSummary:
      "The agentic surface looks healthy from the read-only data. Router is active (non-shadow).",
    sections: [
      {
        id: "router-health",
        title: "Router Health",
        summary: "Deterministic router is active (non-shadow).",
        metrics: [
          { id: "router-status", label: "Router", value: "active · non-shadow" },
          { id: "unknown-rate", label: "Unknown rate", value: "5%" },
        ],
        signals: [],
      },
      {
        id: "tool-boundary-health",
        title: "Tool Boundary Health",
        summary: "11 read · 6 draft · 1 confirmed-write · 0 unknown.",
        metrics: [{ id: "read-tools", label: "Read-only", value: "11" }],
        signals: [],
      },
      {
        id: "watchlist",
        title: "Watchlist",
        summary: "No watch or alert signals — the agentic surface looks healthy.",
        metrics: [],
        signals: [],
      },
    ],
    recommendedReadOnlyChecks: [
      "Review the router unknown-rate trend across the windows.",
      "Verify the Tool Boundary shows zero unclassified tools.",
    ],
    safetyNotes: [
      "Read-only composition only. No tools are executed, no writes are performed, and no prompts, user messages, or tool payloads are stored.",
    ],
    ...over,
  };
}

function render(b: ReportingCrewBriefing | null | undefined): string {
  return renderToStaticMarkup(<ReportingCrewSection briefing={b} />);
}

const NO_WRITE_CONTROLS = (html: string) => {
  expect(html).not.toContain("<button");
  expect(html).not.toContain("<form");
  expect(html).not.toContain("<input");
};

describe("ReportingCrewSection v0", () => {
  it("renders heading, status badge, and executive summary", () => {
    const html = render(briefing());
    expect(html).toContain("Reporting Crew");
    expect(html).toContain("read-only briefing");
    expect(html).toContain("healthy");
    expect(html).toContain("Executive summary");
    expect(html).toContain("looks healthy from the read-only data");
    NO_WRITE_CONTROLS(html);
  });

  it("renders section cards with metrics", () => {
    const html = render(briefing());
    expect(html).toContain("Router Health");
    expect(html).toContain("Tool Boundary Health");
    expect(html).toContain("Unknown rate");
    expect(html).toContain("active · non-shadow");
    NO_WRITE_CONTROLS(html);
  });

  it("renders the watchlist with a 'clear' badge when there are no signals", () => {
    const html = render(briefing());
    expect(html).toContain("Watchlist");
    expect(html).toContain("clear");
    NO_WRITE_CONTROLS(html);
  });

  it("renders watchlist signals when present", () => {
    const html = render(
      briefing({
        status: "alert",
        sections: [
          {
            id: "watchlist",
            title: "Watchlist",
            summary: "1 alert · 0 watch signal(s) to review.",
            metrics: [],
            signals: [
              {
                id: "quality:high_dangerous_refusal",
                title: "High dangerous-refusal rate",
                severity: "alert",
                detail: "spike detected",
                source: "Router Quality Review",
              },
            ],
          },
        ],
      }),
    );
    expect(html).toContain("alert");
    expect(html).toContain("High dangerous-refusal rate");
    expect(html).toContain("spike detected");
    NO_WRITE_CONTROLS(html);
  });

  it("renders recommended read-only checks", () => {
    const html = render(briefing());
    expect(html).toContain("Recommended read-only checks");
    expect(html).toContain("Review the router unknown-rate trend");
    NO_WRITE_CONTROLS(html);
  });

  it("renders the verbatim safety note", () => {
    const html = render(briefing());
    expect(html).toContain("Safety");
    expect(html).toContain(
      "No tools are executed, no writes are performed",
    );
    NO_WRITE_CONTROLS(html);
  });

  it("shows the status label for each status", () => {
    expect(render(briefing({ status: "watch" }))).toContain("watch");
    expect(render(briefing({ status: "alert" }))).toContain("alert");
    expect(render(briefing({ status: "no_data" }))).toContain("no data");
  });

  it("renders nothing when briefing is null/undefined", () => {
    expect(render(null)).toBe("");
    expect(render(undefined)).toBe("");
  });
});
