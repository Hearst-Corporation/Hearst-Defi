import { describe, expect, it } from "vitest";

import { formatUsdCompact } from "../usd-compact";

describe("formatUsdCompact", () => {
  it("formats thousands without trailing .0 (SSR/client stable)", () => {
    expect(formatUsdCompact(500_000)).toBe("$500K");
    expect(formatUsdCompact(542_300)).toBe("$542.3K");
  });

  it("formats millions", () => {
    expect(formatUsdCompact(1_250_000)).toBe("$1.3M");
  });

  it("formats sub-thousand ($100-$999) as integers", () => {
    expect(formatUsdCompact(850)).toBe("$850");
    expect(formatUsdCompact(100)).toBe("$100");
    expect(formatUsdCompact(999)).toBe("$999");
  });

  it("formats small amounts (< $100) with cents for precision", () => {
    expect(formatUsdCompact(11)).toBe("$11.00");
    expect(formatUsdCompact(50)).toBe("$50.00");
    expect(formatUsdCompact(99.99)).toBe("$99.99");
    expect(formatUsdCompact(0.5)).toBe("$0.50");
  });
});
