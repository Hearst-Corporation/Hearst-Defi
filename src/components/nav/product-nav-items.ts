/**
 * product-nav-items.ts
 *
 * Source de vérité pour la navigation intra-app de Hearst Connect.
 * Consommé par :
 *   - (product)/layout.tsx  → nav custom dans le rail gauche (slot .ct-rail-left-intra)
 *   - admin/layout.tsx      → rail admin (ADMIN_NAV + séparateur + ANALYTICS_NAV)
 *
 * NOTE : Le RailLeft de @hearst/cockpit-shell ne supporte PAS de prop nav
 * intra-app (API v0.1.0). La nav intra est composée dans les layouts au-dessus
 * du spacer du rail, en utilisant usePathname() côté client.
 */

export type NavItem = {
  id: string;
  label: string;
  href: string;
  /** Nom de l'icône Lucide React (string pour éviter l'import ici — data only). */
  icon: string;
};

/**
 * Investor-facing navigation. A signed-in user only sees their own space:
 * their portfolio, the vaults they can invest in, their profile, and the
 * public proof center. Operator/analyst surfaces live in the admin rail.
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
    label: "Invest",
    href: "/vaults",
    icon: "Vault",
  },
  {
    id: "profile",
    label: "Profile",
    href: "/profile",
    icon: "User",
  },
  {
    id: "proof-center",
    label: "Proofs & Documents",
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

export const ADMIN_SECTIONS: AdminSection[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: "LayoutDashboard",
    href: "/admin/dashboard",
    tabs: [],
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
    id: "investors",
    label: "Investors",
    icon: "Users",
    href: "/admin/customers",
    tabs: [
      { id: "customers", label: "Customers", href: "/admin/customers", icon: "Users" },
      { id: "feedback", label: "Feedback", href: "/admin/feedback", icon: "MessageSquare" },
    ],
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: "FlaskConical",
    href: "/admin/scenario-lab",
    tabs: [
      { id: "scenario-lab", label: "Scenario Lab", href: "/admin/scenario-lab", icon: "FlaskConical" },
      { id: "projection", label: "Projection", href: "/admin/projection", icon: "FlaskConical" },
      { id: "investor-memo", label: "Investor Memo", href: "/admin/investor-memo", icon: "FileText" },
    ],
  },
  {
    id: "proof-system",
    label: "Proof & System",
    icon: "ShieldCheck",
    href: "/admin/proof-center",
    tabs: [
      { id: "proof-center", label: "Proof Center", href: "/admin/proof-center", icon: "ShieldCheck" },
      { id: "proofs", label: "Proofs", href: "/admin/proofs", icon: "FileCheck" },
      { id: "monitoring", label: "Monitoring", href: "/admin/monitoring", icon: "Settings2" },
      { id: "spec", label: "Spec", href: "/admin/spec", icon: "BookOpen" },
      { id: "roadmap", label: "Roadmap", href: "/admin/roadmap", icon: "FileCheck" },
    ],
  },
];
