import { describe, expect, it } from "vitest";

import { buildFeedbackKpiStrip } from "@/lib/admin/feedback-kpi-strip";

describe("buildFeedbackKpiStrip", () => {
  it("returns [] when items is empty", () => {
    expect(buildFeedbackKpiStrip([])).toEqual([]);
  });

  it("includes Total feedback, Open, Resolved for any non-empty list", () => {
    const kpis = buildFeedbackKpiStrip([
      { resolved: false, itemId: null },
    ]);
    const labels = kpis.map((k) => k.label);
    expect(labels).toContain("Total feedback");
    expect(labels).toContain("Open");
    expect(labels).toContain("Resolved");
  });

  it("Total feedback value matches items length", () => {
    const kpis = buildFeedbackKpiStrip([
      { resolved: false, itemId: null },
      { resolved: true, itemId: null },
      { resolved: false, itemId: "roadmap-1" },
    ]);
    expect(kpis.find((k) => k.label === "Total feedback")?.value).toBe("3");
  });

  it("Open count is accurate", () => {
    const kpis = buildFeedbackKpiStrip([
      { resolved: false, itemId: null },
      { resolved: false, itemId: null },
      { resolved: true, itemId: null },
    ]);
    expect(kpis.find((k) => k.label === "Open")?.value).toBe("2");
  });

  it("Open cell has alert=true when open > 0", () => {
    const kpis = buildFeedbackKpiStrip([{ resolved: false, itemId: null }]);
    expect(kpis.find((k) => k.label === "Open")?.alert).toBe(true);
  });

  it("Open cell has alert=false when all resolved", () => {
    const kpis = buildFeedbackKpiStrip([{ resolved: true, itemId: null }]);
    expect(kpis.find((k) => k.label === "Open")?.alert).toBe(false);
  });

  it("Resolved cell has accent=true when all resolved", () => {
    const kpis = buildFeedbackKpiStrip([
      { resolved: true, itemId: null },
      { resolved: true, itemId: null },
    ]);
    expect(kpis.find((k) => k.label === "Resolved")?.accent).toBe(true);
  });

  it("Resolved cell has accent=false when some still open", () => {
    const kpis = buildFeedbackKpiStrip([
      { resolved: true, itemId: null },
      { resolved: false, itemId: null },
    ]);
    expect(kpis.find((k) => k.label === "Resolved")?.accent).toBe(false);
  });

  it("Resolved sublabel shows correct percentage", () => {
    const kpis = buildFeedbackKpiStrip([
      { resolved: true, itemId: null },
      { resolved: true, itemId: null },
      { resolved: false, itemId: null },
      { resolved: false, itemId: null },
    ]);
    // 2/4 = 50%
    expect(kpis.find((k) => k.label === "Resolved")?.sublabel).toBe("50% of total");
  });

  it("includes Roadmap-linked cell when itemId count > 0", () => {
    const kpis = buildFeedbackKpiStrip([
      { resolved: false, itemId: "item-1" },
      { resolved: false, itemId: null },
    ]);
    const cell = kpis.find((k) => k.label === "Roadmap-linked");
    expect(cell).toBeDefined();
    expect(cell?.value).toBe("1");
    expect(cell?.provenance).toBe("manual");
  });

  it("omits Roadmap-linked cell when no items have itemId", () => {
    const kpis = buildFeedbackKpiStrip([
      { resolved: false, itemId: null },
    ]);
    expect(kpis.find((k) => k.label === "Roadmap-linked")).toBeUndefined();
  });

  it("all provenance values are manual", () => {
    const kpis = buildFeedbackKpiStrip([
      { resolved: false, itemId: "x" },
      { resolved: true, itemId: null },
    ]);
    for (const kpi of kpis) {
      expect(kpi.provenance).toBe("manual");
    }
  });
});
