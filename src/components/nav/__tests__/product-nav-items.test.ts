import { describe, expect, it } from "vitest";

import {
  ADMIN_JUMP_NAV,
  ADMIN_SECTIONS,
  INVESTOR_VIEW_NAV,
  PRODUCT_NAV,
  adminSectionToNavItem,
  matchesNavPath,
  visibleSubNavTabs,
} from "@/components/nav/product-nav-items";

const UNWIRED_PORTFOLIO_LEAVES = [
  "/portfolio/positions",
  "/portfolio/activity",
  "/portfolio/distributions",
  "/portfolio/yield",
  "/portfolio/tax",
] as const;

describe("PRODUCT_NAV — unwired portfolio leaves", () => {
  it("does not expose blank portfolio sub-leaves in the investor rail", () => {
    for (const item of PRODUCT_NAV) {
      for (const leaf of UNWIRED_PORTFOLIO_LEAVES) {
        expect(item.href).not.toBe(leaf);
        expect(item.href.startsWith(`${leaf}/`)).toBe(false);
      }
    }
  });
});

describe("matchesNavPath", () => {
  it("matches exact and nested admin routes only", () => {
    expect(matchesNavPath("/admin/proof-center", "/admin/proof-center")).toBe(true);
    expect(matchesNavPath("/admin/proof-center/logs", "/admin/proof-center")).toBe(true);
    expect(matchesNavPath("/admin/proofs", "/admin/proof-center")).toBe(false);
  });
});

describe("strategy sub-nav — projection menu simplification", () => {
  const strategy = ADMIN_SECTIONS.find((s) => s.id === "strategy");

  it("Projection stays a visible sub-nav destination", () => {
    const visible = visibleSubNavTabs(strategy!.tabs).map((t) => t.id);
    expect(visible).toContain("projection");
  });

  it("Projection Preview is hidden from the sub-nav (route kept reachable)", () => {
    const visible = visibleSubNavTabs(strategy!.tabs).map((t) => t.id);
    expect(visible).not.toContain("projection-preview");
    // route still defined (not deleted)
    const tab = strategy!.tabs.find((t) => t.id === "projection-preview");
    expect(tab?.href).toBe("/admin/projection/preview");
    expect(tab?.hideFromSubNav).toBe(true);
  });

  it("Scenario Lab is sandbox/internal — hidden from sub-nav, route kept", () => {
    const visible = visibleSubNavTabs(strategy!.tabs).map((t) => t.id);
    expect(visible).not.toContain("scenario-lab");
    const tab = strategy!.tabs.find((t) => t.id === "scenario-lab");
    expect(tab?.href).toBe("/admin/scenario-lab");
    expect(tab?.hideFromSubNav).toBe(true);
  });

  it("Preview label is clearly a demo, not a normal product page", () => {
    const tab = strategy!.tabs.find((t) => t.id === "projection-preview");
    expect(tab?.label.toLowerCase()).toContain("demo");
  });
});

describe("adminSectionToNavItem", () => {
  it("derives the admin rail entry shape from a section", () => {
    const strategy = ADMIN_SECTIONS.find((section) => section.id === "strategy");
    expect(strategy).toBeDefined();
    expect(adminSectionToNavItem(strategy!)).toEqual({
      id: "strategy",
      label: "Strategy",
      href: "/admin/product-workspace",
      icon: "FlaskConical",
    });
  });
});

describe("cross-zone rail entries", () => {
  it("keeps the investor-to-admin jump distinct from dashboard wording", () => {
    expect(ADMIN_JUMP_NAV).toBeTruthy();
    expect(ADMIN_JUMP_NAV?.label).toBe("Admin");
    expect(ADMIN_JUMP_NAV?.href).toBe("/admin/dashboard");
  });

  it("keeps the admin back link pinned to the investor cockpit", () => {
    expect(INVESTOR_VIEW_NAV).toEqual({
      id: "back-to-app",
      label: "Investor view",
      href: "/portfolio",
      icon: "ArrowLeft",
    });
  });
});

describe("visibleSubNavTabs", () => {
  it("hides operator-only dashboard tabs from the horizontal strip", () => {
    const dashboard = ADMIN_SECTIONS.find((s) => s.id === "dashboard");
    expect(dashboard).toBeDefined();

    const visible = visibleSubNavTabs(dashboard!.tabs).map((t) => t.id);
    expect(visible).not.toContain("onboarding-test");
    // Agentic Console (the visual control center) leads, then the Agent Library.
    expect(visible).toEqual([
      "dashboard-overview",
      "customers",
      "agentic",
      "agents",
      "outreach",
      "feedback",
    ]);
  });

  it("labels Agentic Console + Agent Library distinctly (no two 'Bot' duplicates)", () => {
    const dashboard = ADMIN_SECTIONS.find((s) => s.id === "dashboard");
    const agentic = dashboard!.tabs.find((t) => t.id === "agentic");
    const agents = dashboard!.tabs.find((t) => t.id === "agents");
    expect(agentic?.label).toBe("Agentic Console");
    expect(agentic?.href).toBe("/admin/agentic");
    expect(agents?.label).toBe("Agent Library");
    expect(agents?.href).toBe("/admin/agents");
    // Distinct icons so the two are not confusing.
    expect(agentic?.icon).not.toBe(agents?.icon);
  });
});
