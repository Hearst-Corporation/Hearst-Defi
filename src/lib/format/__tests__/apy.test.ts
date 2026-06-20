import { describe, expect, it } from "vitest";

import { formatApyRange } from "@/lib/format/apy";

describe("formatApyRange (pct)", () => {
  it("formats 9.4/12.8 as en-dash range", () => {
    expect(formatApyRange({ low: 9.4, high: 12.8 })).toBe("9.4\u201312.8%");
  });

  it("formats spaced en-dash for cockpit ticker", () => {
    expect(formatApyRange({ low: 9.4, high: 12.8 }, 1, { spaced: true })).toBe(
      "9.4 \u2013 12.8%",
    );
  });

  it("swaps inverted bounds", () => {
    expect(formatApyRange({ low: 12.8, high: 9.4 })).toBe("9.4\u201312.8%");
  });

  it("respects digit precision", () => {
    expect(formatApyRange({ low: 10, high: 11 }, 2)).toBe("10.00\u201311.00%");
  });
});
