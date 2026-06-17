import { describe, expect, it } from "vitest";

import {
  ADMIN_JUMP_NAV,
  ADMIN_SECTIONS,
  INVESTOR_VIEW_NAV,
  adminSectionToNavItem,
  matchesNavPath,
  visibleSubNavTabs,
} from "@/components/nav/product-nav-items";

describe("matchesNavPath", () => {
  it("matches exact and nested admin routes only", () => {
    expect(matchesNavPath("/admin/proof-center", "/admin/proof-center")).toBe(true);
    expect(matchesNavPath("/admin/proof-center/logs", "/admin/proof-center")).toBe(true);
    expect(matchesNavPath("/admin/proofs", "/admin/proof-center")).toBe(false);
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
    expect(visible).toEqual([
      "dashboard-overview",
      "customers",
      "agents",
      "outreach",
      "feedback",
    ]);
  });
});
