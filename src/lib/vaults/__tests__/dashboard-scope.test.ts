import { describe, expect, it } from "vitest";

import {
  adminDashboardVaultHref,
  adminDistributionsVaultHref,
  adminScenarioLabVaultHref,
  adminSignalsVaultHref,
  adminVaultHrefFromSlug,
  DASHBOARD_FIXTURE_VAULTS,
  distributionVaultScopeWhere,
  isEngineFixtureVaultId,
  matchesDistributionVaultScope,
  resolveDistributionVaultScopeId,
  resolveFixtureVaultId,
  withAdminVaultQuery,
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

  it("adminDistributionsVaultHref and adminSignalsVaultHref follow fixture scope", () => {
    expect(adminDistributionsVaultHref("yield")).toBe("/admin/distributions");
    expect(adminDistributionsVaultHref("defensive")).toBe(
      "/admin/distributions?vault=defensive",
    );
    expect(adminSignalsVaultHref("yield")).toBe("/admin/signals");
    expect(adminSignalsVaultHref("btc-plus")).toBe("/admin/signals?vault=btc-plus");
  });

  it("resolveFixtureVaultId defaults unknown to yield", () => {
    expect(resolveFixtureVaultId(undefined)).toBe("yield");
    expect(resolveFixtureVaultId("defensive")).toBe("defensive");
    expect(resolveFixtureVaultId("hyv-a")).toBe("yield");
  });

  it("resolveFixtureVaultId handles all fixture vault ids", () => {
    expect(resolveFixtureVaultId("btc-plus")).toBe("btc-plus");
    expect(resolveFixtureVaultId("yield")).toBe("yield");
    expect(resolveFixtureVaultId("defensive")).toBe("defensive");
  });

  it("withAdminVaultQuery preserves vault and extra params for sub-nav", () => {
    expect(withAdminVaultQuery("/admin/signals", "yield", { status: "pending" })).toBe(
      "/admin/signals?vault=yield&status=pending",
    );
    expect(withAdminVaultQuery("/admin/distributions", null)).toBe("/admin/distributions");
    expect(withAdminVaultQuery("/admin/distributions", "defensive")).toBe(
      "/admin/distributions?vault=defensive",
    );
  });

  it("distributionVaultScopeWhere includes legacy yield rows", () => {
    expect(distributionVaultScopeWhere("yield")).toEqual({
      OR: [{ vaultRef: "yield" }, { vaultRef: "hearst-yield-vault" }, { vaultRef: null }],
    });
    expect(distributionVaultScopeWhere("defensive")).toEqual({ vaultRef: "defensive" });
  });

  it("matchesDistributionVaultScope mirrors yield legacy + null rows", () => {
    expect(matchesDistributionVaultScope(null, "yield")).toBe(true);
    expect(matchesDistributionVaultScope("hearst-yield-vault", "yield")).toBe(true);
    expect(matchesDistributionVaultScope(null, "defensive")).toBe(false);
    expect(matchesDistributionVaultScope("defensive", "defensive")).toBe(true);
  });

  it("resolveDistributionVaultScopeId normalizes legacy slugs", () => {
    expect(resolveDistributionVaultScopeId("hearst-yield-vault")).toBe("yield");
    expect(resolveDistributionVaultScopeId("btc-plus")).toBe("btc-plus");
  });
});
