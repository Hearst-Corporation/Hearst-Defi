import { describe, expect, it } from "vitest";

import {
  buildBtcMiningVaultBrief,
  buildBtcMiningVaultBriefIfMatched,
  matchesBtcMiningVaultObjective,
  BTC_MINING_VAULT_BRIEF_WARNINGS,
} from "../btc-mining-vault-preset";
import { BTC_MINING_PERFORMANCE_VAULT } from "@/lib/products/btc-mining-performance-vault";
import { formatTargetsSafely } from "@/lib/products/guards";
import { containsForbidden } from "@/lib/agents/forbidden-words";

describe("buildBtcMiningVaultBrief — structured fallback (no spinner)", () => {
  it("returns a structured brief with name, category, thesis, objective", () => {
    const b = buildBtcMiningVaultBrief();
    expect(b.productId).toBe("btc-mining-performance-vault");
    expect(b.name).toBe(BTC_MINING_PERFORMANCE_VAULT.name);
    expect(b.category).toBe("Mining-first BTC performance cycle");
    expect(b.thesis).toBe(BTC_MINING_PERFORMANCE_VAULT.thesis);
    expect(b.objective.length).toBeGreaterThan(0);
    expect(b.status).toBe("configured, not validated");
  });

  it("carries the four documented allocation bands as ranges", () => {
    const b = buildBtcMiningVaultBrief();
    const bySleeve = Object.fromEntries(b.allocationBands.map((x) => [x.sleeve, x]));
    expect(bySleeve.mining).toMatchObject({ minPct: 30, maxPct: 40, floorPct: 30 });
    expect(bySleeve.btc).toMatchObject({ minPct: 40, maxPct: 55 });
    expect(bySleeve.stable).toMatchObject({ minPct: 10, maxPct: 15 });
    expect(bySleeve.overlay).toMatchObject({ minPct: 0, maxPct: 10 });
  });

  it("targets are the two SAFE strings and are NEVER summed", () => {
    const b = buildBtcMiningVaultBrief();
    const safe = formatTargetsSafely(BTC_MINING_PERFORMANCE_VAULT);
    expect(b.targets.distribution).toBe(safe.distribution);
    expect(b.targets.total).toBe(safe.total);
    // No summed headline like "8–12% + 20–24%" anywhere.
    const blob = JSON.stringify(b.targets);
    expect(blob).not.toMatch(/\d+\s*%\s*\+\s*\d+\s*%/);
    expect(b.targets.total).toMatch(/inclusive of distributions/i);
  });

  it("warns with the four hard rules", () => {
    const b = buildBtcMiningVaultBrief();
    expect(b.warnings).toEqual(BTC_MINING_VAULT_BRIEF_WARNINGS);
    expect(b.warnings).toEqual([
      "no guarantee",
      "no double count",
      "mining floor guard",
      "recovery not a guarantee",
    ]);
  });

  it("carries no forbidden word in any human-facing string", () => {
    const b = buildBtcMiningVaultBrief();
    const strings = [
      b.thesis,
      b.objective,
      b.targets.distribution,
      b.targets.total,
      b.recovery.note,
      ...b.allocationBands.map((x) => x.note),
    ];
    for (const s of strings) {
      expect(containsForbidden(s), s).toBeNull();
    }
  });

  it("is pure/deterministic", () => {
    expect(buildBtcMiningVaultBrief()).toEqual(buildBtcMiningVaultBrief());
  });
});

describe("matchesBtcMiningVaultObjective — deterministic matcher", () => {
  it("matches the documented anchor phrases", () => {
    expect(matchesBtcMiningVaultObjective("BTC mining performance vault")).toBe(true);
    expect(matchesBtcMiningVaultObjective("Je veux un produit mining BTC")).toBe(true);
    expect(matchesBtcMiningVaultObjective("vault mining")).toBe(true);
    expect(matchesBtcMiningVaultObjective("distribution 8–12% mensuel")).toBe(true);
    expect(matchesBtcMiningVaultObjective("allocation 30–40% mining")).toBe(true);
    expect(matchesBtcMiningVaultObjective("mining-first commercially")).toBe(true);
  });

  it("matches with ASCII dashes and missing accents", () => {
    expect(matchesBtcMiningVaultObjective("8-12% mensuel")).toBe(true);
    expect(matchesBtcMiningVaultObjective("produit miniere BTC")).toBe(false); // no anchor
    expect(matchesBtcMiningVaultObjective("vault  mining")).toBe(true);
  });

  it("does not match an unrelated objective", () => {
    expect(matchesBtcMiningVaultObjective("a defensive USDC stable yield vault")).toBe(false);
    expect(matchesBtcMiningVaultObjective("")).toBe(false);
    expect(matchesBtcMiningVaultObjective("   ")).toBe(false);
  });
});

describe("buildBtcMiningVaultBriefIfMatched — content-bearing fallback", () => {
  it("returns the brief when the objective matches", () => {
    const b = buildBtcMiningVaultBriefIfMatched("BTC mining performance vault");
    expect(b).not.toBeNull();
    expect(b?.productId).toBe("btc-mining-performance-vault");
  });

  it("returns null when the objective does not match (no fake content)", () => {
    expect(buildBtcMiningVaultBriefIfMatched("random stable yield idea")).toBeNull();
  });
});
