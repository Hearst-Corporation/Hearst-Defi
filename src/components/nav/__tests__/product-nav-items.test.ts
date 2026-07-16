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

describe("strategy sub-nav — retired scenario/projection routes", () => {
  const strategy = ADMIN_SECTIONS.find((s) => s.id === "strategy");

  it("no longer exposes the retired projection / scenario-lab tabs", () => {
    const ids = strategy!.tabs.map((t) => t.id);
    expect(ids).not.toContain("projection");
    expect(ids).not.toContain("scenario-lab");
    expect(ids).not.toContain("projection-preview");
    expect(strategy!.tabs.some((t) => t.href === "/admin/projection")).toBe(false);
    expect(strategy!.tabs.some((t) => t.href === "/admin/scenario-lab")).toBe(false);
    expect(strategy!.tabs.some((t) => t.href === "/admin/projection/preview")).toBe(false);
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
      href: "/dashboard",
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
    expect(visible).not.toContain("agent-canvas");
    // The former Agent Library + Model Bench tabs were removed (their routes are
    // deleted). Agent orchestration now lives on an external platform; the single
    // "agentic" tab survives as an "Agents" placeholder slot.
    expect(visible).toEqual([
      "dashboard-overview",
      "customers",
      "agentic",
      "outreach",
      "feedback",
    ]);
  });

  it("keeps the single Agents placeholder tab (Agent Library + Model Bench removed)", () => {
    const dashboard = ADMIN_SECTIONS.find((s) => s.id === "dashboard");
    const agentic = dashboard!.tabs.find((t) => t.id === "agentic");
    // The placeholder slot: agent orchestration moved to an external platform.
    expect(agentic?.label).toBe("Agents");
    expect(agentic?.href).toBe("/admin/agentic");
    // The distinct Agent Library / Model Bench tabs are gone — their routes were
    // deleted, so no dashboard tab may point at them.
    expect(dashboard!.tabs.find((t) => t.id === "agents")).toBeUndefined();
    expect(dashboard!.tabs.find((t) => t.id === "model-bench")).toBeUndefined();
    expect(dashboard!.tabs.some((t) => t.href === "/admin/agents")).toBe(false);
    expect(dashboard!.tabs.some((t) => t.href === "/admin/model-bench")).toBe(false);
  });
});
