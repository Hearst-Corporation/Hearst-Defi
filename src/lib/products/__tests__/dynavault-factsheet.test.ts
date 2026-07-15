import { describe, expect, it } from "vitest";

import {
  ALLOCATION_TOTAL_BPS,
  B1_MINING_ALLOCATION_BPS,
  B2_BTC_ALLOCATION_BPS,
  B3_USDC_ALLOCATION_BPS,
  PRODUCT_DURATION_MONTHS,
  buildDynavaultFactsheet,
  type FactsheetDeployment,
} from "@/lib/products/dynavault-factsheet";

// This module is PURE on purpose: no chain adapter import, no env, no RPC.

const NOW = new Date("2026-07-15T00:00:00.000Z");

const NOT_CONFIGURED: FactsheetDeployment = {
  mode: "not_configured",
  chainId: 84532,
  address: null,
};

const LEGACY: FactsheetDeployment = {
  mode: "legacy",
  chainId: 84532,
  address: "0x2bd14d52518a04f4c12949c51df03a161a9e329e",
};

const V2: FactsheetDeployment = {
  mode: "v2",
  chainId: 84532,
  address: "0x1111111111111111111111111111111111111111",
};

describe("dynavault factsheet — spec constants", () => {
  it("allocation bands make a whole (4000 + 2700 + 3300 = 10000 bps)", () => {
    expect(
      B1_MINING_ALLOCATION_BPS + B2_BTC_ALLOCATION_BPS + B3_USDC_ALLOCATION_BPS,
    ).toBe(ALLOCATION_TOTAL_BPS);
  });

  it("the asset is USDC with 6 decimals — never USDT", () => {
    const sheet = buildDynavaultFactsheet({ now: NOW, deployment: NOT_CONFIGURED });
    expect(sheet.asset).toEqual({ symbol: "USDC", decimals: 6 });
    expect(JSON.stringify(sheet)).not.toContain("USDT");
  });
});

describe("dynavault factsheet — honesty with no chain", () => {
  it("marks every constant-backed field 'manual', never 'live'", () => {
    const sheet = buildDynavaultFactsheet({ now: NOW, deployment: NOT_CONFIGURED });

    expect(sheet.allocation.b1MiningBps.provenance).toBe("manual");
    expect(sheet.economics.monthlyElectricityCostUsd.provenance).toBe("manual");
    expect(sheet.lifecycle.productDurationMonths.provenance).toBe("manual");
    expect(sheet.lifecycle.productDurationMonths.value).toBe(PRODUCT_DURATION_MONTHS);
    expect(sheet.curtailment.preHalvingThresholdUsd.provenance).toBe("manual");
  });

  it("reports the contract as not deployed outside v2 mode", () => {
    expect(
      buildDynavaultFactsheet({ now: NOW, deployment: NOT_CONFIGURED }).contract.deployed,
    ).toBe(false);
    expect(
      buildDynavaultFactsheet({ now: NOW, deployment: LEGACY }).contract.deployed,
    ).toBe(false);
    expect(buildDynavaultFactsheet({ now: NOW, deployment: V2 }).contract.deployed).toBe(
      true,
    );
  });

  it("never invents a vending curve or a TVL cap, and names why", () => {
    const unconfigured = buildDynavaultFactsheet({
      now: NOW,
      deployment: NOT_CONFIGURED,
    });
    expect(unconfigured.vendingCurveBps).toEqual({
      status: "unavailable",
      reason: "not_deployed",
    });
    expect(unconfigured.tvlCapUsdc.status).toBe("unavailable");

    // A legacy vault physically cannot answer — a different reason, not the same silence.
    const legacy = buildDynavaultFactsheet({ now: NOW, deployment: LEGACY });
    expect(legacy.vendingCurveBps).toEqual({
      status: "unavailable",
      reason: "not_supported_by_legacy",
    });
  });

  it("emits no APY figure — the v2.1 product states no target APY", () => {
    const sheet = buildDynavaultFactsheet({ now: NOW, deployment: NOT_CONFIGURED });
    expect(sheet.apyTarget.status).toBe("not_applicable");
  });
});

describe("dynavault factsheet — the chain wins when it answers", () => {
  it("prefers a wired chain read over the spec constant", () => {
    const sheet = buildDynavaultFactsheet({
      now: NOW,
      deployment: V2,
      chain: {
        productDurationMonths: { status: "wired", data: 36 },
        vendingCurveBps: { status: "wired", data: [10_000, 9_000] },
      },
    });

    expect(sheet.lifecycle.productDurationMonths.value).toBe(36);
    expect(sheet.lifecycle.productDurationMonths.provenance).toBe("live");
    expect(sheet.vendingCurveBps).toMatchObject({
      status: "available",
      value: [10_000, 9_000],
      provenance: "live",
    });
  });

  it("a FAILED chain read is stated, not silently swallowed by the constant", () => {
    const sheet = buildDynavaultFactsheet({
      now: NOW,
      deployment: V2,
      chain: {
        productDurationMonths: { status: "unavailable", reason: "rpc_error" },
        vendingCurveBps: { status: "unavailable", reason: "rpc_error" },
      },
    });

    // The constant is still served…
    expect(sheet.lifecycle.productDurationMonths.value).toBe(PRODUCT_DURATION_MONTHS);
    expect(sheet.lifecycle.productDurationMonths.provenance).toBe("manual");
    // …but the outage is visible: an RPC failure never looks like a clean value.
    expect(sheet.lifecycle.productDurationMonths.chainUnavailableReason).toBe(
      "rpc_error",
    );
    expect(sheet.vendingCurveBps).toEqual({
      status: "unavailable",
      reason: "rpc_error",
    });
  });

  it("surfaces an inconsistent allocation instead of hiding it", () => {
    const sheet = buildDynavaultFactsheet({
      now: NOW,
      deployment: V2,
      chain: { miningAllocationBps: { status: "wired", data: 5_000 } },
    });

    expect(sheet.allocation.totalBps).toBe(5_000 + B2_BTC_ALLOCATION_BPS + B3_USDC_ALLOCATION_BPS);
    expect(sheet.allocation.consistent).toBe(false);
  });
});
