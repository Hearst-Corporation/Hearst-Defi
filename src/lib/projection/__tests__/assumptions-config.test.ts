import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

import {
  getDefaultProjectionAssumptionsConfig,
  getProjectionAssumptionsConfig,
  mergeProjectionAssumptionsOverrides,
  toRiskReferenceInputs,
  toMiningCostInputs,
} from "../assumptions-config";
import { computeRiskScore } from "@/lib/engine/risk";
import { computeMiningRevenue } from "@/lib/engine/mining";
import type { ScenarioInputs } from "@/lib/engine/types";

const INPUTS: ScenarioInputs = {
  btc_price_change_pct: 0,
  hashprice_usd_th_day: 0.07,
  energy_cost_kwh: 0.05,
  stable_apy_pct: 4,
  vol_index: 45,
};

const READ_VAULT_APY_SRC = readFileSync(
  new URL("../../telegram/read-vault-apy.ts", import.meta.url),
  "utf8",
);

describe("default config — status & provenance", () => {
  const cfg = getDefaultProjectionAssumptionsConfig();

  it("Test 1: company assumptions stay CONFIGURED", () => {
    expect(cfg.status).toBe("CONFIGURED");
    expect(cfg.company.metadata.status).toBe("CONFIGURED");
  });

  it("Test 2: risk assumptions carry pre-audit baselines (CONFIGURED)", () => {
    expect(cfg.risk.smartContractBaseline).toBeGreaterThan(0);
    expect(cfg.risk.counterpartyBaseline).toBeGreaterThan(0);
    expect(cfg.status).not.toBe("AUDITED");
  });

  it("Test 3: mining assumptions are the configured defaults", () => {
    expect(cfg.mining.efficiencyKwhPerThDay).toBe(0.1);
    expect(cfg.mining.uptimePct).toBe(0.98);
  });

  it("Test 6: metadata source = CODE_DEFAULT by default", () => {
    expect(cfg.metadata.source).toBe("CODE_DEFAULT");
    expect(cfg.metadata.notes.length).toBeGreaterThan(0);
  });
});

describe("admin overrides", () => {
  it("Test 4: override changes values (not formulas)", () => {
    const cfg = getProjectionAssumptionsConfig({
      company: { markupPct: 25 },
      risk: { hashpriceRefUsdPerThDay: 0.2 },
      mining: { uptimePct: 0.9 },
    });
    expect(cfg.company.markupPct).toBe(25);
    expect(cfg.risk.hashpriceRefUsdPerThDay).toBe(0.2);
    expect(cfg.mining.uptimePct).toBe(0.9);
  });

  it("Test 5: override does NOT promote status to REAL", () => {
    const cfg = getProjectionAssumptionsConfig({ company: { markupPct: 25 } });
    expect(cfg.status).toBe("CONFIGURED");
    expect((cfg.status as string)).not.toBe("REAL");
    expect(cfg.metadata.source).toBe("ADMIN_CONFIG");
  });

  it("Test 6b: no override → stays CODE_DEFAULT", () => {
    const cfg = mergeProjectionAssumptionsOverrides(
      getDefaultProjectionAssumptionsConfig(),
      undefined,
    );
    expect(cfg.metadata.source).toBe("CODE_DEFAULT");
  });

  it("Test 9: invalid (NaN) override is dropped, falls back to default", () => {
    const def = getDefaultProjectionAssumptionsConfig();
    const cfg = getProjectionAssumptionsConfig({
      company: { markupPct: Number.NaN },
    });
    expect(cfg.company.markupPct).toBe(def.company.markupPct);
  });
});

describe("engine consumption via centralized config", () => {
  it("Test 8: risk engine consumes config-derived references", () => {
    const cfg = getProjectionAssumptionsConfig({ risk: { hashpriceRefUsdPerThDay: 0.2 } });
    const refs = toRiskReferenceInputs(cfg);
    const def = computeRiskScore(INPUTS);
    const viaConfig = computeRiskScore(INPUTS, refs);
    expect(viaConfig).not.toBe(def); // different ref moves the score
  });

  it("Test 8b: mining engine consumes config-derived costs", () => {
    const cfg = getProjectionAssumptionsConfig({ mining: { efficiencyKwhPerThDay: 0.05 } });
    const costs = toMiningCostInputs(cfg);
    const def = computeMiningRevenue(INPUTS);
    const viaConfig = computeMiningRevenue(INPUTS, costs);
    expect(viaConfig.net_margin_usd_th_day).not.toBe(def.net_margin_usd_th_day);
  });

  it("config adapters never claim live for risk baselines", () => {
    const refs = toRiskReferenceInputs(getProjectionAssumptionsConfig());
    expect(refs.metadata?.riskBaselineSource).toBe("CONFIGURED");
    expect(refs.metadata?.hashpriceSource).not.toBe("LIVE");
  });
});

describe("read-vault-apy wiring", () => {
  it("Test 7: read-vault-apy consumes the centralized config", () => {
    expect(READ_VAULT_APY_SRC).toContain("getProjectionAssumptionsConfig");
  });
});

describe("investor-facing guard", () => {
  it("Test 10: status never becomes REAL/GO via config", () => {
    for (const cfg of [
      getDefaultProjectionAssumptionsConfig(),
      getProjectionAssumptionsConfig({ company: { markupPct: 30 }, updatedBy: "admin" }),
    ]) {
      expect(["CONFIGURED", "PARTIAL", "AUDITED"]).toContain(cfg.status);
      expect((cfg.status as string)).not.toBe("REAL");
    }
  });
});
