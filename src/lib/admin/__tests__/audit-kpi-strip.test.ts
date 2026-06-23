import { describe, expect, it } from "vitest";

import { buildAuditKpiStrip } from "@/lib/admin/audit-kpi-strip";
import { formatRelativeTimeDate } from "@/lib/admin/time-formatters";

// ---------------------------------------------------------------------------
// formatRelativeTimeDate
// ---------------------------------------------------------------------------

describe("formatRelativeTimeDate", () => {
  const now = new Date("2026-06-18T12:00:00.000Z");

  it("returns 'just now' for < 60s", () => {
    const d = new Date("2026-06-18T11:59:30.000Z"); // 30s ago
    expect(formatRelativeTimeDate(d, now)).toBe("just now");
  });

  it("returns minutes for 1m–59m", () => {
    const d = new Date("2026-06-18T11:55:00.000Z"); // 5m ago
    expect(formatRelativeTimeDate(d, now)).toBe("5m ago");
  });

  it("returns hours for 1h–23h", () => {
    const d = new Date("2026-06-18T10:00:00.000Z"); // 2h ago
    expect(formatRelativeTimeDate(d, now)).toBe("2h ago");
  });

  it("returns days for 24h+", () => {
    const d = new Date("2026-06-15T12:00:00.000Z"); // 3d ago
    expect(formatRelativeTimeDate(d, now)).toBe("3d ago");
  });

  it("returns 'just now' for exactly 0s difference", () => {
    expect(formatRelativeTimeDate(now, now)).toBe("just now");
  });
});

// ---------------------------------------------------------------------------
// buildAuditKpiStrip
// ---------------------------------------------------------------------------

const NOW = new Date("2026-06-18T14:00:00.000Z");

function makeEntry(
  occurredAt: Date,
  actorWallet = "0xABCD",
) {
  return { occurredAt, actorWallet };
}

describe("buildAuditKpiStrip", () => {
  it("returns [] when entries is empty", () => {
    expect(buildAuditKpiStrip([], NOW)).toEqual([]);
  });

  it("returns 4 KPIs when entries exist", () => {
    const entries = [makeEntry(new Date("2026-06-18T13:00:00.000Z"))];
    expect(buildAuditKpiStrip(entries, NOW)).toHaveLength(4);
  });

  it("Events value matches entry count", () => {
    const entries = [
      makeEntry(new Date("2026-06-18T13:00:00.000Z")),
      makeEntry(new Date("2026-06-17T10:00:00.000Z")),
    ];
    const kpis = buildAuditKpiStrip(entries, NOW);
    const events = kpis.find((k) => k.label === "Events");
    expect(events?.value).toBe("2");
  });

  it("Events sublabel says 'capped at 200 per query' when total === 200", () => {
    const entries = Array.from({ length: 200 }, (_, i) =>
      makeEntry(new Date(NOW.getTime() - i * 60_000)),
    );
    const kpis = buildAuditKpiStrip(entries, NOW);
    const events = kpis.find((k) => k.label === "Events");
    expect(events?.sublabel).toBe("capped at 200 per query");
  });

  it("Distinct actors deduplicates case-insensitively", () => {
    const entries = [
      makeEntry(new Date("2026-06-18T13:00:00.000Z"), "0xABCD"),
      makeEntry(new Date("2026-06-18T12:00:00.000Z"), "0xabcd"), // same wallet, different case
      makeEntry(new Date("2026-06-18T11:00:00.000Z"), "0x1234"),
    ];
    const kpis = buildAuditKpiStrip(entries, NOW);
    const actors = kpis.find((k) => k.label === "Distinct actors");
    expect(actors?.value).toBe("2");
  });

  it("Most recent picks the newest entry regardless of array order", () => {
    const older = makeEntry(new Date("2026-06-18T12:00:00.000Z")); // 2h ago
    const newer = makeEntry(new Date("2026-06-18T13:50:00.000Z")); // 10m ago
    // reverse order — older first
    const kpis = buildAuditKpiStrip([older, newer], NOW);
    const recent = kpis.find((k) => k.label === "Most recent");
    expect(recent?.value).toBe("10m ago");
  });

  it("Most recent has accent=true", () => {
    const kpis = buildAuditKpiStrip(
      [makeEntry(new Date("2026-06-18T13:00:00.000Z"))],
      NOW,
    );
    const recent = kpis.find((k) => k.label === "Most recent");
    expect(recent?.accent).toBe(true);
  });

  it("Today counts only entries on UTC today", () => {
    const entries = [
      makeEntry(new Date("2026-06-18T00:01:00.000Z")), // today
      makeEntry(new Date("2026-06-18T13:59:00.000Z")), // today
      makeEntry(new Date("2026-06-17T23:59:00.000Z")), // yesterday
    ];
    const kpis = buildAuditKpiStrip(entries, NOW);
    const today = kpis.find((k) => k.label === "Today");
    expect(today?.value).toBe("2");
  });

  it("all provenance values are 'manual'", () => {
    const entries = [makeEntry(new Date("2026-06-18T13:00:00.000Z"))];
    const kpis = buildAuditKpiStrip(entries, NOW);
    for (const kpi of kpis) {
      expect(kpi.provenance).toBe("manual");
    }
  });
});
