import { describe, expect, it } from "vitest";

import {
  adminDashboardVaultHref,
  adminDistributionsVaultHref,
  adminSignalsVaultHref,
  adminVaultHrefFromSlug,
  DASHBOARD_FIXTURE_VAULTS,
  distributionVaultScopeWhere,
  getVaultFullLabel,
  getVaultShortLabel,
  isEngineFixtureVaultId,
  matchesDistributionVaultScope,
  resolveDistributionVaultScopeId,
  resolveFixtureVault,
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

  // The deprecated shim keeps the old signature alive for unmigrated callers,
  // but the resolution CONTRACT now lives in resolveFixtureVault: every
  // substitution carries `usedFallback: true` so no caller can mistake a
  // fallback for a requested scope.

  it("resolveFixtureVault: a known fixture id resolves to itself, no fallback flag", () => {
    expect(resolveFixtureVault("yield")).toEqual({
      vaultId: "yield",
      usedFallback: false,
      requested: "yield",
    });
    expect(resolveFixtureVault("defensive").usedFallback).toBe(false);
    expect(resolveFixtureVault("btc-plus").usedFallback).toBe(false);
  });

  it("resolveFixtureVault: retired ids resolve WITH their retired preset labels", () => {
    // The ids stay resolvable (legacy compat) but what they resolve TO is the
    // contained preset — its label carries "(retired configuration)".
    expect(getVaultFullLabel(resolveFixtureVault("defensive").vaultId)).toContain(
      "(retired configuration)",
    );
    expect(getVaultFullLabel(resolveFixtureVault("btc-plus").vaultId)).toContain(
      "(retired configuration)",
    );
  });

  it("resolveFixtureVault: an unknown id falls back to the flagship, TRACED", () => {
    const typo = resolveFixtureVault("hyv-a");
    expect(typo.vaultId).toBe("yield");
    expect(typo.usedFallback).toBe(true);
    expect(typo.requested).toBe("hyv-a");
  });

  it("resolveFixtureVault: absent/empty input is a traced fallback too, never a silent default", () => {
    expect(resolveFixtureVault(undefined)).toEqual({
      vaultId: "yield",
      usedFallback: true,
      requested: undefined,
    });
    expect(resolveFixtureVault("").usedFallback).toBe(true);
  });

  it("deprecated resolveFixtureVaultId shim matches the structured resolution", () => {
    expect(resolveFixtureVaultId(undefined)).toBe("yield");
    expect(resolveFixtureVaultId("defensive")).toBe("defensive");
    expect(resolveFixtureVaultId("hyv-a")).toBe("yield");
    expect(resolveFixtureVaultId("btc-plus")).toBe("btc-plus");
  });

  it("labels: no surface-facing label presents a retired preset as an offered product", () => {
    // getVaultFullLabel sources the preset labels (single source of truth);
    // getVaultShortLabel marks the retirees. "Hearst Yield Vault" is gone —
    // these two fed the proof-center header, a Series 1 surface.
    expect(getVaultFullLabel("yield")).toBe("Hearst Bitcoin Reserve Vault — Series 1");
    expect(getVaultShortLabel("yield")).toBe("Series 1");
    expect(getVaultShortLabel("defensive")).toContain("(retired)");
    expect(getVaultShortLabel("btc-plus")).toContain("(retired)");
    expect(getVaultFullLabel("defensive")).not.toBe("Hearst Defensive Vault");
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
