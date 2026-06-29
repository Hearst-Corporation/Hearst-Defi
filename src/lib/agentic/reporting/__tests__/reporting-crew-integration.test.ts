import { describe, expect, it, vi } from "vitest";

// Integration: getReportingCrewBriefing over the REAL control-center registry,
// with a pre-fetched observability summary passed in (so no DB read is issued).
// Verifies the briefing composes against live registry data and stays read-only.

vi.mock("server-only", () => ({}));

import { getReportingCrewBriefing } from "@/lib/agentic/reporting";

describe("getReportingCrewBriefing — integration with real control-center", () => {
  it("composes a briefing from the real registry + null observability (no_data)", async () => {
    const b = await getReportingCrewBriefing({ observability: null });
    expect(b.mode).toBe("read_only");
    // The real registry has router active + zero unknown tools + safety holding,
    // so with no observability the status is no_data (not alert).
    expect(b.status).toBe("no_data");
    // Tool boundary health reflects the real reflected registry (12 read tools).
    const toolSection = b.sections.find((s) => s.id === "tool-boundary-health")!;
    expect(toolSection.metrics.some((m) => m.value === "12")).toBe(true);
    // Safety & gates: no autonomous gate in the real registry.
    const safety = b.sections.find((s) => s.id === "safety-gates")!;
    expect(safety).toBeDefined();
    // Recommendations are read-only.
    expect(b.recommendedReadOnlyChecks.join(" ")).toMatch(/keep write tools gated/i);
  });

  it("real registry has no autonomous gates and no unclassified tools (healthy signals)", async () => {
    const b = await getReportingCrewBriefing({ observability: null });
    const watchlist = b.sections.find((s) => s.id === "watchlist")!;
    // No alert signals from tool boundary / safety on the real registry.
    expect(watchlist.signals.some((s) => s.severity === "alert")).toBe(false);
  });
});
