import { describe, expect, it } from "vitest";

import { buildFeedbackKpiStrip } from "@/lib/admin/feedback-kpi-strip";

/**
 * Contract (vague 2 — E2): the strip is built from WHOLE-TABLE aggregates
 * (Prisma count without take), never from the capped 100-row log window.
 */
describe("buildFeedbackKpiStrip", () => {
  it("returns [] when the table is empty", () => {
    expect(
      buildFeedbackKpiStrip({ total: 0, resolved: 0, linkedToRoadmap: 0 }),
    ).toEqual([]);
  });

  it("includes Total feedback, Open, Resolved for any non-empty table", () => {
    const kpis = buildFeedbackKpiStrip({
      total: 1,
      resolved: 0,
      linkedToRoadmap: 0,
    });
    const labels = kpis.map((k) => k.label);
    expect(labels).toContain("Total feedback");
    expect(labels).toContain("Open");
    expect(labels).toContain("Resolved");
  });

  it("Total feedback reflects the whole-table count, beyond any window", () => {
    // 250 rows in the table — more than the 100-row rendered window.
    const kpis = buildFeedbackKpiStrip({
      total: 250,
      resolved: 100,
      linkedToRoadmap: 5,
    });
    expect(kpis.find((k) => k.label === "Total feedback")?.value).toBe("250");
  });

  it("Open count is total - resolved", () => {
    const kpis = buildFeedbackKpiStrip({
      total: 3,
      resolved: 1,
      linkedToRoadmap: 0,
    });
    expect(kpis.find((k) => k.label === "Open")?.value).toBe("2");
  });

  it("Open cell has alert=true when open > 0", () => {
    const kpis = buildFeedbackKpiStrip({
      total: 1,
      resolved: 0,
      linkedToRoadmap: 0,
    });
    expect(kpis.find((k) => k.label === "Open")?.alert).toBe(true);
  });

  it("Open cell has alert=false when all resolved", () => {
    const kpis = buildFeedbackKpiStrip({
      total: 1,
      resolved: 1,
      linkedToRoadmap: 0,
    });
    expect(kpis.find((k) => k.label === "Open")?.alert).toBe(false);
  });

  it("Resolved cell has accent=true when all resolved", () => {
    const kpis = buildFeedbackKpiStrip({
      total: 2,
      resolved: 2,
      linkedToRoadmap: 0,
    });
    expect(kpis.find((k) => k.label === "Resolved")?.accent).toBe(true);
  });

  it("Resolved cell has accent=false when some still open", () => {
    const kpis = buildFeedbackKpiStrip({
      total: 2,
      resolved: 1,
      linkedToRoadmap: 0,
    });
    expect(kpis.find((k) => k.label === "Resolved")?.accent).toBe(false);
  });

  it("Resolved sublabel shows correct percentage", () => {
    const kpis = buildFeedbackKpiStrip({
      total: 4,
      resolved: 2,
      linkedToRoadmap: 0,
    });
    // 2/4 = 50%
    expect(kpis.find((k) => k.label === "Resolved")?.sublabel).toBe(
      "50% of total",
    );
  });

  it("includes Roadmap-linked cell when linked count > 0", () => {
    const kpis = buildFeedbackKpiStrip({
      total: 2,
      resolved: 0,
      linkedToRoadmap: 1,
    });
    const cell = kpis.find((k) => k.label === "Roadmap-linked");
    expect(cell).toBeDefined();
    expect(cell?.value).toBe("1");
    expect(cell?.provenance).toBe("manual");
  });

  it("omits Roadmap-linked cell when no linked items", () => {
    const kpis = buildFeedbackKpiStrip({
      total: 1,
      resolved: 0,
      linkedToRoadmap: 0,
    });
    expect(kpis.find((k) => k.label === "Roadmap-linked")).toBeUndefined();
  });

  it("all provenance values are manual — carried by the presenter, no render literal", () => {
    const kpis = buildFeedbackKpiStrip({
      total: 2,
      resolved: 1,
      linkedToRoadmap: 1,
    });
    for (const kpi of kpis) {
      expect(kpi.provenance).toBe("manual");
    }
  });
});
