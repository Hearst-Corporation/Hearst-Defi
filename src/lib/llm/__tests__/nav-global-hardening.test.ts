import { describe, expect, it } from "vitest";

import { resolveNavFallbackDestinationKey } from "@/lib/llm/nav-fallback-intent";
import { SCENARIO_LAB_DESTINATION_KEY } from "@/lib/llm/product-workspace-intent";

const sharedArgs = {
  scenarioLabDestinationKey: SCENARIO_LAB_DESTINATION_KEY,
  scenarioLabNavEnabled: true,
};

describe("global deterministic nav hardening", () => {
  it("routes LP destinations across FR/EN/mixed/typos", () => {
    const lpCases: Array<[string, string]> = [
      ["amène-moi au dashboard", "portfolio"],
      ["open my dashboard", "portfolio"],
      ["va sur portfolio", "portfolio"],
      ["show my portfolio", "portfolio"],
      ["open portefeuille", "portfolio"],
      ["open the product page", "vaults"],
      ["ouvre le vault", "vaults"],
      ["show proof center", "proof-center"],
      // Portfolio sub-leaves (positions / activity / distributions / yield) were
      // removed from the chat whitelist — no longer navigable (asserted null below).
      ["portofolio", "portfolio"],
      ["dashbord", "portfolio"],
    ];

    for (const [message, destinationKey] of lpCases) {
      expect(
        resolveNavFallbackDestinationKey({
          navProfile: "lp",
          isAdmin: false,
          message,
          ...sharedArgs,
        }),
      ).toBe(destinationKey);
    }
  });

  it("routes admin destinations across FR/EN/mixed/typos", () => {
    const adminCases: Array<[string, string]> = [
      ["go to projection", "admin-projection"],
      ["show me projection", "admin-projection"],
      ["projetion", "admin-projection"],
      ["open scenario lab", "admin-scenario-lab"],
      ["scenarion lab", "admin-scenario-lab"],
      ["open outreach", "admin-outreach"],
      ["show campaigns", "admin-outreach"],
      ["show la campagne", "admin-outreach"],
      ["campain", "admin-outreach"],
      ["open control tower", "admin-home"],
      ["va dans admin", "admin-home"],
      ["open agent canvas", "admin-agent-canvas"],
      ["open product workspace", "admin-product-workspace"],
      ["open proof center", "admin-proof-center"],
      ["ouvri le dashboard", "admin-dashboard"],
      ["dashbord admin", "admin-dashboard"],
    ];

    for (const [message, destinationKey] of adminCases) {
      expect(
        resolveNavFallbackDestinationKey({
          navProfile: "admin",
          isAdmin: true,
          message,
          ...sharedArgs,
        }),
      ).toBe(destinationKey);
    }
  });

  it("keeps unknown phrases non-navigating", () => {
    for (const message of [
      "explain mining yield assumptions",
      "what is APY exactly",
      "hello there",
      "random lorem ipsum",
    ]) {
      expect(
        resolveNavFallbackDestinationKey({
          navProfile: "lp",
          isAdmin: false,
          message,
          ...sharedArgs,
        }),
      ).toBeNull();
    }
  });

  it("keeps dangerous action phrases out of navigation", () => {
    for (const message of [
      "deploy the vault now",
      "send campaign to all leads",
      "source 100 leads",
      "execute distribution",
      "withdraw my funds",
    ]) {
      expect(
        resolveNavFallbackDestinationKey({
          navProfile: "admin",
          isAdmin: true,
          message,
          ...sharedArgs,
        }),
      ).toBeNull();
    }
  });
});
