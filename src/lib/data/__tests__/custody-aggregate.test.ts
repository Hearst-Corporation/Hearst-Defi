import { describe, expect, it } from "vitest";

import {
  aggregateCustody,
  isBtcAsset,
  isUsdcAsset,
  type RawCustodyAccount,
} from "../custody-aggregate";

const raw: RawCustodyAccount[] = [
  {
    id: "85",
    name: "Wemine WE02",
    assets: [
      { id: "BTC", total: 0.082 },
      { id: "USDC", total: 9.11 },
      { id: "USDC_ARB_3SBJ", total: 0.11 },
    ],
  },
  { id: "84", name: "HashFlow", assets: [{ id: "USDC", total: 1000 }] },
  { id: "73", name: "AKT036B", assets: [{ id: "BTC", total: 0 }] },
];

describe("isUsdcAsset", () => {
  it("matches the USDC family, not other assets", () => {
    expect(isUsdcAsset("USDC")).toBe(true);
    expect(isUsdcAsset("USDC_ARB_3SBJ")).toBe(true);
    expect(isUsdcAsset("BTC")).toBe(false);
    expect(isUsdcAsset("ETH")).toBe(false);
  });
});

describe("isBtcAsset", () => {
  it("matches the BTC family, not other assets", () => {
    expect(isBtcAsset("BTC")).toBe(true);
    expect(isBtcAsset("WBTC")).toBe(true);
    expect(isBtcAsset("cbBTC")).toBe(true);
    expect(isBtcAsset("tBTC")).toBe(true);
    expect(isBtcAsset("USDC")).toBe(false);
    expect(isBtcAsset("USDC_ARB_3SBJ")).toBe(false);
    expect(isBtcAsset("ETH")).toBe(false);
  });
});

describe("aggregateCustody", () => {
  it("sums the USDC family per account and overall", () => {
    const { accounts, totalUsdcReserves } = aggregateCustody(raw);
    expect(accounts).toHaveLength(3);
    expect(accounts[0]?.usdcTotal).toBe(9.22); // 9.11 + 0.11
    expect(accounts[1]?.usdcTotal).toBe(1000);
    expect(totalUsdcReserves).toBe(1009.22);
  });

  it("sums the BTC family per account and overall", () => {
    const { accounts, totalBtcReserves } = aggregateCustody(raw);
    expect(accounts).toHaveLength(3);
    expect(accounts[0]?.btcTotal).toBe(0.08); // 0.082 rounded to 2dp, same round2 as USDC
    expect(accounts[1]?.btcTotal).toBe(0); // USDC-only account → honest zero
    expect(accounts[2]?.btcTotal).toBe(0); // BTC total 0 → honest zero
    expect(totalBtcReserves).toBe(0.08);
  });

  it("returns totalBtcReserves 0 for a USDC-only fixture (no BTC asset present)", () => {
    const usdcOnly: RawCustodyAccount[] = [
      { id: "1", name: "USDC Only", assets: [{ id: "USDC", total: 500 }] },
    ];
    const { accounts, totalBtcReserves } = aggregateCustody(usdcOnly);
    expect(accounts[0]?.btcTotal).toBe(0);
    expect(totalBtcReserves).toBe(0);
  });

  it("pins the scope to the configured account ids", () => {
    const { accounts, totalUsdcReserves } = aggregateCustody(raw, {
      accountIds: ["84"],
    });
    expect(accounts).toHaveLength(1);
    expect(accounts[0]?.name).toBe("HashFlow");
    expect(totalUsdcReserves).toBe(1000);
  });

  it("ignores unknown account ids", () => {
    const { accounts, totalUsdcReserves, totalBtcReserves } = aggregateCustody(raw, {
      accountIds: ["999"],
    });
    expect(accounts).toHaveLength(0);
    expect(totalUsdcReserves).toBe(0);
    expect(totalBtcReserves).toBe(0);
  });
});
