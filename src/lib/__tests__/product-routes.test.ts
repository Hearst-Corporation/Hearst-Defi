import { describe, expect, it, vi } from "vitest";

// server-only is a runtime guard with no test-time substitute; stub it so the
// module imports cleanly (same pattern as the other server-only lib tests).
vi.mock("server-only", () => ({}));

import { getProductRoutes } from "@/lib/product-routes";

/**
 * Tests run against the REAL filesystem (`src/app/`), not a mock: the point of
 * this lib is to mirror the actual App Router page tree, so the test must break
 * if ANY route is added/removed or if route-group / dynamic-segment handling
 * regresses. The expected list below is therefore EXHAUSTIVE — add the new
 * route here when you add a page (that prompt is the intended safety net).
 */
const EXPECTED_ROUTES = [
  "/",
  "/admin",
  "/admin/agents",
  "/admin/agents/[id]",
  "/admin/agents/new",
  "/admin/audit",
  "/admin/customers",
  "/admin/customers/[id]",
  "/admin/dashboard",
  "/admin/distributions",
  "/admin/feedback",
  "/admin/governance",
  "/admin/governance/allowlist",
  "/admin/governance/proposal/[id]",
  "/admin/governance/propose",
  "/admin/investor-memo",
  "/admin/monitoring",
  "/admin/onboarding-test",
  "/admin/outreach",
  "/admin/outreach/[campaignId]",
  "/admin/outreach/compose",
  "/admin/product-workspace",
  "/admin/projection",
  "/admin/proof-center",
  "/admin/proof-center/full",
  "/admin/proofs",
  "/admin/roadmap",
  "/admin/scenario-lab",
  "/admin/security",
  "/admin/signals",
  "/admin/spec",
  "/admin/spec/[slug]",
  "/admin/vaults",
  "/admin/vaults/[id]",
  "/admin/vaults/[id]/edit",
  "/admin/vaults/new",
  "/apply",
  "/apply/confirmed",
  "/forgot-password",
  "/legal",
  "/legal/disclaimer",
  "/legal/privacy",
  "/legal/terms",
  "/login",
  "/onboarding",
  "/onboarding/accreditation",
  "/onboarding/identity",
  "/onboarding/wallet",
  "/portfolio",
  "/portfolio/[positionId]",
  "/portfolio/activity",
  "/portfolio/distributions",
  "/portfolio/positions",
  "/portfolio/tax",
  "/portfolio/yield",
  "/profile",
  "/proof-center",
  "/proof-center/full",
  "/reset-password",
  "/totp-challenge",
  "/vaults",
  "/vaults/[id]",
  "/vaults/[id]/invest",
  "/vaults/[id]/invest/confirmed",
];

describe("getProductRoutes", () => {
  it("derives EVERY real route in the app (exhaustive)", async () => {
    const routes = await getProductRoutes();
    // Exact match: a missing or extra page fails the test on the spot.
    expect(routes).toEqual(EXPECTED_ROUTES);
  });

  it("strips route groups and keeps dynamic segments", async () => {
    const routes = await getProductRoutes();

    // Route groups like "(product)" must NOT appear as a path segment.
    expect(routes.every((r) => !r.includes("("))).toBe(true);

    // Dynamic segments are kept verbatim as [param] markers.
    expect(routes).toContain("/vaults/[id]");
    expect(routes).toContain("/portfolio/[positionId]");
    expect(routes).toContain("/admin/spec/[slug]");

    // Nested static routes resolve to their full path.
    expect(routes).toContain("/vaults/[id]/invest/confirmed");

    // The home route "/" (outside any route group) is captured.
    expect(routes).toContain("/");
  });

  it("returns a sorted list with no duplicates", async () => {
    const routes = await getProductRoutes();

    const sorted = [...routes].sort();
    expect(routes).toEqual(sorted);

    const unique = Array.from(new Set(routes));
    expect(routes).toHaveLength(unique.length);
  });

  it("yields routes that all start with a single leading slash", async () => {
    const routes = await getProductRoutes();

    expect(routes.length).toBeGreaterThan(0);
    for (const r of routes) {
      expect(r.startsWith("/")).toBe(true);
      expect(r.startsWith("//")).toBe(false);
    }
  });
});
