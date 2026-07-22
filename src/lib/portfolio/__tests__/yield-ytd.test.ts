import { describe, expect, it } from "vitest";

import {
  buildYtdPayoutBreakdown,
  computeYtdRealizedUsdc,
} from "@/lib/portfolio/yield-ytd";

// These tests used to assert the merge (`4_000 + 1_500 + 2_000 → 7_500`): a
// single number combining dollars that actually left the vault with
// `Position.accruedYieldUsdc`, a column nothing computes. The assertions below
// are the same arithmetic pinned harder — realized is exact, and the accrued
// leg can no longer reach it.

describe("computeYtdRealizedUsdc", () => {
  it("sums only the ledger payout rows", () => {
    expect(computeYtdRealizedUsdc([{ amountUsdc: 4_000 }, { amountUsdc: 1_500 }])).toBe(5_500);
  });

  it("returns a real 0 when no payout happened", () => {
    // 0 here is a measurement — "we read the ledger and nothing was paid" —
    // which is exactly what a caller may render as $0.00.
    expect(computeYtdRealizedUsdc([])).toBe(0);
  });

  it("skips a corrupt row instead of counting it as a zero payout", () => {
    expect(
      computeYtdRealizedUsdc([
        { amountUsdc: 1_000 },
        { amountUsdc: Number.NaN },
        { amountUsdc: 250 },
      ]),
    ).toBe(1_250);
  });
});

describe("buildYtdPayoutBreakdown", () => {
  it("keeps realized payouts and accrual in separate fields", () => {
    const breakdown = buildYtdPayoutBreakdown(
      [{ amountUsdc: 4_000 }, { amountUsdc: 1_500 }],
      2_000,
      { productAccrues: true },
    );
    expect(breakdown.realizedUsdc).toBe(5_500);
    expect(breakdown.accruedUsdc).toBe(2_000);
    // The regression that mattered: the two must never be added together.
    expect(breakdown.realizedUsdc).not.toBe(7_500);
  });

  it("reports accrued as null for a product that does not accrue (Series 1)", () => {
    const breakdown = buildYtdPayoutBreakdown([{ amountUsdc: 1_000 }], 250, {
      productAccrues: false,
    });
    expect(breakdown.realizedUsdc).toBe(1_000);
    // null, not 0: nothing is calculated, which is not "we measured nil".
    expect(breakdown.accruedUsdc).toBeNull();
  });

  it("reports accrued as null when the value is absent or unusable", () => {
    expect(
      buildYtdPayoutBreakdown([], null, { productAccrues: true }).accruedUsdc,
    ).toBeNull();
    expect(
      buildYtdPayoutBreakdown([], Number.NaN, { productAccrues: true }).accruedUsdc,
    ).toBeNull();
  });

  it("does not let an accrued value inflate realized payouts", () => {
    const breakdown = buildYtdPayoutBreakdown([], 9_999, { productAccrues: true });
    expect(breakdown.realizedUsdc).toBe(0);
    expect(breakdown.accruedUsdc).toBe(9_999);
  });
});
