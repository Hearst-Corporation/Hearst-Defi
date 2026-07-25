/**
 * product-nav-items.ts
 *
 * Source de vérité pour la navigation ADMIN de Hearst Connect.
 * Consommé par :
 *   - kyc-app-shell.tsx  → rail admin (une entrée par section de ADMIN_SECTIONS).
 *   - admin-sub-nav.tsx  → AdminSubNav (sous-onglets de la section active).
 *   - Series1Nav.tsx     → matchesNavPath uniquement (le rail investisseur vit
 *     dans src/components/series1-shell/Series1Nav.tsx, pas ici).
 *
 * L'ancien PRODUCT_NAV investisseur (7 entrées, /btc, /mining…) et le rail
 * intra product-rail-intra.tsx ont été supprimés : les routes pliées sont des
 * redirects et le rail investisseur est SERIES1_NAV.
 */

export type NavItem = {
  id: string;
  label: string;
  /** Short label for the narrow left rail (under the icon). Falls back to `label`.
   *  Keeps multi-word page titles from wrapping to 2 lines in the rail. */
  railLabel?: string;
  href: string;
  /** Nom de l'icône Lucide React (string pour éviter l'import ici — data only). */
  icon: string;
  /** Hide from horizontal sub-nav; route stays reachable (operator / dev tools). */
  hideFromSubNav?: boolean;
};

/**
 * Admin sections — the 5 top-level groups shown in the admin rail. Each owns a
 * horizontal sub-nav of its sibling pages, rendered at the top of the content
 * area by <AdminSubNav>. `href` is the section's default landing page (its
 * first tab). A section with ≤1 tab renders no sub-nav.
 *
 * This is the single source for the admin rail (AdminRailIntra) AND the
 * in-page sub-nav (AdminSubNav).
 */
export type AdminSection = {
  id: string;
  label: string;
  icon: string;
  /** Default landing route (= first tab's href). */
  href: string;
  tabs: NavItem[];
};

/**
 * Strategy OS nav — full admin surface for RWA vault operations.
 *
 * Consolidated 2026-06-11 from 7 → 5 rail entries:
 *   - Dashboard absorbs the Investors CRM (Customers · Feedback) as sub-tabs.
 *   - Rebalancing (single page /admin/signals) folded into Vaults.
 *   - Governance (Proposals · Propose · Allowlist) folded into Proof & System.
 *   - New "Operations" section surfaces the previously palette-only tools
 *     (Roadmap · Spec · Investor Memo), so they are reachable from the rail.
 *
 * Sub-nav contract: the section's `href` must equal its FIRST tab's href, so
 * landing on the section route lights up the leading "Overview" tab in
 * <AdminSubNav> whenever the section has multiple sibling views.
 */
export const ADMIN_SECTIONS: AdminSection[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: "LayoutDashboard",
    href: "/admin/dashboard",
    tabs: [
      { id: "dashboard-overview", label: "Overview", href: "/admin/dashboard", icon: "LayoutDashboard" },
      { id: "customers", label: "Investors", href: "/admin/customers", icon: "Users" },
      { id: "feedback", label: "Feedback", href: "/admin/feedback", icon: "MessageSquare" },
    ],
  },
  {
    id: "vaults",
    label: "Vaults",
    icon: "Vault",
    href: "/admin/vaults",
    tabs: [
      { id: "vaults-overview", label: "Overview", href: "/admin/vaults", icon: "Vault" },
      { id: "distributions", label: "Reserve Events", href: "/admin/distributions", icon: "FileText" },
      { id: "rebalancing", label: "Rebalancing", href: "/admin/signals", icon: "Zap" },
    ],
  },
  {
    id: "proof-system",
    label: "Proof & System",
    icon: "ShieldCheck",
    // Sub-nav contract: a section's href MUST equal its first tab's href so the
    // leading tab lights up on landing. The first tab is Proofs (/admin/proofs);
    // the old /admin/proof-center landing broke the highlight. /admin/proof-center
    // stays reachable via the chat whitelist + the /full deep view.
    href: "/admin/proofs",
    tabs: [
      { id: "proofs", label: "Proofs", href: "/admin/proofs", icon: "FileCheck" },
      { id: "monitoring", label: "Monitoring", href: "/admin/monitoring", icon: "Settings2" },
      { id: "security", label: "Security", href: "/admin/security", icon: "ShieldCheck" },
      { id: "governance", label: "Governance", href: "/admin/governance", icon: "Scale" },
      { id: "allowlist", label: "Allowlist", href: "/admin/governance/allowlist", icon: "Users" },
      // Live Diagnostic Center — dry-run health probes across chat/outreach/
      // vault-hitl/projection. Operator tool, reachable by URL, not a nav tab.
      { id: "diagnostics", label: "Live Diagnostics", href: "/admin/diagnostics", icon: "Activity", hideFromSubNav: true },
      { id: "architecture", label: "Architecture", href: "/admin/system/architecture", icon: "Network" },
    ],
  },
];

/** Exact route or nested route match for left rail / sub-nav highlighting. */
export function matchesNavPath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Tabs shown in <AdminSubNav> (operator-only routes may stay out of the strip). */
export function visibleSubNavTabs(tabs: NavItem[]): NavItem[] {
  return tabs.filter((tab) => !tab.hideFromSubNav);
}
