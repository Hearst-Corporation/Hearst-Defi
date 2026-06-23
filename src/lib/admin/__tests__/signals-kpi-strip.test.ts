import { describe, expect, it } from "vitest";

import { buildSignalsKpiStrip } from "@/lib/admin/signals-kpi-strip";
import { formatRelativeTime } from "@/lib/admin/time-formatters";

// ---------------------------------------------------------------------------
// buildSignalsKpiStrip
// ---------------------------------------------------------------------------

const EMPTY_MAP = { pending: 0, approved: 0, executed: 0, cancelled: 0 };

describe("buildSignalsKpiStrip", () => {
  it("returns [] when all counts are 0 and no recent event", () => {
    expect(buildSignalsKpiStrip(EMPTY_MAP, null)).toEqual([]);
  });

  it("returns [] when countMap is empty object", () => {
    expect(buildSignalsKpiStrip({}, null)).toEqual([]);
  });

  it("returns KPIs when at least one signal exists", () => {
    const kpis = buildSignalsKpiStrip({ pending: 3 }, null);
    expect(kpis.length).toBeGreaterThan(0);
  });

  it("Total signals value equals sum across all statuses", () => {
    const kpis = buildSignalsKpiStrip(
      { pending: 2, approved: 1, executed: 5, cancelled: 1 },
      null,
    );
    const cell = kpis.find((k) => k.label === "Total signals");
    expect(cell?.value).toBe("9");
  });

  it("Pending cell value matches pending count", () => {
    const kpis = buildSignalsKpiStrip({ pending: 4, executed: 2 }, null);
    const cell = kpis.find((k) => k.label === "Pending");
    expect(cell?.value).toBe("4");
  });

  it("Pending cell has alert=true when pending > 0", () => {
    const kpis = buildSignalsKpiStrip({ pending: 1 }, null);
    const cell = kpis.find((k) => k.label === "Pending");
    expect(cell?.alert).toBe(true);
    expect(cell?.accent).toBe(false);
  });

  it("Pending cell has accent=true (no alert) when pending === 0", () => {
    const kpis = buildSignalsKpiStrip({ pending: 0, executed: 3 }, null);
    const cell = kpis.find((k) => k.label === "Pending");
    expect(cell?.alert).toBe(false);
    expect(cell?.accent).toBe(true);
  });

  it("Executed cell has accent=true when executed > 0", () => {
    const kpis = buildSignalsKpiStrip({ executed: 5 }, null);
    const cell = kpis.find((k) => k.label === "Executed");
    expect(cell?.accent).toBe(true);
  });

  it("Most recent cell is included when mostRecentTriggeredAt is provided", () => {
    const date = new Date(Date.now() - 2 * 60 * 60 * 1_000); // 2h ago
    const kpis = buildSignalsKpiStrip({ pending: 1 }, date);
    const cell = kpis.find((k) => k.label === "Most recent");
    expect(cell).toBeDefined();
    expect(cell?.value).toBe("2h ago");
  });

  it("Most recent cell is omitted when mostRecentTriggeredAt is null", () => {
    const kpis = buildSignalsKpiStrip({ pending: 1 }, null);
    expect(kpis.find((k) => k.label === "Most recent")).toBeUndefined();
  });

  it("all provenance values are 'manual'", () => {
    const date = new Date(Date.now() - 60_000);
    const kpis = buildSignalsKpiStrip(
      { pending: 1, approved: 1, executed: 2, cancelled: 0 },
      date,
    );
    for (const kpi of kpis) {
      expect(kpi.provenance).toBe("manual");
    }
  });
});

// ---------------------------------------------------------------------------
// formatRelativeTime
// ---------------------------------------------------------------------------

describe("formatRelativeTime", () => {
  const NOW = 1_700_000_000_000;

  it("returns 'just now' when < 60s", () => {
    const date = new Date(NOW - 45_000);
    expect(formatRelativeTime(date, NOW)).toBe("just now");
  });

  it("returns minutes when < 60m", () => {
    const date = new Date(NOW - 30 * 60_000);
    expect(formatRelativeTime(date, NOW)).toBe("30m ago");
  });

  it("returns hours when < 24h", () => {
    const date = new Date(NOW - 3 * 60 * 60_000);
    expect(formatRelativeTime(date, NOW)).toBe("3h ago");
  });

  it("returns days when >= 24h", () => {
    const date = new Date(NOW - 2 * 24 * 60 * 60_000);
    expect(formatRelativeTime(date, NOW)).toBe("2d ago");
  });
});
