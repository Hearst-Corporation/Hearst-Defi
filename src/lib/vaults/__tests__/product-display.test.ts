import { describe, it, expect } from "vitest";

import {
  buildDistributionIcsUri,
  daysFromNow,
  formatAdminAuditTimestamp,
  formatAdminDate,
  formatAdminDateTime,
  formatAdminMonthDay,
  formatAdminRollingTimestamp,
  formatDateGb,
  formatUsdAmount,
  formatUsdDetailed,
  formatUsdcAmount,
  formatUsdcGrouped,
  formatUsdcFromParam,
} from "@/lib/vaults/product-display";

describe("formatUsdAmount", () => {
  it("formats full amounts with locale grouping", () => {
    expect(formatUsdAmount(500_000)).toBe("$500,000");
    expect(formatUsdAmount(1_250)).toBe("$1,250");
  });

  it("formats compact amounts at k and M thresholds", () => {
    expect(formatUsdAmount(250_000, true)).toBe("$250k");
    expect(formatUsdAmount(1_200_000, true)).toBe("$1.2M");
  });
});

describe("formatUsdDetailed", () => {
  it("formats with two decimal places", () => {
    expect(formatUsdDetailed(1_250_500.5)).toBe("$1,250,500.50");
    expect(formatUsdDetailed(0)).toBe("$0.00");
  });
});

describe("formatUsdcAmount", () => {
  it("matches full USD formatting", () => {
    expect(formatUsdcAmount(358_000)).toBe("$358,000");
    expect(formatUsdcAmount(2_310)).toBe("$2,310");
  });
});

describe("formatUsdcGrouped", () => {
  it("formats rounded grouped integers without currency symbol", () => {
    expect(formatUsdcGrouped(2847)).toBe("2,847");
    expect(formatUsdcGrouped(0)).toBe("0");
    expect(formatUsdcGrouped(10_000)).toBe("10,000");
    expect(formatUsdcGrouped(2847.9)).toBe("2,848");
  });
});

describe("formatUsdcFromParam", () => {
  it("formats a valid USDC query param", () => {
    expect(formatUsdcFromParam("500000")).toBe("$500,000");
  });

  it("returns em dash for missing, zero, or invalid values", () => {
    expect(formatUsdcFromParam(undefined)).toBe("—");
    expect(formatUsdcFromParam("0")).toBe("—");
    expect(formatUsdcFromParam("-100")).toBe("—");
    expect(formatUsdcFromParam("abc")).toBe("—");
  });
});

describe("formatDateGb", () => {
  it("formats dates in en-GB short month style", () => {
    expect(formatDateGb(new Date(2026, 5, 12))).toBe("12 Jun 2026");
  });
});

describe("formatAdminDate", () => {
  it("formats admin date-only labels", () => {
    expect(formatAdminDate(new Date(2026, 5, 12, 14, 30))).toMatch(/Jun 12, 2026/);
  });
});

describe("formatAdminDateTime", () => {
  it("formats admin datetime labels", () => {
    const label = formatAdminDateTime(new Date(2026, 5, 12, 14, 30));
    expect(label).toMatch(/Jun 12, 2026/);
    expect(label).toMatch(/2:30/);
  });
});

describe("formatAdminAuditTimestamp", () => {
  it("includes date, time, and timezone for audit rows", () => {
    const label = formatAdminAuditTimestamp(new Date(2026, 5, 12, 14, 30, 45));
    expect(label).toMatch(/Jun/);
    expect(label).toMatch(/2026/);
    expect(label).toMatch(/14:30:45/);
  });
});

describe("formatAdminMonthDay", () => {
  it("formats month and day without year", () => {
    expect(formatAdminMonthDay(new Date(2026, 5, 12))).toMatch(/Jun 12/);
    expect(formatAdminMonthDay(new Date(2026, 5, 12))).not.toMatch(/2026/);
  });
});

describe("formatAdminRollingTimestamp", () => {
  it("formats compact rolling audit datetime", () => {
    const label = formatAdminRollingTimestamp(new Date(2026, 5, 12, 14, 30));
    expect(label).toMatch(/Jun 12/);
    expect(label).toMatch(/14:30/);
  });
});

describe("buildDistributionIcsUri", () => {
  it("returns a calendar data URI with VEVENT fields", () => {
    const uri = buildDistributionIcsUri("Hearst Yield Vault — Distribution", new Date(2026, 6, 1));
    expect(uri.startsWith("data:text/calendar;charset=utf-8,")).toBe(true);

    const ics = decodeURIComponent(uri.slice("data:text/calendar;charset=utf-8,".length));
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("DTSTART;VALUE=DATE:20260701");
    expect(ics).toContain("SUMMARY:Hearst Yield Vault — Distribution");
    expect(ics).toContain("Target projection based on stated assumptions");
  });
});

describe("daysFromNow", () => {
  it("returns a date n days ahead of today", () => {
    const result = daysFromNow(60);
    const expected = new Date();
    expected.setDate(expected.getDate() + 60);
    expect(result.toDateString()).toBe(expected.toDateString());
  });
});
