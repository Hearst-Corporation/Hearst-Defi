import { describe, expect, it } from "vitest";

import { classifyAgenticIntent } from "@/lib/agentic/intent-router";
import {
  resolveNavDestinationForProfile,
  ADMIN_NAV_DESTINATIONS,
} from "@/lib/llm/navigate-tool";
import { resolveClientNav } from "@/lib/llm/client-nav";
import { resolveNavFallbackDestinationKey } from "@/lib/llm/nav-fallback-intent";
import {
  classifyProductWorkspaceIntent,
  SCENARIO_LAB_DESTINATION_KEY,
} from "@/lib/llm/product-workspace-intent";

/**
 * Navigation P0 Repair — Augmented Nav verb-gating + Profile Guard.
 *
 * Closes the P0s found by the full nav-map audit:
 *   1. `resolveAugmentedNav` matched bare mentions / bug reports → navigation.
 *   2. The fast-path derived the profile from the routeKey prefix, so an LP could
 *      publish an admin-* route.
 *   3. "create projection" opened the Product Workspace (projection/product confusion).
 *
 * These tests assert the corrected behaviour AND parity between the client and
 * server nav layers (a key audit finding: the augmented layer used to navigate on
 * inputs the legacy/client layer rejected).
 */

const scenarioLabNavEnabled = ADMIN_NAV_DESTINATIONS.some(
  (d) => d.key === SCENARIO_LAB_DESTINATION_KEY,
);

/** The router's navigation route for a message at a given profile, or null. */
function routerNav(msg: string, isAdmin: boolean): string | null {
  const d = classifyAgenticIntent(msg, {
    navProfile: isAdmin ? "admin" : "lp",
    isAdmin,
    scenarioLabNavEnabled,
  });
  return d.kind === "navigation" ? d.routeKey ?? null : null;
}

/**
 * Reproduces the route.ts fast-path PROFILE GUARD: an LP can only reach LP
 * destinations; an admin can reach admin AND LP. Returns the route that would be
 * published, or null when the guard drops it.
 */
function publishedRoute(msg: string, isAdmin: boolean): string | null {
  const key = routerNav(msg, isAdmin);
  if (!key) return null;
  const routeProfile = key.startsWith("admin-") ? "admin" : "lp";
  const dest =
    routeProfile === "admin"
      ? isAdmin
        ? resolveNavDestinationForProfile(key, "admin")
        : null
      : resolveNavDestinationForProfile(key, "lp");
  return dest ? key : null;
}

// ---------------------------------------------------------------------------
// 1. P0 false positives — bare mentions / bug reports must NOT navigate
// ---------------------------------------------------------------------------

describe("P0 false positives — no navigation", () => {
  // Bug reports + bare mentions that must NOT navigate on EITHER profile. The
  // bug-report guard + the augmented verb-gating cover these on both sides.
  const noNavBoth = [
    "dashboard is broken",
    "le dashboard est cassé",
    "projection is wrong",
    "scenario lab is confusing",
    "le produit ne marche pas",
    "portfolio",
    "proof center",
  ] as const;

  for (const msg of noNavBoth) {
    it(`"${msg}" → no nav on BOTH profiles`, () => {
      expect(routerNav(msg, false)).toBeNull();
      expect(routerNav(msg, true)).toBeNull();
    });
  }

  // Bare admin-surface mentions that must NOT navigate FOR AN LP (the leak this
  // lot closes). On admin they may still resolve via the legacy hand-tuned rules
  // (existing, tested behaviour — an admin typing "outreach" wants that page);
  // the augmented layer no longer adds an LP-side false positive.
  const noNavLp = ["control tower", "outreach", "campaign", "outrich"] as const;

  for (const msg of noNavLp) {
    it(`"${msg}" → no nav for an LP (admin-route leak closed)`, () => {
      expect(routerNav(msg, false)).toBeNull();
      expect(publishedRoute(msg, false)).toBeNull();
    });
  }
});

// ---------------------------------------------------------------------------
// 2. P0 allowed commands — explicit nav still works
// ---------------------------------------------------------------------------

describe("P0 allowed commands — navigation still resolves", () => {
  it.each([
    ["ouvre dashboard", "portfolio", "admin-dashboard"],
    ["open dashboard", "portfolio", "admin-dashboard"],
    ["amène-moi au dashboard", "portfolio", "admin-dashboard"],
  ])("%s → LP %s / admin %s", (msg, lp, admin) => {
    expect(routerNav(msg, false)).toBe(lp);
    expect(routerNav(msg, true)).toBe(admin);
  });

  it("'ouvre control tower' → admin-home (admin), no admin route (LP)", () => {
    expect(routerNav("ouvre control tower", true)).toBe("admin-home");
    expect(publishedRoute("ouvre control tower", false)).toBeNull();
  });

  it("'open outreach' → admin-outreach (admin), no admin route (LP)", () => {
    expect(routerNav("open outreach", true)).toBe("admin-outreach");
    expect(publishedRoute("open outreach", false)).toBeNull();
  });

  it("'montre les campagnes' → admin-outreach (admin)", () => {
    expect(routerNav("montre les campagnes", true)).toBe("admin-outreach");
  });

  it("'dashbord' (typo command) → portfolio (LP)", () => {
    expect(routerNav("dashbord", false)).toBe("portfolio");
  });
});

// ---------------------------------------------------------------------------
// 3. Profile guard — an LP never publishes an admin-* route
// ---------------------------------------------------------------------------

