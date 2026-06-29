import { describe, expect, it } from "vitest";

import {
  runBtcProductConstructionDiagnostics,
  BTC_PRODUCT_CONSTRUCTION_DIAGNOSTIC_SUITE,
  makeSyntheticDraft,
} from "@/lib/admin/diagnostics/btc-product-construction-diagnostics";

describe("BTC product construction orchestration diagnostics", () => {
  const results = runBtcProductConstructionDiagnostics();

  it("every check belongs to the suite and is well-formed", () => {
    expect(results.length).toBeGreaterThanOrEqual(10);
    for (const r of results) {
      expect(r.suite).toBe(BTC_PRODUCT_CONSTRUCTION_DIAGNOSTIC_SUITE);
      expect(r.id).toBeTruthy();
      expect(r.severity).toBe("P0");
    }
  });

  it("ALL orchestration checks pass (no fail)", () => {
    const failed = results.filter((r) => r.status === "fail");
    expect(
      failed,
      `failed checks: ${failed.map((f) => `${f.id} — ${f.actual}`).join(" | ")}`,
    ).toHaveLength(0);
  });

  it("covers the full orchestration contract (ids present)", () => {
    const ids = new Set(results.map((r) => r.id));
    for (const id of [
      "render-order-deterministic",
      "performance-engines-gated",
      "allocation-gates-on-engines",
      "canonical-single-source",
      "raw-subfloor-rejected",
      "canonical-floor-30",
      "scenario-percent-format",
      "targets-never-summed",
      "product-name-btc-mining",
      "no-guaranteed-language",
      "read-only-no-effects",
    ]) {
      expect(ids.has(id), `missing check: ${id}`).toBe(true);
    }
  });

  it("the synthetic draft is read-only and names the BTC mining product", () => {
    const draft = makeSyntheticDraft();
    expect(draft.vault.label).toBe("BTC Mining Performance Vault");
    expect(draft.effects.deployed).toBe(false);
    expect(draft.effects.externalSend).toBe(false);
    expect(draft.canonicalAllocation?.mining).toBeGreaterThanOrEqual(30);
  });
});
