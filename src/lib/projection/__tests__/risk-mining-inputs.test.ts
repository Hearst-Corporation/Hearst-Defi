import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

import { computeRiskScore, computeRiskBreakdown } from "@/lib/engine/risk";
import { computeMiningRevenue } from "@/lib/engine/mining";
import {
  buildRiskReferences,
  DEFAULT_RISK_REFERENCES,
} from "../risk-references";
import {
  miningCostsFromCostModel,
  DEFAULT_MINING_COSTS,
} from "../mining-cost-assumptions";
import type { ScenarioInputs } from "@/lib/engine/types";

const INPUTS: ScenarioInputs = {
  btc_price_change_pct: 0,
  hashprice_usd_th_day: 0.07,
  energy_cost_kwh: 0.05,
  stable_apy_pct: 4,
  vol_index: 45,
};

const RISK_SRC = readFileSync(new URL("../../engine/risk.ts", import.meta.url), "utf8");
const MINING_SRC = readFileSync(new URL("../../engine/mining.ts", import.meta.url), "utf8");

// ─── RISK ────────────────────────────────────────────────────────────────────

describe("Risk — injected references", () => {
  it("Test 1: computeRiskScore uses injected refs when present", () => {
    const def = computeRiskScore(INPUTS);
    const injected = computeRiskScore(INPUTS, { hashpriceUsdPerThDay: 0.2 });
    expect(injected).not.toBe(def); // a different reference moves the score
  });

  it("Test 2: keeps explicit fallback (defaults) when refs absent", () => {
    const a = computeRiskScore(INPUTS);
    const b = computeRiskScore(INPUTS, {
      hashpriceUsdPerThDay: DEFAULT_RISK_REFERENCES.hashpriceUsdPerThDay,
      energyUsdPerKwh: DEFAULT_RISK_REFERENCES.energyUsdPerKwh,
      stableApyPct: DEFAULT_RISK_REFERENCES.stableApyPct,
    });
    expect(a).toBe(b); // omitting == passing the documented defaults
  });

  it("Test 3: provenance metadata flags fallback vs live, never disguised", () => {
    const refs = buildRiskReferences({
      hashpriceUsdPerThDay: 0.09,
      hashpriceLive: true,
      // energy/stable omitted → fallback
    });
    expect(refs.metadata?.hashpriceSource).toBe("LIVE");
    expect(refs.metadata?.energySource).toBe("FALLBACK");
    expect(refs.metadata?.stableYieldSource).toBe("FALLBACK");
  });

  it("Test 4: smart-contract/counterparty stay non-REAL (CONFIGURED) by default", () => {
    const refs = buildRiskReferences({ hashpriceUsdPerThDay: 0.09, hashpriceLive: true });
    expect(refs.metadata?.riskBaselineSource).toBe("CONFIGURED");
    expect(refs.metadata?.riskBaselineSource).not.toBe("AUDITED");
  });

  it("Test 5: smart_contract/counterparty dims stay baseline unless explicitly injected", () => {
    const b = computeRiskBreakdown(INPUTS);
    // default baselines present (pre-audit), not zeroed/live
    expect(b.smart_contract).toBeGreaterThan(0);
    expect(b.counterparty).toBeGreaterThan(0);
    // injecting an audited score changes it (proves override path exists)
    const audited = computeRiskBreakdown(INPUTS, { smartContractRiskScore: 20 });
    expect(audited.smart_contract).toBe(20);
  });
});

// ─── MINING ──────────────────────────────────────────────────────────────────

describe("Mining — injected cost model", () => {
  it("Test 6: computeMiningRevenue uses injected cost inputs", () => {
    const def = computeMiningRevenue(INPUTS);
    const injected = computeMiningRevenue(INPUTS, { efficiencyKwhPerThDay: 0.05 });
    expect(injected.net_margin_usd_th_day).not.toBe(def.net_margin_usd_th_day);
  });

  it("Test 7: fallback mining costs expose a source/reason", () => {
    expect(DEFAULT_MINING_COSTS.source).toBe("CONFIGURED");
    const fromModel = miningCostsFromCostModel({
      energyUsdPerThDay: 0.024,
      energyUsdPerKwh: 0.06,
    });
    expect(fromModel.source).toBe("TELEGRAM_COST_MODEL");
  });

  it("Test 8: old defaults are no longer silent (no bare const in mining.ts)", () => {
    expect(MINING_SRC).not.toMatch(/const REFERENCE_EFFICIENCY_KWH_PER_TH_DAY = 0\.1/);
    expect(MINING_SRC).toContain("DEFAULT_MINING_COSTS");
  });

  it("Test 9: cost-model can feed mining without engine fetch (pure shaping)", () => {
    const costs = miningCostsFromCostModel({
      energyUsdPerThDay: 0.024, // ~16 J/TH machine energy at 6¢
      energyUsdPerKwh: 0.06,
    });
    const r = computeMiningRevenue(INPUTS, costs);
    expect(Number.isFinite(r.net_margin_usd_th_day)).toBe(true);
    // implied efficiency = 0.024/0.06 = 0.4 kWh/TH/day
    expect(costs.efficiencyKwhPerThDay).toBeCloseTo(0.4, 6);
  });

  it("Test 10: deterministic output unchanged when omitting costs (no regression)", () => {
    const a = computeMiningRevenue(INPUTS);
    const b = computeMiningRevenue(INPUTS, {
      efficiencyKwhPerThDay: DEFAULT_MINING_COSTS.efficiencyKwhPerThDay,
      hostingUsdPerThDay: DEFAULT_MINING_COSTS.hostingUsdPerThDay,
      targetNetMarginUsdPerThDay: DEFAULT_MINING_COSTS.targetNetMarginUsdPerThDay,
      uptimePct: DEFAULT_MINING_COSTS.uptimePct,
    });
    expect(a).toEqual(b);
  });

  it("risk.ts no longer hardcodes the bare 0.085 baseline silently", () => {
    expect(RISK_SRC).toContain("DEFAULT_RISK_REFERENCES");
  });
});
