import { describe, expect, it } from "vitest";

import {
  ADMIN_SECTIONS,
  visibleSubNavTabs,
} from "@/components/nav/product-nav-items";

/**
 * Admin sub-nav href contract guard.
 *
 * A section's landing `href` MUST equal its FIRST tab's href so that landing on
 * the section route lights up the leading tab in <AdminSubNav>. A mismatch (the
 * historic "Proof & System" bug: section href /admin/proof-center vs first tab
 * /admin/proofs) silently breaks the active-tab highlight. This guard locks the
 * invariant for every admin section, present and future.
 */
describe("admin section sub-nav href contract", () => {
  it("every section has at least one tab", () => {
    for (const section of ADMIN_SECTIONS) {
      expect(section.tabs.length).toBeGreaterThan(0);
    }
  });

  it("every section href equals its first tab href", () => {
    for (const section of ADMIN_SECTIONS) {
      const firstTab = section.tabs[0];
      expect(firstTab).toBeDefined();
      expect(section.href).toBe(firstTab!.href);
    }
  });

  it("the first tab is always visible in the sub-nav (it's the landing/Overview tab)", () => {
    for (const section of ADMIN_SECTIONS) {
      const firstTab = section.tabs[0];
      const visible = visibleSubNavTabs(section.tabs);
      // The leading tab must be visible — otherwise the section lands on a tab the
      // strip never shows and the active highlight has nothing to anchor to.
      expect(visible[0]?.id).toBe(firstTab!.id);
    }
  });

  it("Proof & System lands on its first tab (/admin/proofs), fixing the contract break", () => {
    const proof = ADMIN_SECTIONS.find((s) => s.id === "proof-system");
    expect(proof).toBeDefined();
    expect(proof!.href).toBe("/admin/proofs");
    expect(proof!.tabs[0]!.href).toBe("/admin/proofs");
  });
});
