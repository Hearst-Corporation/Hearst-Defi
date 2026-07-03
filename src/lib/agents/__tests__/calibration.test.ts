import { describe, it, expect } from "vitest";

import { calibratePersona } from "@/lib/agents/calibration";

describe("calibratePersona", () => {
  it("maps a wealth-platform averti tier-1 low-risk lead", () => {
    const p = calibratePersona({
      platformType: "wealth",
      aum: "250m_plus",
      fundsUsage: "earning",
      yieldStatus: "live",
      yieldType: "low_risk",
      vaultSize: "5m_plus",
      timeline: "asap",
    });

    expect(p.suggestedVault).toBe("defensive");
    expect(p.pedagogy).toBe("peer");
    expect(p.tier).toBe("tier1");
    // tier1 + asap → low verbosity
    expect(p.verbosity).toBe("low");
    expect(p.segments).toContain("wealth-platform");
    expect(p.customInstructions).toMatch(/Defensive/);
  });

  it("maps a crypto greenfield explorer growth lead", () => {
    const p = calibratePersona({
      platformType: "crypto",
      aum: "lt_10m",
      fundsUsage: "idle",
      yieldStatus: "not_yet",
      yieldType: "growth",
      vaultSize: "100_500k",
      timeline: "exploring",
    });

    expect(p.suggestedVault).toBe("btc-plus");
    expect(p.pedagogy).toBe("teach");
    expect(p.tier).toBe("explorer");
    // teaching → detailed + high verbosity
    expect(p.tone).toBe("detailed");
    expect(p.verbosity).toBe("high");
    // growth vault loads disclaimers — must stay forbidden-words clean
    expect(p.customInstructions).toMatch(/not guaranteed/);
  });

  it("is total: an empty profile yields a valid neutral persona", () => {
    const p = calibratePersona({});
    expect(p.suggestedVault).toBe("yield");
    expect(["fr", "en"]).toContain(p.language);
    expect(p.tone).toBeTruthy();
    expect(p.segments.length).toBe(3);
  });

  it("respects an explicit language override", () => {
    const p = calibratePersona({ platformType: "exchange", language: "en" });
    expect(p.language).toBe("en");
  });

  // -------------------------------------------------------------------------
  // 4-question /apply funnel (Investor Apply 4Q): the form now asks four
  // persona questions only — platformType ("Who are you?"), aum (capacity),
  // vaultSize ("Intended first allocation?"), and timeline (next step).
  // fundsUsage, yieldStatus AND yieldType are NO LONGER asked in the UI (all
  // still optional on the server / Typeform). Calibration must produce an
  // exploitable persona from this reduced set — these tests pin that it
  // degrades gracefully when the three retired questions are absent.
  // -------------------------------------------------------------------------

  it("produces an exploitable persona from the 4-question profile (high intent)", () => {
    const p = calibratePersona({
      platformType: "wealth",
      aum: "250m_plus",
      vaultSize: "5m_plus",
      timeline: "asap",
    });

    // Commercial tier is driven by aum + vaultSize → tier1 here.
    expect(p.tier).toBe("tier1");
    // Persona must remain usable: register, segments, vault, instructions.
    expect(["low", "medium", "high"]).toContain(p.verbosity);
    expect(p.segments).toContain("wealth-platform");
    // Vault suggestion still resolves (defaults to "yield" without yieldType).
    expect(p.suggestedVault).toBeTruthy();
    expect(p.customInstructions.length).toBeGreaterThan(0);
  });

  it("produces an exploitable persona from the 4-question profile (explorer)", () => {
    const p = calibratePersona({
      platformType: "crypto",
      aum: "lt_10m",
      vaultSize: "100_500k",
      timeline: "exploring",
    });

    expect(p.tier).toBe("explorer");
    expect(p.segments.length).toBe(3);
    expect(["fr", "en"]).toContain(p.language);
    // Without yieldType the growth-disclaimer block is not loaded; the persona
    // is still complete and on-brand (crypto-native register present).
    expect(p.customInstructions).toMatch(/Crypto-native/);
  });

  it("dropping the three retired questions still yields a stable tier", () => {
    const full = calibratePersona({
      platformType: "wealth",
      aum: "50_250m",
      fundsUsage: "mix",
      yieldStatus: "in_progress",
      yieldType: "balanced",
      vaultSize: "1_5m",
      timeline: "1_3m",
    });
    const reduced = calibratePersona({
      platformType: "wealth",
      aum: "50_250m",
      vaultSize: "1_5m",
      timeline: "1_3m",
    });

    // tier is a function of aum + vaultSize only → unchanged by the drop of
    // fundsUsage / yieldStatus / yieldType.
    expect(reduced.tier).toBe(full.tier);
    expect(reduced.segments).toContain("wealth-platform");
  });

  it("the reduced 4Q profile only loses pedagogy + vault differentiation", () => {
    // fundsUsage/yieldStatus drove pedagogy (peer/compare vs teach) and
    // yieldType drove the vault suggestion. Without them the persona is still
    // complete; both fall back to safe defaults rather than crashing or
    // producing an empty persona.
    const reduced = calibratePersona({
      platformType: "wealth",
      aum: "250m_plus",
      vaultSize: "5m_plus",
      timeline: "asap",
    });
    expect(reduced.pedagogy).toBe("teach");
    expect(reduced.suggestedVault).toBe("yield");
    expect(reduced.customInstructions.length).toBeGreaterThan(0);
  });
});
