import { describe, expect, it } from "vitest";

import {
  ADMIN_SECTIONS,
  visibleSubNavTabs,
} from "@/components/nav/product-nav-items";

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
