/**
 * product-nav-items.ts
 *
 * Source de vérité pour la navigation intra-app de Hearst Connect.
 * Consommé par :
 *   - product-rail-intra.tsx → InvestorRailIntra (PRODUCT_NAV) + AdminRailIntra
 *     (une entrée rail par section de ADMIN_SECTIONS + séparateur + retour app).
 *   - admin-sub-nav.tsx      → AdminSubNav (sous-onglets de la section active).
 *
 * NOTE : Le RailLeft de @hearst/cockpit-shell ne supporte PAS de prop nav
 * intra-app (API v0.1.0). La nav intra est composée dans les layouts au-dessus
 * du spacer du rail, en utilisant usePathname() côté client.
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
 * Investor-facing navigation. A signed-in user sees the main cockpit routes:
 * portfolio, invest, and proof center. Profile/settings stay behind the user
 * badge instead of duplicating a top-level rail entry. Operator/analyst
 * surfaces live in the admin rail.
 */
export const PRODUCT_NAV: NavItem[] = [
  {
    id: "portfolio",
    label: "Portfolio",
    href: "/portfolio",
    icon: "Wallet",
  },
  {
    id: "vaults",
    label: "Vaults",
    href: "/vaults",
    icon: "Vault",
  },
  {
    id: "proof-center",
    label: "Proofs & Documents",
    railLabel: "Proofs",
    href: "/proof-center",
    icon: "ShieldCheck",
  },
];

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
      { id: "agents", label: "Agents", href: "/admin/agents", icon: "Bot" },
      { id: "agentic", label: "Agentic", href: "/admin/agentic", icon: "Bot" },
      { id: "outreach", label: "Outreach", href: "/admin/outreach", icon: "Send" },
      { id: "onboarding-test", label: "Onboarding test", href: "/admin/onboarding-test", icon: "ClipboardCheck", hideFromSubNav: true },
      { id: "feedback", label: "Feedback", href: "/admin/feedback", icon: "MessageSquare" },
    ],
  },
  {
    id: "strategy",
    label: "Strategy",
    icon: "FlaskConical",
    href: "/admin/product-workspace",
    tabs: [
      { id: "product-workspace", label: "Overview", href: "/admin/product-workspace", icon: "FileText" },
      { id: "scenario-lab", label: "Scenario Lab", href: "/admin/scenario-lab", icon: "FlaskConical" },
      { id: "projection", label: "Projection", href: "/admin/projection", icon: "FileText" },
    ],
  },
  {
    id: "vaults",
    label: "Vaults",
    icon: "Vault",
    href: "/admin/vaults",
    tabs: [
      { id: "vaults-overview", label: "Overview", href: "/admin/vaults", icon: "Vault" },
      { id: "distributions", label: "Distributions", href: "/admin/distributions", icon: "FileText" },
      { id: "rebalancing", label: "Rebalancing", href: "/admin/signals", icon: "Zap" },
    ],
  },
  {
    id: "proof-system",
    label: "Proof & System",
    icon: "ShieldCheck",
    href: "/admin/proof-center",
    tabs: [
      { id: "proof-system-overview", label: "Overview", href: "/admin/proof-center", icon: "ShieldCheck" },
      { id: "proofs", label: "Proofs", href: "/admin/proofs", icon: "FileCheck" },
      { id: "monitoring", label: "Monitoring", href: "/admin/monitoring", icon: "Settings2" },
      { id: "security", label: "Security", href: "/admin/security", icon: "ShieldCheck" },
      { id: "governance", label: "Governance", href: "/admin/governance", icon: "Scale" },
      { id: "allowlist", label: "Allowlist", href: "/admin/governance/allowlist", icon: "Users" },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    icon: "FileText",
    href: "/admin/roadmap",
    tabs: [
      { id: "operations-overview", label: "Overview", href: "/admin/roadmap", icon: "FileText" },
      { id: "spec", label: "Spec", href: "/admin/spec", icon: "FileCheck" },
      { id: "investor-memo", label: "Investor Memo", href: "/admin/investor-memo", icon: "FileText" },
      { id: "audit", label: "Audit Log", href: "/admin/audit", icon: "FileCheck" },
      { id: "design-system", label: "Design System", href: "/admin/design-system", icon: "FileText" },
    ],
  },
];

/** Exact route or nested route match for left rail / sub-nav highlighting. */
export function matchesNavPath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Shared shape for rail entries derived from the admin section catalog. */
export function adminSectionToNavItem(
  section: AdminSection,
  labelOverride?: string,
): NavItem {
  return {
    id: section.id,
    label: labelOverride ?? section.label,
    href: section.href,
    icon: section.icon,
  };
}

const dashboardSection = ADMIN_SECTIONS.find((section) => section.id === "dashboard");

export const ADMIN_JUMP_NAV = dashboardSection
  ? adminSectionToNavItem(dashboardSection, "Admin")
  : null;

export const INVESTOR_VIEW_NAV: NavItem = {
  id: "back-to-app",
  label: "Investor view",
  href: "/portfolio",
  icon: "ArrowLeft",
};

/** Tabs shown in <AdminSubNav> (operator-only routes may stay out of the strip). */
export function visibleSubNavTabs(tabs: NavItem[]): NavItem[] {
  return tabs.filter((tab) => !tab.hideFromSubNav);
}
