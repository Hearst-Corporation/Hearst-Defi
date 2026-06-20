import { describe, expect, it } from "vitest";

import { computeYtdYieldUsdc } from "@/lib/portfolio/yield-ytd";

describe("computeYtdYieldUsdc", () => {
  it("sums YTD payouts and pending accrued", () => {
    expect(
      computeYtdYieldUsdc(
        [{ amountUsdc: 4_000 }, { amountUsdc: 1_500 }],
        2_000,
      ),
    ).toBe(7_500);
  });

  it("treats accrued as undistributed only (no duplicate payout rows in accrued)", () => {
    // After atomic-exec: distribution 1_000 paid → in ytd txs; accrued reset excludes it.
    const ytdPaid = [{ amountUsdc: 1_000 }];
    const accruedAfterPayout = 250;
    expect(computeYtdYieldUsdc(ytdPaid, accruedAfterPayout)).toBe(1_250);
  });

  it("clamps negative accrued to zero contribution", () => {
    expect(computeYtdYieldUsdc([], -100)).toBe(0);
  });
});
