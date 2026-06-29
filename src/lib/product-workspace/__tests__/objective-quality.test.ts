import { describe, expect, it } from "vitest";

import { analyzeObjectiveQuality } from "@/lib/product-workspace/objective-quality";

describe("analyzeObjectiveQuality — too-vague detection", () => {
  it('"Je veux créer un produit." is too vague (all 5 inputs missing)', () => {
    const q = analyzeObjectiveQuality("Je veux créer un produit.");
    expect(q.tooVague).toBe(true);
    expect(q.present).toEqual([]);
    expect(q.missing).toHaveLength(5);
  });

  it('"Crée un draft de vault." is too vague', () => {
    expect(analyzeObjectiveQuality("Crée un draft de vault.").tooVague).toBe(
      true,
    );
  });

  it("an empty / null objective is too vague with everything missing", () => {
    expect(analyzeObjectiveQuality(null).tooVague).toBe(true);
    expect(analyzeObjectiveQuality("").missing).toHaveLength(5);
  });

  it("a specific BTC/yield/downside objective is NOT too vague", () => {
    const q = analyzeObjectiveQuality(
      "Je veux créer un produit de rendement BTC avec protection downside.",
    );
    expect(q.tooVague).toBe(false);
    expect(q.present).toContain("asset_or_strategy"); // BTC
    expect(q.present).toContain("yield_source"); // rendement
    expect(q.present).toContain("risk_profile"); // downside
  });

  it("a fully-specified objective covers all five dimensions", () => {
    const q = analyzeObjectiveQuality(
      "BTC yield product for institutions, 60-day lock-up, downside protection from mining funding",
    );
    expect(q.tooVague).toBe(false);
    expect(q.missing).toEqual([]);
  });
});
