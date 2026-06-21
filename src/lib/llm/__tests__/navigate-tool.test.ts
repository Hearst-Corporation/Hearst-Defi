import { describe, expect, it } from "vitest";

import {
  ADMIN_NAV_DESTINATIONS,
  LP_NAV_DESTINATIONS,
  createNavigateTool,
  getNavKeys,
  resolveNavDestination,
  resolveNavDestinationForProfile,
  isProtectedRoute,
} from "@/lib/llm/navigate-tool";

describe("navigate-tool whitelist", () => {
  it("LP whitelist exposes only LP routes (no admin, no debug, no dynamic id)", () => {
    for (const d of LP_NAV_DESTINATIONS) {
      expect(d.route).not.toMatch(/^\/admin/);
      expect(d.route).not.toMatch(/^\/debug/);
      expect(d.route).not.toContain("[");
    }
    expect(LP_NAV_DESTINATIONS.map((d) => d.route)).toEqual([
      "/portfolio",
      "/portfolio/positions",
      "/portfolio/activity",
      "/portfolio/distributions",
      "/portfolio/yield",
      "/portfolio/tax",
      "/vaults",
      "/proof-center",
      "/proof-center/full",
      "/profile",
      "/legal",
      "/legal/disclaimer",
      "/legal/privacy",
      "/legal/terms",
    ]);
  });

  it("admin whitelist exposes admin routes only", () => {
    expect(ADMIN_NAV_DESTINATIONS.map((d) => d.route)).toEqual([
      "/admin/product-workspace",
      "/admin/scenario-lab",
      "/admin/dashboard",
      "/admin/vaults",
      "/admin/customers",
      "/admin/outreach",
      "/admin/proofs",
      "/admin/governance",
      "/admin/roadmap",
      "/admin/projection",
      "/admin",
      "/admin/vaults/new",
      "/admin/outreach/compose",
      "/admin/proof-center",
      "/admin/proof-center/full",
      "/admin/governance/allowlist",
      "/admin/governance/propose",
      "/admin/agents",
      "/admin/agents/new",
      "/admin/audit",
      "/admin/distributions",
      "/admin/feedback",
      "/admin/investor-memo",
      "/admin/monitoring",
      "/admin/security",
      "/admin/signals",
      "/admin/spec",
    ]);
    // Every admin destination stays under /admin (root or sub-path); none is a
    // dynamic `[id]` route (the model has no id to fill).
    for (const d of ADMIN_NAV_DESTINATIONS) {
      expect(d.route).toMatch(/^\/admin(\/|$)/);
      expect(d.route).not.toContain("[");
    }
  });

  it("the tool enum is scoped by profile (model can't invent cross-profile keys)", () => {
    const lpTool = createNavigateTool("lp");
    const adminTool = createNavigateTool("admin");
    expect(lpTool.function.parameters.properties.destination.enum).toEqual([
      ...getNavKeys("lp"),
    ]);
    expect(adminTool.function.parameters.properties.destination.enum).toEqual([
      ...getNavKeys("admin"),
    ]);
    expect(lpTool.function.name).toBe("navigate");
    expect(adminTool.function.name).toBe("navigate");
  });

  it("resolves a known key and rejects an unknown one", () => {
    expect(resolveNavDestination("portfolio")?.route).toBe("/portfolio");
    expect(resolveNavDestination("admin-product-workspace")?.route).toBe(
      "/admin/product-workspace",
    );
    expect(resolveNavDestination("admin-dashboard")?.route).toBe(
      "/admin/dashboard",
    );
    expect(resolveNavDestinationForProfile("admin-dashboard", "lp")).toBeNull();
    expect(resolveNavDestinationForProfile("admin-dashboard", "admin")?.route).toBe(
      "/admin/dashboard",
    );
    expect(resolveNavDestination("/etc/passwd")).toBeNull();
    expect(resolveNavDestination(null)).toBeNull();
    expect(resolveNavDestination(undefined)).toBeNull();
  });

  it("flags in-progress flows as protected (auto-nav must not yank)", () => {
    expect(isProtectedRoute("/vaults/abc123/invest")).toBe(true);
    expect(isProtectedRoute("/vaults/abc123/invest/confirmed")).toBe(true);
    expect(isProtectedRoute("/onboarding")).toBe(true);
    expect(isProtectedRoute("/totp-challenge")).toBe(true);
    expect(isProtectedRoute("/portfolio")).toBe(false);
    expect(isProtectedRoute("/vaults")).toBe(false);
    expect(isProtectedRoute("/vaults/abc123")).toBe(false);
  });

  // BUG R2 — repro: segment-anchored onboarding + normalized path.
  it("does NOT treat a sibling route that merely starts with 'onboarding' as protected", () => {
    // "/onboarding-complete" is NOT an in-progress onboarding step.
    expect(isProtectedRoute("/onboarding-complete")).toBe(false);
    expect(isProtectedRoute("/onboarding/step-2")).toBe(true); // real nested step stays protected
  });

  it("protects totp-challenge even with a trailing slash", () => {
    expect(isProtectedRoute("/totp-challenge/")).toBe(true);
  });

  it("protects the deposit flow even with a query string", () => {
    expect(isProtectedRoute("/vaults/x/invest?step=2")).toBe(true);
  });

  it("normalizes trailing slash + query string consistently", () => {
    expect(isProtectedRoute("/onboarding/")).toBe(true);
    expect(isProtectedRoute("/onboarding?next=kyc")).toBe(true);
    expect(isProtectedRoute("/totp-challenge?return=/portfolio")).toBe(true);
    expect(isProtectedRoute("/portfolio?tab=positions")).toBe(false);
    expect(isProtectedRoute("/onboarding-complete/")).toBe(false);
  });
});
