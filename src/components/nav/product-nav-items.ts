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
 * Investor-facing navigation — Bitcoin Strategic Reserve reposition (nav V2).
 *
 * Hearst Connect is repositioning from a structured-yield vault product to an
 * institutional Bitcoin Strategic Reserve platform powered by Mining-as-a-
 * Service. Bitcoin becomes the hero KPI; yield/APY drops to a secondary
 * metric. The 10-item target IA (Dashboard, Bitcoin Reserve, Vaults, Mining
 * Operations, Infrastructure, Rewards, Withdrawals, Transactions, Reports,
 * Settings) does not fit flat on the 104px rail (built for ~4-5 entries), so
 * it ships as 6 rail entries + 4 folded into sub-nav — same pattern already
 * used by ADMIN_SECTIONS (rail entry + <AdminSubNav> tabs), not a new
 * mechanism. `visibleSubNavTabs` below already filters `hideFromSubNav`
 * leaves out of the strip while the route stays reachable.
 *
 * Routing note: "Dashboard" → `/portfolio` (the SAME repositioned page, not a
 * fork — the investor's real financial dashboard, now BTC-hero framed).
 * "Bitcoin Reserve", "Mining Operations", "Infrastructure", "Rewards",
 * "Withdrawals", "Transactions", "Reports" are new routes shipped as honest
 * placeholders (EmptySurface, "being built") pending their data phase — see
 * the plan at ~/.claude/plans/snuggly-churning-sedgewick.md. "Vaults" →
 * `/vaults` (unchanged — the shipped subscribe/fundraising catalog). "Vault"
 * (holdings, `/my-vaults`) is folded under Bitcoin Reserve's sub-nav rather
 * than kept as its own rail slot, since Reserve is now the umbrella surface
 * for BTC holdings + positions. "Settings" → `/profile` (label renamed,
 * route unchanged so KYC/wallet/identity content stays put).
 *
 * The mock V4 vault-health console lives at `/portfolio/preview`
 * (see `src/app/(product)/portfolio/preview/_data/mock.ts`) — a sandbox,
 * deliberately off the rail, reachable only by direct URL.
 */
export const PRODUCT_NAV: NavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/portfolio",
    icon: "LayoutDashboard",
  },
  {
    id: "bitcoin-reserve",
    label: "Bitcoin Reserve",
    railLabel: "Reserve",
    href: "/bitcoin-reserve",
    icon: "Bitcoin",
  },
  {
    id: "vaults",
    label: "Vaults",
    href: "/vaults",
    icon: "Vault",
  },
  {
    id: "mining",
    label: "Mining Operations",
    railLabel: "Mining",
    href: "/mining",
    icon: "Pickaxe",
  },
  {
    id: "infrastructure",
    label: "Infrastructure",
    railLabel: "Infra",
    href: "/infrastructure",
    icon: "Server",
  },
  {
    id: "settings",
    label: "Settings",
    href: "/profile",
    icon: "Settings",
  },
];

/**
 * Folded destinations — reachable via sub-nav under the rail entry they
 * belong to, or by direct URL/deep-link, not their own rail slot. Same
 * `hideFromSubNav`-eligible NavItem shape as ADMIN_SECTIONS tabs.
 */
export const PRODUCT_SUBNAV: Record<string, NavItem[]> = {
  "bitcoin-reserve": [
    { id: "holdings", label: "Vault", href: "/my-vaults", icon: "Vault" },
    { id: "rewards", label: "Rewards", href: "/rewards", icon: "Gift" },
    { id: "withdrawals", label: "Withdrawals", href: "/withdrawals", icon: "ArrowUpFromLine" },
  ],
  dashboard: [
    { id: "transactions", label: "Transactions", href: "/transactions", icon: "ArrowLeftRight" },
    { id: "reports", label: "Reports", href: "/reports", icon: "FileBarChart" },
  ],
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
      // Agent orchestration now lives on an external platform; this is the placeholder slot where it will be re-integrated.
      { id: "agentic", label: "Agents", railLabel: "Agents", href: "/admin/agentic", icon: "Workflow" },
      { id: "outreach", label: "Outreach", href: "/admin/outreach", icon: "Send" },
      { id: "onboarding-test", label: "Onboarding test", href: "/admin/onboarding-test", icon: "ClipboardCheck", hideFromSubNav: true },
      // Agent Canvas = the live workspace the agent fills in to frame a product
      // or outreach campaign (canvasId picks the workshop). Reachable by URL /
      // agent action, not a destination an operator browses to directly.
      { id: "agent-canvas", label: "Agent Canvas", href: "/admin/agent-canvas", icon: "Workflow", hideFromSubNav: true },
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
      { id: "strategies", label: "Strategies", href: "/admin/strategies", icon: "SlidersHorizontal" },
      { id: "marketplace", label: "Marketplace", href: "/admin/marketplace", icon: "TrendingUp" },
      { id: "source", label: "Source", href: "/admin/source", icon: "Database" },
      { id: "projection", label: "Projection", href: "/admin/projection", icon: "FileText" },
      // Scenario Lab = sandbox/exploration interne. Route conservée, mais retirée
      // du sub-nav principal pour ne pas concurrencer Projection (destination
      // officielle). Atteignable par URL / lien interne.
      { id: "scenario-lab", label: "Scenario Lab", href: "/admin/scenario-lab", icon: "FlaskConical", hideFromSubNav: true },
      // Projection Preview = aperçu rapport démo (fixture), PAS une page produit
      // normale. Retirée du menu, route conservée. Label clarifié.
      { id: "projection-preview", label: "Investor Report Preview — Demo Fixture", railLabel: "Preview", href: "/admin/projection/preview", icon: "Eye", hideFromSubNav: true },
      // Read-only product documentation page for the committed BTC product
      // (src/lib/products/*) — not a workspace/editor, not a nav destination.
      { id: "btc-mining-performance-vault", label: "BTC Mining Performance Vault", railLabel: "BTC Vault", href: "/admin/products/btc-mining-performance-vault", icon: "FileText", hideFromSubNav: true },
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
