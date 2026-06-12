import { describe, expect, it } from "vitest";

import {
  allocationBps,
  bpsToPercent,
  toVaultAllocationFacts,
  toVaultKpiFacts,
  toVaultLegalFacts,
} from "@/lib/vaults/vault-detail-facts";

const PRODUCT_SOURCE = {
  apyLow: 9.4,
  apyHigh: 12.8,
  mgmtFeeBps: 200,
  perfFeeBps: 1000,
  softLockupDays: 60,
  capacityUsdc: 100_000_000,
  currentAumUsdc: 25_000_000,
  strategy: "mining_yield",
  spvJurisdiction: "cayman",
  shareClass: "A",
  regExemption: "regD_506c",
  minTicketUsdc: 250_000,
  targetMiningBps: 6000,
  targetBtcTacticalBps: 1500,
  targetUsdcBaseBps: 1500,
  targetStableReserveBps: 1000,
};

describe("vault-detail-facts", () => {
  it("maps VaultProduct-style APY fields to kpi facts", () => {
    const facts = toVaultKpiFacts(PRODUCT_SOURCE);
    expect(facts.apyLow).toBe(9.4);
    expect(facts.apyHigh).toBe(12.8);
    expect(facts.currentAumUsdc).toBe(25_000_000);
  });

  it("maps deployment bps fields to kpi facts", () => {
    const facts = toVaultKpiFacts({
      targetApyLowBps: 940,
      targetApyHighBps: 1280,
      mgmtFeeBps: 200,
      perfFeeBps: 1000,
      softLockupDays: 60,
      capacityUsdc: 50_000_000,
      aumUsdc: 1_000_000,
    });
    expect(facts.apyLow).toBe(9.4);
    expect(facts.apyHigh).toBe(12.8);
    expect(facts.currentAumUsdc).toBe(1_000_000);
  });

  it("normalises legal and allocation facts from the same source", () => {
    const legal = toVaultLegalFacts(PRODUCT_SOURCE);
    const allocation = toVaultAllocationFacts(PRODUCT_SOURCE);

    expect(legal.shareClass).toBe("A");
    expect(legal.regExemption).toBe("regD_506c");
    expect(allocationBps(allocation, "mining")).toBe(6000);
    expect(allocationBps(allocation, "btc_tactical")).toBe(1500);
    expect(bpsToPercent(allocationBps(allocation, "mining"), 0)).toBe("60");
  });
});
