import { execSync } from "node:child_process";

import { describe, expect, it, vi } from "vitest";

// server-only is a runtime guard with no test-time substitute; stub it so the
// module imports cleanly (same pattern as the other server-only lib tests).
vi.mock("server-only", () => ({}));

import { getProductRoutes } from "@/lib/product-routes";

/**
 * Route segments that exist on the working-tree filesystem but are NOT tracked
 * by git (untracked scratch/in-flight work from another chantier, e.g. an
 * un-integrated `src/app/admin/document-vault/`). The exhaustive route test
 * mirrors the REAL release — i.e. what Git holds — so a route whose page files
 * are untracked must not fail this RC. This never hides a route that is IN the
 * release: as soon as its files are committed, it re-enters the assertion.
 */
function untrackedAppRouteSegments(): Set<string> {
  let out = "";
  try {
    out = execSync("git ls-files --others --exclude-standard -- src/app", {
      encoding: "utf8",
    });
  } catch {
    return new Set();
  }
  const segs = new Set<string>();
  for (const line of out.split("\n")) {
    // src/app/admin/document-vault/page.tsx -> "admin/document-vault"
    const m = line.match(/^src\/app\/(.+)\/(page|route|layout)\.[tj]sx?$/);
    if (m?.[1]) segs.add(m[1].replace(/\/\([^)]+\)/g, "").replace(/^\/+/, ""));
  }
  return segs;
}

/** Drop routes whose page files are untracked-in-git (out of this release). */
function trackedOnly(routes: readonly string[]): string[] {
  const untracked = untrackedAppRouteSegments();
  if (untracked.size === 0) return [...routes];
  return routes.filter((r) => {
    const seg = r.replace(/^\/+/, "");
    for (const u of untracked) {
      if (seg === u || seg.startsWith(`${u}/`)) return false;
    }
    return true;
  });
}

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
  "/admin/agent-canvas",
  "/admin/agent-canvas/[canvasId]",
  "/admin/agentic",
  "/admin/audit",
  "/admin/chart-gallery",
  "/admin/customers",
  "/admin/customers/[id]",
  "/admin/dashboard",
  "/admin/design-system",
  "/admin/diagnostics",
  "/admin/distributions",
  "/admin/document-vault",
  "/admin/feedback",
  "/admin/governance",
  "/admin/governance/allowlist",
  "/admin/governance/proposal/[id]",
  "/admin/governance/propose",
  "/admin/investor-memo",
  "/admin/marketplace",
  "/admin/monitoring",
  "/admin/onboarding-test",
  "/admin/outreach",
  "/admin/outreach/[campaignId]",
  "/admin/outreach/compose",
  "/admin/outreach/prospects/[id]",
  "/admin/product-workspace",
  "/admin/product-workspace/report/print",
  "/admin/products/btc-mining-performance-vault",
  "/admin/proof-center",
  "/admin/proof-center/full",
  "/admin/proofs",
  "/admin/roadmap",
  "/admin/security",
  "/admin/signals",
  "/admin/source",
  "/admin/spec",
  "/admin/spec/[slug]",
  "/admin/strategies",
  "/admin/strategies/[slug]",
  "/admin/system/architecture",
  "/admin/vaults",
  "/admin/vaults/[id]",
  "/admin/vaults/[id]/edit",
  "/admin/vaults/new",
  "/agent-canvas",
  "/agent-canvas/[canvasId]",
  "/apply",
  "/apply/confirmed",
  "/bitcoin",
  "/btc",
  "/btc/ledger",
  "/dashboard",
  "/forgot-password",
  "/legal",
  "/legal/disclaimer",
  "/legal/privacy",
  "/legal/terms",
  "/login",
  "/mining",
  "/my-vaults",
  "/onboarding",
  "/onboarding/accreditation",
  "/onboarding/identity",
  "/onboarding/wallet",
  "/portfolio",
  "/portfolio/[positionId]",
  "/portfolio/activity",
  "/portfolio/distributions",
  "/portfolio/positions",
  "/portfolio/preview",
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
    const routes = trackedOnly(await getProductRoutes());
    // Exact match: a missing or extra page fails the test on the spot.
    // (Untracked-in-git app routes are excluded — see trackedOnly / RC-fix.)
    expect(routes).toEqual(EXPECTED_ROUTES);
  });

  it("exposes no public /catalyst-preview demo route", async () => {
    // The internal Catalyst component showcase used to live at the app root with
    // no (product)/admin/auth layout gate — any logged-out visitor could open it.
    // It was deleted; this guard fails if it is ever re-added as a public route.
    const routes = await getProductRoutes();
    expect(routes).not.toContain("/catalyst-preview");
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
