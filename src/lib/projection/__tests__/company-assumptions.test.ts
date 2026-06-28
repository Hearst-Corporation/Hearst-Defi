import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

import {
  DEFAULT_PROJECTION_COMPANY_ASSUMPTIONS,
  getProjectionCompanyAssumptions,
} from "../company-assumptions";
import { runScenario, DEFAULT_USDC_ANNUAL_YIELD } from "@/lib/engine/scenario";
import type { ScenarioParams } from "@/lib/engine/types";

const READ_VAULT_APY_SRC = readFileSync(
  new URL("../../telegram/read-vault-apy.ts", import.meta.url),
  "utf8",
);

const PARAMS: ScenarioParams = {
  btcPriceUsd: 60_000,
  networkHashrateEh: 900,
  hashpricePer100Th: 0.06,
  miningYieldPct: 0.1,
  allocationWeights: { mining: 0.4, btcTactical: 0.2, usdcBase: 0.3, stableReserve: 0.1 },
  durationMonths: 12,
  riskFreeRate: 0.04,
};

describe("Test 1 — no silent hardcoded company assumptions in read-vault-apy", () => {
  it("consumes the assumptions layer, not local numeric constants", () => {
    // Consumes the assumptions layer via the centralized config service
    // (getProjectionAssumptionsConfig wraps getProjectionCompanyAssumptions).
    expect(READ_VAULT_APY_SRC).toContain("getProjectionAssumptionsConfig");
  });

  it("no longer declares the old silent constants", () => {
    expect(READ_VAULT_APY_SRC).not.toMatch(/const MARKUP_PCT = 15/);
    expect(READ_VAULT_APY_SRC).not.toMatch(/const COMPANY_SHARE_PCT = 20/);
    expect(READ_VAULT_APY_SRC).not.toMatch(/const BORROW_APR_PCT = 6/);
    expect(READ_VAULT_APY_SRC).not.toMatch(/const FEES_PCT = 2/);
    expect(READ_VAULT_APY_SRC).not.toMatch(/const BTC_RETURN = \{ bear: -20/);
  });
});

describe("Test 2 — assumptions metadata exposed", () => {
  const a = getProjectionCompanyAssumptions();
  it("carries source, status, notes", () => {
    expect(a.metadata.source).toMatch(/company-assumptions/);
    expect(a.metadata.status).toBeDefined();
    expect(a.metadata.notes.length).toBeGreaterThan(0);
  });
  it("exposes the migrated values verbatim", () => {
    expect(a.markupPct).toBe(15);
    expect(a.revenueSharePct).toBe(20);
    expect(a.borrowAprPct).toBe(6);
    expect(a.feePct).toBe(2);
    expect(a.btcScenarios).toEqual({ bearPct: -20, basePct: 40, bullPct: 120 });
    expect(Object.keys(a.vaultBounds)).toEqual(["yield", "defensive", "btc-plus"]);
  });
});

describe("Test 3 — scenario assumptions live wording (injected)", () => {
  it("does NOT say 4.8% fixed when a USDC yield is injected", () => {
    const res = runScenario({ ...PARAMS, usdcAnnualYield: 0.0512 });
    const usdcLine = res.assumptions.find((l) => l.includes("USDC base APY"));
    expect(usdcLine).toBeDefined();
    expect(usdcLine).not.toContain("4.8% fixed");
    expect(usdcLine).toContain("5.12% from injected yield source");
  });
});

describe("Test 4 — scenario assumptions fallback wording (omitted)", () => {
  it("states fallback/default explicitly when no yield injected", () => {
    const res = runScenario(PARAMS);
    const usdcLine = res.assumptions.find((l) => l.includes("USDC base APY"));
    expect(usdcLine).toContain("fallback/default assumption");
    expect(usdcLine).toContain(`${(DEFAULT_USDC_ANNUAL_YIELD * 100).toFixed(2)}%`);
    // never the misleading old "fixed" wording
    expect(usdcLine).not.toContain("4.8% fixed");
  });
});

describe("Test 5 — no investor-facing upgrade", () => {
  it("company assumptions stay CONFIGURED, never REAL", () => {
    expect(DEFAULT_PROJECTION_COMPANY_ASSUMPTIONS.metadata.status).toBe("CONFIGURED");
    expect(DEFAULT_PROJECTION_COMPANY_ASSUMPTIONS.metadata.status).not.toBe("REAL");
  });
  it("notes flag them as not validated / not live", () => {
    const notes = DEFAULT_PROJECTION_COMPANY_ASSUMPTIONS.metadata.notes.join(" ").toLowerCase();
    expect(notes).toMatch(/pas valid|not live|investor-facing/);
  });
});
