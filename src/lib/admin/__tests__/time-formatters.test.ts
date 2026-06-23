import { describe, expect, it } from "vitest";

import {
  formatRelativeTime,
  formatRelativeTimeDate,
} from "@/lib/admin/time-formatters";

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

  it("uses Date.now() as default when now not provided", () => {
    const date = new Date(Date.now() - 60_000);
    const result = formatRelativeTime(date);
    expect(result).toMatch(/\d+m ago|just now/);
  });
});

describe("formatRelativeTimeDate", () => {
  it("delegates to formatRelativeTime with timestamp", () => {
    const now = new Date(1_700_000_000_000);
    const date = new Date(now.getTime() - 30 * 60_000);
    expect(formatRelativeTimeDate(date, now)).toBe("30m ago");
  });

  it("uses new Date() as default when now not provided", () => {
    const date = new Date(Date.now() - 60_000);
    const result = formatRelativeTimeDate(date);
    expect(result).toMatch(/\d+m ago|just now/);
  });
});
