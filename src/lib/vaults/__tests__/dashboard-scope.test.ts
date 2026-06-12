import { describe, expect, it } from "vitest";

import {
  adminDashboardVaultHref,
  adminScenarioLabVaultHref,
  adminVaultHrefFromSlug,
  DASHBOARD_FIXTURE_VAULTS,
  isEngineFixtureVaultId,
} from "@/lib/vaults/dashboard-scope";

describe("dashboard-scope", () => {
  it("lists the three engine fixtures in stable order", () => {
    expect(DASHBOARD_FIXTURE_VAULTS.map((v) => v.id)).toEqual([
      "yield",
      "defensive",
      "btc-plus",
    ]);
  });

  it("adminDashboardVaultHref maps yield to bare dashboard", () => {
    expect(adminDashboardVaultHref("yield")).toBe("/admin/dashboard");
    expect(adminDashboardVaultHref("defensive")).toBe("/admin/dashboard?vault=defensive");
  });

  it("adminScenarioLabVaultHref maps yield to bare scenario lab", () => {
    expect(adminScenarioLabVaultHref("yield")).toBe("/admin/scenario-lab");
    expect(adminScenarioLabVaultHref("btc-plus")).toBe(
      "/admin/scenario-lab?vault=btc-plus",
    );
  });

  it("adminVaultHrefFromSlug routes deployments to vault detail", () => {
    expect(adminVaultHrefFromSlug("hyv-a")).toBe("/admin/vaults/hyv-a");
    expect(isEngineFixtureVaultId("hyv-a")).toBe(false);
  });
});
