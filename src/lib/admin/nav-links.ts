/**
 * Admin route hrefs derived from `ADMIN_SECTIONS` — avoids hardcoded paths in UI.
 */

import { ADMIN_SECTIONS } from "@/components/nav/product-nav-items";

function tabHref(tabId: string): string {
  for (const section of ADMIN_SECTIONS) {
    const tab = section.tabs.find((t) => t.id === tabId);
    if (tab) return tab.href;
  }
  throw new Error(`[admin/nav-links] Unknown admin tab id: ${tabId}`);
}

/** Canonical admin deep-links used by dashboard surfaces. */
export const adminNavLinks = {
  dashboard: () => tabHref("dashboard-overview"),
  customers: () => tabHref("customers"),
  distributions: () => tabHref("distributions"),
  proofCenter: () => tabHref("proof-center"),
  proofs: () => tabHref("proofs"),
  governance: () => tabHref("governance"),
  signals: () => tabHref("rebalancing"),
  monitoring: () => tabHref("monitoring"),
} as const;
