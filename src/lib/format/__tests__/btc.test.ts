import { describe, expect, it } from "vitest";

import {
  btcToSats,
  btcToUsd,
  formatBtc,
  formatBtcCompact,
  formatHashprice,
  formatHashrate,
  formatSats,
  satsToBtc,
  usdToBtc,
} from "@/lib/format/btc";

describe("formatBtc", () => {
  it("uses 2dp for amounts >= 100 (trailing zeros trimmed)", () => {
    expect(formatBtc(1234.5678)).toBe("1,234.57");
    expect(formatBtc(100)).toBe("100");
    expect(formatBtc(100.5)).toBe("100.5");
  });

  it("uses 4dp for amounts in [1, 100)", () => {
    expect(formatBtc(12.3456789)).toBe("12.3457");
    expect(formatBtc(1)).toBe("1");
  });

  it("uses up to 8dp for amounts < 1, trailing zeros trimmed", () => {
    expect(formatBtc(0.31)).toBe("0.31");
    expect(formatBtc(0.31000000)).toBe("0.31");
    expect(formatBtc(0.00000001)).toBe("0.00000001");
    expect(formatBtc(0.5)).toBe("0.5");
  });

  it("respects a maxDp override as a ceiling", () => {
    expect(formatBtc(0.123456789, { maxDp: 2 })).toBe("0.12");
    // maxDp above the natural ceiling for the magnitude has no effect.
    expect(formatBtc(1234.5678, { maxDp: 8 })).toBe("1,234.57");
  });

  it("appends the unit suffix when requested", () => {
    expect(formatBtc(0.31, { unit: true })).toBe("0.31 BTC");
    expect(formatBtc(12.3456789, { unit: true })).toBe("12.3457 BTC");
  });

  it("returns the em-dash for non-finite input", () => {
    expect(formatBtc(NaN)).toBe("—");
    expect(formatBtc(Infinity)).toBe("—");
    expect(formatBtc(-Infinity)).toBe("—");
  });

  it("never prints -0", () => {
    expect(formatBtc(-0)).toBe("0");
  });
});

describe("formatBtcCompact", () => {
  it("thousands-groups at 2dp for amounts >= 1000", () => {
    expect(formatBtcCompact(12480)).toBe("12,480.00");
    expect(formatBtcCompact(1000)).toBe("1,000.00");
  });

  it("falls back to adaptive precision below 1000", () => {
    expect(formatBtcCompact(999.9999)).toBe("1,000");
    expect(formatBtcCompact(12.3456789)).toBe("12.3457");
    expect(formatBtcCompact(0.31)).toBe("0.31");
  });

  it("returns the em-dash for non-finite input", () => {
    expect(formatBtcCompact(NaN)).toBe("—");
    expect(formatBtcCompact(Infinity)).toBe("—");
  });
});

describe("formatSats", () => {
  it("rounds to the nearest integer", () => {
    expect(formatSats(1234.6)).toBe("1,235");
    expect(formatSats(1234.4)).toBe("1,234");
  });

  it("thousands-groups the result", () => {
    expect(formatSats(100_000_000)).toBe("100,000,000");
  });

  it("appends the unit suffix when requested", () => {
    expect(formatSats(1500, { unit: true })).toBe("1,500 sats");
  });

  it("returns the em-dash (with unit suffix if requested) for non-finite input", () => {
    expect(formatSats(NaN)).toBe("—");
    expect(formatSats(NaN, { unit: true })).toBe("— sats");
  });
});

describe("btcToSats / satsToBtc round-trip", () => {
  it("round-trips a typical BTC amount", () => {
    const btc = 0.31;
    const sats = btcToSats(btc);
    expect(sats).toBe(31_000_000);
    expect(satsToBtc(sats)).toBeCloseTo(btc, 8);
  });

  it("round-trips a large BTC amount", () => {
    const btc = 12_480.12345678;
    const sats = btcToSats(btc);
    expect(satsToBtc(sats)).toBeCloseTo(btc, 6);
  });

  it("guards non-finite input to 0", () => {
    expect(btcToSats(NaN)).toBe(0);
    expect(satsToBtc(Infinity)).toBe(0);
  });
});

describe("formatHashrate", () => {
  it("scales TH/s into PH/s at the exact boundary case", () => {
    expect(formatHashrate(13_000)).toBe("13.0 PH/s");
  });

  it("keeps sub-1000 values in TH/s", () => {
    expect(formatHashrate(500)).toBe("500.0 TH/s");
  });

  it("scales into EH/s for very large values", () => {
    expect(formatHashrate(1_000_000)).toBe("1.00 EH/s");
  });

  it("handles zero and negative/non-finite input", () => {
    expect(formatHashrate(0)).toBe("0 TH/s");
    expect(formatHashrate(-5)).toBe("—");
    expect(formatHashrate(NaN)).toBe("—");
  });
});

describe("formatHashprice", () => {
  it("formats a normal value to 3dp with the canonical unit", () => {
    expect(formatHashprice(0.055)).toBe("$0.055/TH·d");
  });

  it("returns Unavailable for zero or negative input", () => {
    expect(formatHashprice(0)).toBe("Unavailable");
    expect(formatHashprice(-0.01)).toBe("Unavailable");
  });

  it("returns Unavailable for non-finite input", () => {
    expect(formatHashprice(NaN)).toBe("Unavailable");
    expect(formatHashprice(Infinity)).toBe("Unavailable");
  });
});

describe("usdToBtc / btcToUsd", () => {
  it("converts both directions at a positive rate", () => {
    expect(usdToBtc(65_000, 65_000)).toBeCloseTo(1, 8);
    expect(btcToUsd(1, 65_000)).toBeCloseTo(65_000, 8);
  });

  it("guards btcUsd <= 0 to 0, never NaN", () => {
    expect(usdToBtc(100, 0)).toBe(0);
    expect(usdToBtc(100, -1)).toBe(0);
    expect(btcToUsd(1, 0)).toBe(0);
    expect(btcToUsd(1, -1)).toBe(0);
  });

  it("guards non-finite input to 0", () => {
    expect(usdToBtc(NaN, 65_000)).toBe(0);
    expect(btcToUsd(1, NaN)).toBe(0);
  });
});
