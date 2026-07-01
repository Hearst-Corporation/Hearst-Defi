import { describe, it, expect } from "vitest";

import { parseObjectiveProfile } from "../objective-profile";
import { deriveObjectiveAssumptionOverrides } from "../objective-adjustments";

describe("parseObjectiveProfile — deterministic objective reading", () => {
  it("is pure: same input → identical output", () => {
    const a = parseObjectiveProfile("Frame a BTC mining vault");
    const b = parseObjectiveProfile("Frame a BTC mining vault");
    expect(a).toEqual(b);
  });

  it("null / empty → generic balanced default, confidence 0", () => {
    const p = parseObjectiveProfile(null);
    expect(p.productFamily).toBe("generic");
    expect(p.riskProfile).toBe("balanced");
    expect(p.incomePreference).toBe("mixed");
    expect(p.horizon).toBe("unknown");
    expect(p.confidence).toBe(0);
    expect(p.matchedSignals).toEqual([]);
  });

  it("'Frame a BTC mining vault' → mining / balanced / mixed", () => {
    const p = parseObjectiveProfile("Frame a BTC mining vault");
    expect(p.productFamily).toBe("mining");
    expect(p.riskProfile).toBe("balanced");
    expect(p.incomePreference).toBe("mixed");
    expect(p.matchedSignals).toContain("mining");
  });

  it("'Create a conservative monthly income product' → stable_income / conservative / monthly", () => {
    const p = parseObjectiveProfile("Create a conservative monthly income product");
    expect(p.riskProfile).toBe("conservative");
    expect(p.incomePreference).toBe("monthly_distribution");
    expect(p.capitalProtectionIntent).toBe("high");
    expect(p.matchedSignals).toContain("conservative");
    expect(p.matchedSignals).toContain("monthly income");
  });

  it("'High yield BTC upside product' → opportunistic / growth", () => {
    const p = parseObjectiveProfile("High yield BTC upside product");
    expect(p.riskProfile).toBe("opportunistic");
    expect(p.incomePreference).toBe("growth");
    expect(p.capitalProtectionIntent).toBe("low");
    // family is mining/btc_treasury/defi — "high yield" makes defi_yield or btc win;
    // either way it must NOT be generic.
    expect(p.productFamily).not.toBe("generic");
  });

  it("'Stable USDC income vault' → stable_income / monthly income", () => {
    const p = parseObjectiveProfile("Stable USDC income vault");
    expect(p.productFamily).toBe("stable_income");
    expect(p.incomePreference).toBe("monthly_distribution");
    expect(p.liquidityPreference).toBe("high");
  });

  it("'Mining performance product with 24 month target' → mining + 24m", () => {
    const p = parseObjectiveProfile("Mining performance product with 24 month target");
    expect(p.productFamily).toBe("mining");
    expect(p.horizon).toBe("24m");
    expect(p.matchedSignals).toContain("24-month horizon");
  });

  it("horizon parses 12m / 24m / 36m and year phrasings", () => {
    expect(parseObjectiveProfile("a 12 month vault").horizon).toBe("12m");
    expect(parseObjectiveProfile("a 2 year vault").horizon).toBe("24m");
    expect(parseObjectiveProfile("a 3-year horizon").horizon).toBe("36m");
  });

  it("confidence rises with more matched dimensions", () => {
    const weak = parseObjectiveProfile("a product");
    const strong = parseObjectiveProfile(
      "conservative mining monthly income 24 month vault",
    );
    expect(strong.confidence).toBeGreaterThan(weak.confidence);
    expect(strong.confidence).toBeLessThanOrEqual(1);
  });

  it("handles French accents (déterministe normalisation)", () => {
    const p = parseObjectiveProfile("produit prudent à revenu mensuel");
    expect(p.riskProfile).toBe("conservative");
    expect(p.incomePreference).toBe("monthly_distribution");
  });
});

describe("deriveObjectiveAssumptionOverrides — bounded, traced", () => {
  it("generic/balanced/unknown → empty overrides + zero tilt + no adjustments", () => {
    const r = deriveObjectiveAssumptionOverrides(parseObjectiveProfile("a product"));
    expect(r.overrides).toEqual({});
    expect(r.allocationTilt).toEqual({ stableReservePp: 0, btcHoldPp: 0 });
    expect(r.adjustments).toEqual([]);
  });

  it("named horizon → horizonMonths override + a trace", () => {
    const r = deriveObjectiveAssumptionOverrides(
      parseObjectiveProfile("mining vault 24 month target"),
    );
    expect(r.overrides.horizonMonths).toBe(24);
    expect(r.adjustments.some((a) => a.field === "assumptions.horizonMonths")).toBe(true);
  });

  it("conservative → lower vol + stable-reserve tilt up, BTC down, all traced", () => {
    const r = deriveObjectiveAssumptionOverrides(
      parseObjectiveProfile("conservative capital preservation vault"),
    );
    expect(r.overrides.btc?.annualVol).toBeLessThan(0.6);
    expect(r.allocationTilt.stableReservePp).toBeGreaterThan(0);
    expect(r.allocationTilt.btcHoldPp).toBeLessThan(0);
    expect(r.adjustments.every((a) => a.reason.length > 0)).toBe(true);
  });

  it("opportunistic → higher vol + BTC tilt up, stable down", () => {
    const r = deriveObjectiveAssumptionOverrides(
      parseObjectiveProfile("high yield opportunistic BTC upside"),
    );
    expect(r.overrides.btc?.annualVol).toBeGreaterThan(0.6);
    expect(r.allocationTilt.btcHoldPp).toBeGreaterThan(0);
    expect(r.allocationTilt.stableReservePp).toBeLessThan(0);
  });

  it("vol override stays within a small bounded band around the base", () => {
    for (const obj of [
      "conservative vault",
      "balanced vault",
      "opportunistic vault",
    ]) {
      const r = deriveObjectiveAssumptionOverrides(parseObjectiveProfile(obj));
      const vol = r.overrides.btc?.annualVol ?? 0.6;
      expect(vol).toBeGreaterThanOrEqual(0.5); // 0.6 * 0.9 = 0.54
      expect(vol).toBeLessThanOrEqual(0.75); // 0.6 * 1.15 = 0.69
    }
  });

  it("no adjustment ever promises a return (reasons are neutral)", () => {
    const r = deriveObjectiveAssumptionOverrides(
      parseObjectiveProfile("high yield conservative monthly 24 month"),
    );
    for (const a of r.adjustments) {
      expect(a.reason).not.toMatch(/guarantee|guaranteed|risk-free|will deliver/i);
    }
  });
});
