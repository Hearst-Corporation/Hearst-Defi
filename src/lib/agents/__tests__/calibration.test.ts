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
    expect(p.customInstructions).toMatch(/non garanti/);
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
});
