import { describe, expect, it } from "vitest";

import {
  INVEST_SELECT_PATH,
  investConfirmedPath,
  investDepositPath,
  investProductPath,
  vaultSlug,
} from "@/lib/vaults/invest-routes";

describe("invest-routes", () => {
  it("normalizes vault slugs", () => {
    expect(vaultSlug("YIELD")).toBe("yield");
  });

  it("builds the four-step invest wizard paths", () => {
    expect(INVEST_SELECT_PATH).toBe("/vaults");
    expect(investProductPath("yield")).toBe("/vaults/yield");
    expect(investDepositPath("yield")).toBe("/vaults/yield/invest");
    expect(investConfirmedPath("yield")).toBe("/vaults/yield/invest/confirmed");
  });
});
