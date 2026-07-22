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
