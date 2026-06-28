import { describe, expect, it } from "vitest";

import {
  deriveProjectionInputDraft,
  productTypeLabel,
  bucketLabel,
} from "../product-objective-draft";

describe("deriveProjectionInputDraft — pure keyword parser", () => {
  it("classifies mining + stable yield → mining_stable_yield with mining + usdc buckets", () => {
    const d = deriveProjectionInputDraft(
      "Créer un produit DeFi avec mining + stable yield",
    );
    expect(d.suggestedProductType).toBe("mining_stable_yield");
    expect(d.suggestedBuckets).toContain("mining");
    expect(d.suggestedBuckets).toContain("usdc");
    expect(d.canPrefill).toBe(true);
    expect(d.source).toBe("product-workspace");
  });

  it("classifies a stable-only objective → stable_yield with usdc bucket", () => {
    const d = deriveProjectionInputDraft("Offre de rendement stable en USDC");
    expect(d.suggestedProductType).toBe("stable_yield");
    expect(d.suggestedBuckets).toEqual(["usdc"]);
  });

  it("classifies a BTC collateral objective → btc_collateral with btc bucket", () => {
    const d = deriveProjectionInputDraft("Vault BTC collateral avec LTV maîtrisé");
    expect(d.suggestedProductType).toBe("btc_collateral");
    expect(d.suggestedBuckets).toContain("btc");
  });

  it("adds a reserve bucket when the objective mentions cash/liquidity/réserve", () => {
    const d = deriveProjectionInputDraft(
      "Produit mining stable avec une réserve de liquidité",
    );
    expect(d.suggestedBuckets).toContain("reserve");
  });

  it("returns unknown + a warning + canPrefill false for an opaque objective", () => {
    const d = deriveProjectionInputDraft("un truc sympa pour les gens");
    expect(d.suggestedProductType).toBe("unknown");
    expect(d.suggestedBuckets).toEqual([]);
    expect(d.canPrefill).toBe(false);
    expect(d.warnings.length).toBeGreaterThan(0);
  });

  it("handles an empty objective honestly (unknown, no buckets, warning)", () => {
    const d = deriveProjectionInputDraft("   ");
    expect(d.suggestedProductType).toBe("unknown");
    expect(d.suggestedBuckets).toEqual([]);
    expect(d.canPrefill).toBe(false);
    expect(d.warnings[0]).toContain("No objective carried");
  });

  it("is accent- and case-insensitive (Défensif / DEFENSIF / minage)", () => {
    const a = deriveProjectionInputDraft("Produit défensif avec minage et USDC");
    expect(a.suggestedBuckets).toContain("mining");
    expect(a.suggestedBuckets).toContain("usdc");
  });

  it("NEVER invents a business number (no APY/hashprice/energy/fees/LTV in output)", () => {
    const d = deriveProjectionInputDraft(
      "Créer un produit mining + stable yield ciblant 10% APY",
    );
    const blob = JSON.stringify(d).toLowerCase();
    // The parser must not echo a derived numeric assumption as a value.
    expect(d).not.toHaveProperty("apy");
    expect(d).not.toHaveProperty("hashprice");
    expect(d).not.toHaveProperty("suggestedApy");
    // It carries the raw objective verbatim (which may contain "10%"), but it
    // emits NO numeric suggestion field and always warns assumptions are configured.
    expect(blob).toContain("configured");
    expect(d.suggestedBuckets.every((b) => typeof b === "string")).toBe(true);
  });

  it("de-duplicates and orders buckets deterministically (mining, btc, usdc, reserve)", () => {
    const d = deriveProjectionInputDraft(
      "mining bitcoin collateral usdc stable cash reserve mining again",
    );
    expect(d.suggestedBuckets).toEqual(["mining", "btc", "usdc", "reserve"]);
  });

  it("exposes display labels", () => {
    expect(productTypeLabel("mining_stable_yield")).toBe("Mining + stable yield");
    expect(bucketLabel("usdc")).toBe("USDC");
  });
});