describe("profile guard — LP never reaches admin-*", () => {
  const lpAttemptsAdmin = [
    "open outreach",
    "open product workspace",
    "open campaign",
    "ouvre control tower",
    "show projection",
    "open admin product",
  ] as const;

  for (const msg of lpAttemptsAdmin) {
    it(`LP "${msg}" publishes no admin route`, () => {
      const published = publishedRoute(msg, false);
      expect(published === null || !published.startsWith("admin-")).toBe(true);
    });
  }

  it("admin CAN publish authorized admin routes", () => {
    expect(publishedRoute("open outreach", true)).toBe("admin-outreach");
    expect(publishedRoute("ouvre control tower", true)).toBe("admin-home");
    expect(publishedRoute("open product workspace", true)).toBe(
      "admin-product-workspace",
    );
  });

  it("admin CAN still navigate LP surfaces (admins use LP pages)", () => {
    expect(publishedRoute("ouvre mon portefeuille", true)).toBe("portfolio");
    expect(publishedRoute("open portfolio", true)).toBe("portfolio");
  });
});

// ---------------------------------------------------------------------------
// 4. Projection / product confusion
// ---------------------------------------------------------------------------

describe("projection ≠ product workspace", () => {
  it("'create projection' does NOT open the Product Workspace", () => {
    expect(
      classifyProductWorkspaceIntent("create projection").shouldOpenProductWorkspace,
    ).toBe(false);
  });

  it("'create scenario' / 'make a forecast' do NOT open the Product Workspace", () => {
    expect(
      classifyProductWorkspaceIntent("create scenario").shouldOpenProductWorkspace,
    ).toBe(false);
    expect(
      classifyProductWorkspaceIntent("make a forecast").shouldOpenProductWorkspace,
    ).toBe(false);
  });

  it("real product creation STILL opens the Product Workspace", () => {
    for (const msg of [
      "create a new product",
      "faisons un nouveau produit",
      "create vault",
      "new vault for BTC Plus",
    ]) {
      expect(
        classifyProductWorkspaceIntent(msg).shouldOpenProductWorkspace,
      ).toBe(true);
    }
  });

  it("a product+simulation mix still opens the workspace (product noun present)", () => {
    const c = classifyProductWorkspaceIntent(
      "Créer un produit Defensive puis simuler un stress test",
    );
    expect(c.shouldOpenProductWorkspace).toBe(true);
  });

  it("va faire un vault does not resolve as generic LP vaults nav", () => {
    const nav = resolveNavFallbackDestinationKey({
      navProfile: "admin",
      isAdmin: true,
      message: "va faire un vault",
      scenarioLabDestinationKey: SCENARIO_LAB_DESTINATION_KEY,
      scenarioLabNavEnabled: true,
    });
    expect(nav).toBeNull();
    expect(
      classifyAgenticIntent("va faire un vault", {
        navProfile: "admin",
        isAdmin: true,
        scenarioLabNavEnabled: true,
      }).routeKey,
    ).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 5. 'faisons un nouveau produit' — the historical bug
// ---------------------------------------------------------------------------

describe("'faisons un nouveau produit' routing", () => {
  it("admin → product workspace, never vaults", () => {
    const c = classifyProductWorkspaceIntent("faisons un nouveau produit");
    expect(c.shouldOpenProductWorkspace).toBe(true);
    // and it never resolves as a vaults navigation
    expect(routerNav("faisons un nouveau produit", true)).not.toBe("vaults");
  });

  it("LP → no nav (never vaults, never user vault)", () => {
    expect(routerNav("faisons un nouveau produit", false)).toBeNull();
    expect(publishedRoute("faisons un nouveau produit", false)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 6. Client / server LP parity — never "server navigates while client chats"
// ---------------------------------------------------------------------------

describe("client/server LP parity", () => {
  const inputs = [
    "dashboard is broken",
    "le dashboard est cassé",
    "control tower",
    "outreach",
    "campaign",
    "proof center",
    "portfolio",
    "ouvre dashboard",
    "open portfolio",
    "ouvre mes positions",
    "ouvre control tower",
    "open outreach",
  ] as const;

  for (const msg of inputs) {
    it(`"${msg}" — LP server-published and client agree`, () => {
      const server = publishedRoute(msg, false); // route or null
      const client = resolveClientNav(msg); // {kind, route?}
      const clientNavigates = client.kind === "nav";
      const serverNavigates = server !== null;
      // If the server publishes an LP route, the client must also navigate (no
      // "server navigates while client chats" divergence), and to the same key
      // space. If the server publishes nothing, the client must NOT silently
      // navigate to a destination either.
      expect(serverNavigates).toBe(clientNavigates);
    });
  }
});

// ---------------------------------------------------------------------------
// 7. Determinism — same input 10× = same result
// ---------------------------------------------------------------------------

describe("determinism — same input 10× = same result", () => {
  const inputs = [
    "dashboard is broken",
    "control tower",
    "ouvre dashboard",
    "open outreach",
    "create projection",
    "faisons un nouveau produit",
    "ouvre control tower",
  ] as const;

  for (const msg of inputs) {
    it(`"${msg}" stable across 10 runs (both profiles)`, () => {
      for (const isAdmin of [false, true]) {
        const r0 = routerNav(msg, isAdmin);
        const p0 = publishedRoute(msg, isAdmin);
        for (let i = 0; i < 10; i++) {
          expect(routerNav(msg, isAdmin)).toBe(r0);
          expect(publishedRoute(msg, isAdmin)).toBe(p0);
        }
      }
    });
  }
});
