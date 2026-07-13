import { describe, expect, it } from "vitest";

import {
  aggregateCustody,
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

describe("aggregateCustody", () => {
  it("sums the USDC family per account and overall", () => {
    const { accounts, totalUsdcReserves } = aggregateCustody(raw);
    expect(accounts).toHaveLength(3);
    expect(accounts[0]?.usdcTotal).toBe(9.22); // 9.11 + 0.11
    expect(accounts[1]?.usdcTotal).toBe(1000);
    expect(totalUsdcReserves).toBe(1009.22);
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
    const { accounts, totalUsdcReserves } = aggregateCustody(raw, {
      accountIds: ["999"],
    });
    expect(accounts).toHaveLength(0);
    expect(totalUsdcReserves).toBe(0);
  });
});
