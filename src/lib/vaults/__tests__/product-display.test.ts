import { describe, it, expect } from "vitest";

import {
  buildDistributionIcsUri,
  daysFromNow,
  formatDateGb,
  formatUsdAmount,
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
