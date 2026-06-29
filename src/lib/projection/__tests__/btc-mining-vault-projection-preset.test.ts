import { describe, expect, it } from "vitest";

import {
  buildBtcMiningVaultProjectionPreset,
  BTC_MINING_VAULT_PRESET_DISPLAY_NOTES,
} from "../projection-input-preset";
import { formatTargetsSafely } from "@/lib/products/guards";
import { BTC_MINING_PERFORMANCE_VAULT } from "@/lib/products/btc-mining-performance-vault";

// Any prefilled ScenarioInputs business number would look like one of these.
// (The review/forbidden LISTS legitimately NAME these inputs — only the prepared
//  context + targets must be free of them.)
const BUSINESS_NUMBER_RE =
  /\b(btc_price_change_pct|hashprice|energy_cost_kwh|stable_apy_pct|vol_index)\b/i;

describe("buildBtcMiningVaultProjectionPreset — CONFIGURED context only", () => {
  it("does NOT prefill any ScenarioInputs business number", () => {
    const p = buildBtcMiningVaultProjectionPreset();
    // The PREPARED values (configured context + targets) carry no scenario-input
    // key as a filled value. (The review/forbidden lists deliberately name them.)
    const prepared = JSON.stringify({
      configuredContext: p.configuredContext,
      targets: p.targets,
    });
    expect(prepared).not.toMatch(BUSINESS_NUMBER_RE);
    // The forbidden-prefill list still enumerates the business numbers.
    for (const f of ["APY target", "Markup", "Borrow APR", "Hashprice", "Energy price"]) {
      expect(p.forbiddenPrefill).toContain(f);
    }
    // And the review-required list still holds the live/configured inputs.
    expect(p.reviewRequired).toContain("Hashprice (USD/TH/day)");
    expect(p.reviewRequired).toContain("Stable APY %");
    expect(p.reviewRequired).toContain("Volatility index");
  });

  it("labels every configured context range as CONFIGURED / not validated", () => {
    const p = buildBtcMiningVaultProjectionPreset();
    expect(p.configuredContext.length).toBeGreaterThan(0);
    for (const r of p.configuredContext) {
      expect(r.status).toBe("CONFIGURED");
      expect(r.validated).toBe(false);
      // Ranges are displayed as ranges or qualitative, never a bare single point.
      expect(r.display.length).toBeGreaterThan(0);
    }
    // Spot-check the documented ranges are present.
    const labels = p.configuredContext.map((r) => r.label);
    expect(labels).toContain("Target cycle duration");
    expect(labels).toContain("Mining allocation");
    expect(labels).toContain("Monthly distribution target (annualized)");
    expect(labels).toContain("Total performance target");
    expect(labels).toContain("Recovery extension");
    expect(labels).toContain("Machine productive life");
  });

  it("carries the duration / distribution / total / recovery / machine-life ranges", () => {
    const p = buildBtcMiningVaultProjectionPreset();
    const byLabel = Object.fromEntries(p.configuredContext.map((r) => [r.label, r.display]));
    expect(byLabel["Target cycle duration"]).toMatch(/24 months/);
    expect(byLabel["Mining allocation"]).toMatch(/30–40%/);
    expect(byLabel["Mining allocation"]).toMatch(/30% structural floor/);
    expect(byLabel["BTC holding / collateral allocation"]).toMatch(/40–55%/);
    expect(byLabel["Stable funding reserve allocation"]).toMatch(/10–15%/);
    expect(byLabel["Monthly distribution target (annualized)"]).toMatch(/8–12%/);
    expect(byLabel["Total performance target"]).toMatch(/20–24%/);
    expect(byLabel["Total performance target"]).toMatch(/inclusive of distributions/i);
    expect(byLabel["Recovery extension"]).toMatch(/6–12 months/);
    expect(byLabel["Machine productive life"]).toMatch(/~5 years/);
  });

  it("targets are the two SAFE strings, never summed", () => {
    const p = buildBtcMiningVaultProjectionPreset();
    const safe = formatTargetsSafely(BTC_MINING_PERFORMANCE_VAULT);
    expect(p.targets.distribution).toBe(safe.distribution);
    expect(p.targets.total).toBe(safe.total);
    expect(JSON.stringify(p.targets)).not.toMatch(/\d+\s*%\s*\+\s*\d+\s*%/);
  });

  it("includes the three mandatory honesty strings", () => {
    const p = buildBtcMiningVaultProjectionPreset();
    expect(p.displayNotes).toEqual(BTC_MINING_VAULT_PRESET_DISPLAY_NOTES);
    expect(p.displayNotes).toContain(
      "All figures are configured assumptions, not validated contractual terms.",
    );
    expect(p.displayNotes).toContain(
      "Monthly distribution target is included in total performance target.",
    );
    expect(p.displayNotes).toContain(
      "Distribution is coverage-gated and not guaranteed.",
    );
  });

  it("never runs a study and never creates a record", () => {
    const p = buildBtcMiningVaultProjectionPreset();
    expect(p.runsStudy).toBe(false);
    expect(p.createsRecord).toBe(false);
  });

  it("is pure/deterministic", () => {
    expect(buildBtcMiningVaultProjectionPreset()).toEqual(
      buildBtcMiningVaultProjectionPreset(),
    );
  });
});
