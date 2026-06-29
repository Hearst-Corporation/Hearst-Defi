import { describe, expect, it } from "vitest";

import {
  chooseStableFundingSource,
  type StableFundingInput,
} from "@/lib/products/stable-funding-engine";

/** A comfortable, low-stress base case; tests override only what they assert. */
function baseInput(over: Partial<StableFundingInput> = {}): StableFundingInput {
  return {
    powerObligation: 120_000,
    idleStableAboveRunway: 0,
    stableYieldRate: 0.09,
    borrowApr: 0.06,
    collateralRatio: 1.2,
    ltv: 0.45,
    liquidationBuffer: 0.3,
    volatilityIndex: 40,
    coverageRatio: 1.18,
    stableReserveRunway: 1_000_000,
    minRunway: 200_000,
    ...over,
  };
}

describe("chooseStableFundingSource", () => {
  it("borrows when borrowApr < stableYieldRate and collateral is safe (cheap-borrow case)", () => {
    const d = chooseStableFundingSource(
      baseInput({ borrowApr: 0.06, stableYieldRate: 0.09 }),
    );
    expect(d.source).toBe("BORROW_AGAINST_BTC");
    expect(d.distributionAllowed).toBe(true);
  });

  it("does NOT borrow when borrow APR is at/above the stable yield (inverted case)", () => {
    const d = chooseStableFundingSource(
      baseInput({ borrowApr: 0.06, stableYieldRate: 0.045 }),
    );
    expect(d.source).not.toBe("BORROW_AGAINST_BTC");
  });

  it("VETOES borrowing when LTV ≥ 0.58", () => {
    const d = chooseStableFundingSource(
      baseInput({ ltv: 0.58, borrowApr: 0.06, stableYieldRate: 0.2 }),
    );
    expect(d.source).not.toBe("BORROW_AGAINST_BTC");
  });

  it("VETOES borrowing when volatilityIndex > 90", () => {
    const d = chooseStableFundingSource(
      baseInput({ volatilityIndex: 93, borrowApr: 0.06, stableYieldRate: 0.2 }),
    );
    expect(d.source).not.toBe("BORROW_AGAINST_BTC");
  });

  it("coverage < 1.0 → distributionAllowed is false (do not pay)", () => {
    const d = chooseStableFundingSource(baseInput({ coverageRatio: 0.92 }));
    expect(d.distributionAllowed).toBe(false);
  });

  it("coverage < 0.8 → PAUSE_DISTRIBUTION (suspend)", () => {
    const d = chooseStableFundingSource(baseInput({ coverageRatio: 0.75 }));
    expect(d.source).toBe("PAUSE_DISTRIBUTION");
    expect(d.distributionAllowed).toBe(false);
  });

  it("the stable reserve is NOT always spent first — idle ABOVE runway is the cheapest slice", () => {
    // No idle above runway, cheap borrow off the table (apr ≥ yield): we spend
    // the stable YIELD, leaving principal deployed — we do NOT dump the reserve.
    const d = chooseStableFundingSource(
      baseInput({
        idleStableAboveRunway: 0,
        borrowApr: 0.06,
        stableYieldRate: 0.045,
      }),
    );
    expect(d.source).toBe("USE_STABLE_YIELD");
    // And when idle above runway exists, that idle slice (not the runway reserve) is used.
    const d2 = chooseStableFundingSource(
      baseInput({
        idleStableAboveRunway: 200_000,
        borrowApr: 0.06,
        stableYieldRate: 0.045,
      }),
    );
    expect(d2.source).toBe("USE_IDLE_STABLE");
  });

  it("SELL_BTC is only a last resort, never the default", () => {
    // Default comfortable case never sells BTC.
    expect(chooseStableFundingSource(baseInput()).source).not.toBe(
      "SELL_BTC_LAST_RESORT",
    );

    // Last-resort path: borrowing vetoed (collateral event), no idle, no stable
    // yield to spend, and the reserve cannot cover power without breaching the
    // runway floor → SELL_BTC_LAST_RESORT.
    const lastResort = chooseStableFundingSource(
      baseInput({
        ltv: 0.6, // borrow vetoed → collateral event
        volatilityIndex: 95,
        idleStableAboveRunway: 0,
        stableYieldRate: 0, // no stable overlay to spend/unwind
        powerObligation: 900_000,
        stableReserveRunway: 1_000_000,
        minRunway: 200_000, // 1,000,000 - 900,000 = 100,000 < 200,000 floor
        coverageRatio: 1.05,
      }),
    );
    expect(lastResort.source).toBe("SELL_BTC_LAST_RESORT");
  });

  it("under an LTV/vol veto with safe runway, protects collateral rather than selling by default", () => {
    const d = chooseStableFundingSource(
      baseInput({
        ltv: 0.6,
        volatilityIndex: 95,
        idleStableAboveRunway: 0,
        stableYieldRate: 0,
        powerObligation: 100_000,
        stableReserveRunway: 1_000_000,
        minRunway: 200_000, // plenty of headroom → no forced sale
        coverageRatio: 1.05,
      }),
    );
    // Either it unwinds BTC yield (runway allows) or protects collateral — but it
    // does NOT reflexively sell the core when the reserve can absorb the bill.
    expect(d.source).not.toBe("SELL_BTC_LAST_RESORT");
  });

  it("never pulls below minRunway — last-resort triggers exactly when reserve cannot cover power", () => {
    // reserve 1,000,000, floor 200,000 → only 800,000 usable. A 900,000 bill
    // cannot be funded from reserve without breaching the floor.
    const d = chooseStableFundingSource(
      baseInput({
        ltv: 0.6,
        volatilityIndex: 95,
        idleStableAboveRunway: 0,
        stableYieldRate: 0,
        powerObligation: 900_000,
        stableReserveRunway: 1_000_000,
        minRunway: 200_000,
        coverageRatio: 1.05,
      }),
    );
    expect(d.source).toBe("SELL_BTC_LAST_RESORT");
  });
});
