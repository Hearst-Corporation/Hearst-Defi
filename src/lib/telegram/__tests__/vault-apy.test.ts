import { describe, it, expect } from "vitest";

import { composeVaultApy, type VaultApyInputs } from "../vault-apy";

const BASE: VaultApyInputs = {
  miningYieldPct: 8,
  usdcYieldPct: 5,
  btcReturn: { bear: -20, base: 40, bull: 120 },
  borrowAprPct: 6,
  avgLtv: 0.5,
  feesPct: 2,
};

describe("composeVaultApy", () => {
  it("returns a RANGE (low < high), never a single point", () => {
    const r = composeVaultApy(BASE);
    expect(r.apyLow).toBeLessThan(r.apyHigh);
  });

  it("allocation sums to ~100", () => {
    const r = composeVaultApy(BASE);
    const { miningPct, btcPct, usdcPct } = r.allocation;
    expect(miningPct + btcPct + usdcPct).toBeCloseTo(100, 1);
  });

  it("subtracts borrow drag (higher borrow APR → lower APY both ends)", () => {
    const cheap = composeVaultApy({ ...BASE, borrowAprPct: 2 });
    const dear = composeVaultApy({ ...BASE, borrowAprPct: 12 });
    expect(dear.apyLow).toBeLessThan(cheap.apyLow);
    expect(dear.apyHigh).toBeLessThan(cheap.apyHigh);
  });

  it("wider BTC scenario band widens the APY range", () => {
    const narrow = composeVaultApy({ ...BASE, btcReturn: { bear: 10, base: 40, bull: 70 } });
    const wide = composeVaultApy({ ...BASE, btcReturn: { bear: -50, base: 40, bull: 200 } });
    expect(wide.apyHigh - wide.apyLow).toBeGreaterThan(narrow.apyHigh - narrow.apyLow);
  });

  it("Defensive bounds cap BTC weight → tighter range", () => {
    const defensive = composeVaultApy({
      ...BASE,
      bounds: { btc: [0, 15], usdc: [35, 100] },
    });
    expect(defensive.allocation.btcPct).toBeLessThanOrEqual(15.5);
    expect(defensive.allocation.usdcPct).toBeGreaterThanOrEqual(34.5);
  });

  it("emits assumptions + a not-guaranteed disclaimer (non-negotiable #1/#10)", () => {
    const r = composeVaultApy(BASE);
    expect(r.assumptions.length).toBeGreaterThanOrEqual(3);
    expect(r.disclaimer.toLowerCase()).toContain("not guaranteed");
  });

  it("borrow drag scales with BTC weight (zero BTC → zero drag)", () => {
    // Force BTC weight to 0 via bounds.
    const noBtc = composeVaultApy({ ...BASE, bounds: { btc: [0, 0] } });
    expect(noBtc.allocation.btcPct).toBe(0);
    expect(noBtc.borrowDragPct).toBe(0);
  });
});
