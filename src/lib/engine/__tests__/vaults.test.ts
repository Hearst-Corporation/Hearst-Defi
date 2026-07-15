import { describe, expect, it } from "vitest";
import {
  getVaultDefinition,
  vaultAllocationWeights,
  VAULT_BTC_PLUS,
  VAULT_DEFENSIVE,
  VAULT_YIELD,
  VAULTS,
  type VaultDefinition,
} from "../vaults";
import type { VaultId } from "../types";
import { containsForbidden } from "@/lib/agents/forbidden-words";

const ALL: VaultDefinition[] = [VAULT_YIELD, VAULT_DEFENSIVE, VAULT_BTC_PLUS];

function allocationSum(v: VaultDefinition): number {
  const t = v.allocationTargets;
  return t.mining + t.btc_tactical + t.usdc_base + t.stable_reserve;
}

describe("vault presets", () => {
  it("registers the three presets under their ids", () => {
    expect(VAULTS.yield).toBe(VAULT_YIELD);
    expect(VAULTS.defensive).toBe(VAULT_DEFENSIVE);
    expect(VAULTS["btc-plus"]).toBe(VAULT_BTC_PLUS);
    expect(Object.keys(VAULTS)).toHaveLength(3);
  });

  it("expresses every APY target as a range with low < high", () => {
    for (const v of ALL) {
      expect(v.apyTarget.low).toBeLessThan(v.apyTarget.high);
      expect(v.apyTarget.low).toBeGreaterThanOrEqual(0);
    }
  });

  it("has allocation targets that sum to ~100%", () => {
    for (const v of ALL) {
      expect(allocationSum(v)).toBeCloseTo(100, 6);
    }
  });

  it("ships at least one share class per vault", () => {
    for (const v of ALL) {
      expect(v.shareClasses.length).toBeGreaterThan(0);
    }
  });

  it("keeps a methodology version on every vault", () => {
    for (const v of ALL) {
      expect(v.methodologyVersion).toMatch(/^v\d/);
    }
  });
});

describe("getVaultDefinition", () => {
  it("returns the matching preset", () => {
    expect(getVaultDefinition("yield")).toBe(VAULT_YIELD);
    expect(getVaultDefinition("defensive")).toBe(VAULT_DEFENSIVE);
    expect(getVaultDefinition("btc-plus")).toBe(VAULT_BTC_PLUS);
  });

  it("throws for an unknown id", () => {
    expect(() => getVaultDefinition("ghost" as VaultId)).toThrow(/unknown vault id/);
  });
});

describe("assumption sanity (ADR-006: no vault reuses another's numbers)", () => {
  it("Defensive targets a lower APY band than BTC Plus", () => {
    expect(VAULT_DEFENSIVE.apyTarget.low).toBeLessThan(VAULT_BTC_PLUS.apyTarget.low);
    expect(VAULT_DEFENSIVE.apyTarget.high).toBeLessThan(VAULT_BTC_PLUS.apyTarget.high);
  });

  it("Defensive holds mining in the 15-25% band; BTC Plus tilts to BTC tactical", () => {
    expect(VAULT_DEFENSIVE.allocationTargets.mining).toBeGreaterThanOrEqual(15);
    expect(VAULT_DEFENSIVE.allocationTargets.mining).toBeLessThanOrEqual(25);
    expect(VAULT_BTC_PLUS.allocationTargets.btc_tactical).toBeGreaterThan(
      VAULT_YIELD.allocationTargets.btc_tactical,
    );
  });

  it("Defensive carries more stable reserve than BTC Plus", () => {
    expect(VAULT_DEFENSIVE.allocationTargets.stable_reserve).toBeGreaterThan(
      VAULT_BTC_PLUS.allocationTargets.stable_reserve,
    );
  });
});

describe("vaultAllocationWeights", () => {
  it("converts a vault's targets into V2 weights summing to 1.0", () => {
    for (const v of ALL) {
      const w = vaultAllocationWeights(v);
      const sum = w.mining + w.btcTactical + w.usdcBase + w.stableReserve;
      expect(sum).toBeCloseTo(1, 9);
    }
  });

  it("defaults to the Yield Vault when called with no argument (retro-compat)", () => {
    expect(vaultAllocationWeights()).toEqual(vaultAllocationWeights(VAULT_YIELD));
  });

  it("maps the Yield 3-pocket target onto weights (mining .40 / btc .27 / usdc .33)", () => {
    const w = vaultAllocationWeights(VAULT_YIELD);
    expect(w.mining).toBeCloseTo(0.4, 9);
    expect(w.btcTactical).toBeCloseTo(0.27, 9);
    expect(w.usdcBase).toBeCloseTo(0.33, 9);
    expect(w.stableReserve).toBeCloseTo(0, 9);
  });
});

describe("VAULT_YIELD — v2 mining-note canon (PermissionedDynaVault v2.1)", () => {
  const yieldText = [VAULT_YIELD.description, ...VAULT_YIELD.assumptions]
    .join(" ")
    .toLowerCase();

  it("targets the 3-pocket allocation (mining 40 / BTC 27 / USDC 33), legacy stable sleeve retired", () => {
    expect(VAULT_YIELD.allocationTargets).toEqual({
      mining: 40,
      btc_tactical: 27,
      usdc_base: 33,
      stable_reserve: 0,
    });
    // Mirrors the v2.1 §Appendix on-chain pocket bps (4000 / 2700 / 3300).
    expect(VAULT_YIELD.allocationTargets.mining * 100).toBe(4_000);
    expect(VAULT_YIELD.allocationTargets.btc_tactical * 100).toBe(2_700);
    expect(VAULT_YIELD.allocationTargets.usdc_base * 100).toBe(3_300);
  });

  it("keeps the headline as a RANGE (#1), never a single point", () => {
    expect(VAULT_YIELD.apyTarget).toEqual({ low: 8, high: 15 });
    expect(VAULT_YIELD.apyTarget.low).toBeLessThan(VAULT_YIELD.apyTarget.high);
    expect(VAULT_YIELD.defaultProvenance).toBe("estimated");
  });

  it("bumps methodology to v3.0 with the product model change", () => {
    expect(VAULT_YIELD.methodologyVersion).toBe("v3.0");
  });

  it("carries the 24-month product term", () => {
    expect(VAULT_YIELD.productDurationMonths).toBe(24);
  });

  it("drops all periodic cash-distribution wording (no monthly USDC payout)", () => {
    expect(yieldText).not.toMatch(/monthly/);
    expect(yieldText).not.toContain("usdc distributions");
    expect(yieldText).toContain("no periodic cash distribution");
  });

  it("describes the v2 accumulation model (BTC accumulated, 24-month term, take-profit)", () => {
    expect(yieldText).toMatch(/accumulat/);
    expect(yieldText).toMatch(/24-month/);
    expect(yieldText).toMatch(/take-profit/);
  });

  it("stays compliant: no forbidden words, retains the 'not guaranteed' disclaimer", () => {
    expect(containsForbidden(VAULT_YIELD.description)).toBeNull();
    for (const a of VAULT_YIELD.assumptions) {
      expect(containsForbidden(a)).toBeNull();
    }
    expect(yieldText).toContain("not guaranteed");
  });
});
