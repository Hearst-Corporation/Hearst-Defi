import { describe, expect, it } from "vitest";

import {
  ADMIN_SECTIONS,
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

describe("vault admin sub-nav — Series 1 reserve evidence", () => {
  it("labels the retained historical route as Reserve Events", () => {
    const vaults = ADMIN_SECTIONS.find((section) => section.id === "vaults");
    const retainedRoute = vaults?.tabs.find(
      (tab) => tab.href === "/admin/distributions",
    );

    expect(retainedRoute?.label).toBe("Reserve Events");
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
      "feedback",
    ]);
  });

  it("no longer exposes retired agentic/outreach dashboard tabs", () => {
    const dashboard = ADMIN_SECTIONS.find((s) => s.id === "dashboard");
    expect(dashboard!.tabs.find((t) => t.id === "agentic")).toBeUndefined();
    expect(dashboard!.tabs.find((t) => t.id === "outreach")).toBeUndefined();
    expect(dashboard!.tabs.some((t) => t.href === "/admin/agentic")).toBe(false);
    expect(dashboard!.tabs.some((t) => t.href === "/admin/outreach")).toBe(false);
  });
});
