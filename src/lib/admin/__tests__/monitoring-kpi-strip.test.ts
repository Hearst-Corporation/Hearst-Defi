import { describe, expect, it } from "vitest";

import { buildMonitoringKpiStrip } from "@/lib/admin/monitoring-kpi-strip";

const BASE = {
  totalRuns: 0,
  successfulRuns: 0,
  failedRuns: 0,
  complianceBlockedRuns: 0,
  totalCostUsd: 0,
  avgLatencyMs: null,
  lastRunAt: null,
};

describe("buildMonitoringKpiStrip", () => {
  it("returns [] when totalRuns is 0", () => {
    expect(buildMonitoringKpiStrip(BASE)).toEqual([]);
  });

  it("always includes Total runs and Healthy when runs > 0", () => {
    const kpis = buildMonitoringKpiStrip({ ...BASE, totalRuns: 10, successfulRuns: 10 });
    const labels = kpis.map((k) => k.label);
    expect(labels).toContain("Total runs");
    expect(labels).toContain("Healthy");
  });

  it("Total runs value matches totalRuns", () => {
    const kpis = buildMonitoringKpiStrip({ ...BASE, totalRuns: 42, successfulRuns: 42 });
    const cell = kpis.find((k) => k.label === "Total runs");
    expect(cell?.value).toBe("42");
  });

  it("'N successful' is the REAL success count, not total minus failures", () => {
    // 10 runs: 6 success, 2 failed, 2 pending — the old formula said
    // "8 successful" by counting the pending runs as successes.
    const kpis = buildMonitoringKpiStrip({
      ...BASE,
      totalRuns: 10,
      successfulRuns: 6,
      failedRuns: 2,
    });
    const cell = kpis.find((k) => k.label === "Total runs");
    expect(cell?.sublabel).toBe("6 successful · 2 pending/other");
  });

  it("omits the pending/other mention when every run resolved", () => {
    const kpis = buildMonitoringKpiStrip({
      ...BASE,
      totalRuns: 10,
      successfulRuns: 9,
      failedRuns: 1,
    });
    const cell = kpis.find((k) => k.label === "Total runs");
    expect(cell?.sublabel).toBe("9 successful");
  });

  it("Healthy % is successfulRuns / totalRuns — pending runs are not healthy", () => {
    const kpis = buildMonitoringKpiStrip({
      ...BASE,
      totalRuns: 10,
      successfulRuns: 6,
      failedRuns: 2, // 2 pending → 60% healthy, not 80%
    });
    const healthy = kpis.find((k) => k.label === "Healthy");
    expect(healthy?.value).toBe("60%");
  });

  it("Healthy cell has accent=true when all runs succeeded", () => {
    const kpis = buildMonitoringKpiStrip({ ...BASE, totalRuns: 5, successfulRuns: 5 });
    const healthy = kpis.find((k) => k.label === "Healthy");
    expect(healthy?.accent).toBe(true);
    expect(healthy?.alert).toBe(false);
  });

  it("Healthy cell has alert=true when error rate >= 10%", () => {
    const kpis = buildMonitoringKpiStrip({
      ...BASE,
      totalRuns: 10,
      successfulRuns: 8,
      failedRuns: 2,
    });
    const healthy = kpis.find((k) => k.label === "Healthy");
    expect(healthy?.alert).toBe(true);
    expect(healthy?.accent).toBe(false);
  });

  it("Healthy percentage rounds correctly", () => {
    // 9 successes out of 10 (1 failure) → 90%
    const kpis = buildMonitoringKpiStrip({
      ...BASE,
      totalRuns: 10,
      successfulRuns: 9,
      failedRuns: 1,
    });
    const healthy = kpis.find((k) => k.label === "Healthy");
    expect(healthy?.value).toBe("90%");
  });

  it("includes Compliance blocks cell when complianceBlockedRuns > 0, scope stated", () => {
    const kpis = buildMonitoringKpiStrip({
      ...BASE,
      totalRuns: 10,
      successfulRuns: 9,
      complianceBlockedRuns: 2,
    });
    const cell = kpis.find((k) => k.label === "Compliance blocks");
    expect(cell).toBeDefined();
    expect(cell?.value).toBe("2");
    expect(cell?.provenance).toBe("manual");
    // The counter only covers cockpit-chat — the copy must say so.
    expect(cell?.sublabel).toContain("cockpit-chat");
    expect(cell?.sublabel).toContain("only");
  });

  it("omits Compliance blocks when complianceBlockedRuns is 0", () => {
    const kpis = buildMonitoringKpiStrip({ ...BASE, totalRuns: 5, successfulRuns: 5 });
    expect(kpis.find((k) => k.label === "Compliance blocks")).toBeUndefined();
  });

  it("Avg latency is '—' (never '0ms') when no run recorded a latency", () => {
    const kpis = buildMonitoringKpiStrip({
      ...BASE,
      totalRuns: 3,
      successfulRuns: 3,
      avgLatencyMs: null,
    });
    const cell = kpis.find((k) => k.label === "Avg latency");
    expect(cell?.value).toBe("—");
    expect(cell?.sublabel).toBe("no latency recorded yet");
  });

  it("Avg latency renders the measured mean when present", () => {
    const kpis = buildMonitoringKpiStrip({
      ...BASE,
      totalRuns: 3,
      successfulRuns: 3,
      avgLatencyMs: 412,
    });
    const cell = kpis.find((k) => k.label === "Avg latency");
    expect(cell?.value).toBe("412ms");
  });

  it("includes Total cost cell when totalCostUsd > 0", () => {
    const kpis = buildMonitoringKpiStrip({
      ...BASE,
      totalRuns: 3,
      successfulRuns: 3,
      totalCostUsd: 1.2345,
    });
    const cell = kpis.find((k) => k.label === "Total cost");
    expect(cell).toBeDefined();
    expect(cell?.value).toBe("$1.23");
  });

  it("Total cost shows sub-dollar with 4 decimals", () => {
    const kpis = buildMonitoringKpiStrip({
      ...BASE,
      totalRuns: 1,
      successfulRuns: 1,
      totalCostUsd: 0.0042,
    });
    const cell = kpis.find((k) => k.label === "Total cost");
    expect(cell?.value).toBe("$0.0042");
  });

  it("includes Last run cell when cost=0 but lastRunAt is set", () => {
    const lastRunAt = new Date(Date.now() - 30 * 60_000); // 30 min ago
    const kpis = buildMonitoringKpiStrip({
      ...BASE,
      totalRuns: 1,
      successfulRuns: 1,
      lastRunAt,
    });
    const cell = kpis.find((k) => k.label === "Last run");
    expect(cell).toBeDefined();
    expect(cell?.value).toBe("30m ago");
  });

  it("all provenance values are manual or estimated (no live/oracle)", () => {
    const kpis = buildMonitoringKpiStrip({
      ...BASE,
      totalRuns: 10,
      successfulRuns: 9,
      failedRuns: 1,
      complianceBlockedRuns: 1,
      totalCostUsd: 0.5,
      avgLatencyMs: 200,
    });
    for (const kpi of kpis) {
      expect(["manual", "estimated"]).toContain(kpi.provenance);
    }
  });
});
