/**
 * Navigation destination whitelist for the cockpit.
 *
 * Navigation is now 100% deterministic: the regex router (resolveNavFallbackDestinationKey)
 * in the cockpit-chat route resolves the destination BEFORE any LLM turn. The
 * model is NEVER given a navigate tool — it cannot propose destinations. This
 * module provides the closed whitelist (NAV_DESTINATIONS, LP_/ADMIN_NAV_DESTINATIONS)
 * and the resolvers (resolveNavDestination, resolveNavDestinationForProfile,
 * isProtectedRoute) that the deterministic router and the client nav bridge use.
 *
 * Pure module (no I/O, no server-only) so both the server handler and the
 * client navigation bridge import the SAME whitelist — one source of truth.
 */

export type NavProfile = "lp" | "admin";

export interface NavDestination {
  /** Closed enum value the model selects. */
  key: string;
  /** Profile gate for this destination set. */
  profile: NavProfile;
  /** The SPA route the client pushes. LP-facing list/landing pages only. */
  route: string;
  /** Human label shown in the navigation toast. */
  label: string;
  /** What the model reads to decide whether this destination fits. */
  description: string;
}

/**
 * LP destinations — every static investor-facing page of the site.
 *
 * Excluded by design: dynamic detail pages (`/portfolio/[positionId]`,
 * `/vaults/[id]`) — the model has no id to fill; in-progress flows guarded by
 * `isProtectedRoute` (onboarding, deposit) — landing mid-flow is handled
 * separately; pre-auth pages (login, reset-password) — nonsensical for an
 * authenticated user; and admin/debug/sandbox routes.
 */
export const LP_NAV_DESTINATIONS: readonly NavDestination[] = [
  {
    key: "overview",
    profile: "lp",
    route: "/dashboard",
    label: "Overview",
    description:
      "Reserve Vault overview — the investor landing page: total assets, mining register, capital architecture and vault status.",
  },
  {
    key: "portfolio",
    profile: "lp",
    route: "/portfolio",
    label: "Portfolio",
    description:
      "Investor portfolio dashboard: value, YTD return, next distribution, allocation, positions.",
  },
  // The portfolio sub-leaves (positions / activity / distributions / yield / tax)
  // are intentionally NOT chat-navigable destinations: the leaf pages are unwired
  // stubs, so the chat must never route an investor to a blank surface. The routes
  // still exist — re-add a destination here only once a leaf renders real data.
  {
    key: "vaults",
    profile: "lp",
    route: "/vaults",
    label: "Products / Vaults",
    description:
      "List of products / vaults available for subscription (starting point for a deposit).",
  },
  {
    key: "proof-center",
    profile: "lp",
    route: "/proof-center",
    label: "Proof Center",
    description:
      "Proof of reserves, on-chain events, attestations, distributions, audit status and methodology version.",
  },
  {
    key: "proof-center-full",
    profile: "lp",
    route: "/proof-center/full",
    label: "Proof Center — Full view",
    description:
      "Exhaustive proof center view: the full history of proofs, attestations and events.",
  },
  {
    key: "profile",
    profile: "lp",
    route: "/profile",
    label: "Profile",
    description:
      "Account profile and preferences: email, wallet, KYC status, active positions.",
  },
  {
    key: "legal",
    profile: "lp",
    route: "/legal",
    label: "Legal notices",
    description: "Index of legal documents: disclaimer, privacy, terms.",
  },
  {
    key: "legal-disclaimer",
    profile: "lp",
    route: "/legal/disclaimer",
    label: "Legal — Disclaimer",
    description: "Legal warning / product disclaimer (not guaranteed, risks).",
  },
  {
    key: "legal-privacy",
    profile: "lp",
    route: "/legal/privacy",
    label: "Legal — Privacy",
    description: "Privacy policy and data processing.",
  },
  {
    key: "legal-terms",
    profile: "lp",
    route: "/legal/terms",
    label: "Legal — Terms",
    description: "Terms of use of the service.",
  },
  {
    key: "lp-agent-canvas",
    profile: "lp",
    route: "/agent-canvas",
    label: "Agent Canvas",
    description:
      "Central read-only workspace that the agent fills in live to explain the product (yield sources, assumptions, risks). The canvasId specifies which workshop to open. No write action.",
  },
] as const;

/** Admin destinations (internal ops surfaces). */
export const ADMIN_NAV_DESTINATIONS: readonly NavDestination[] = [
  {
    key: "admin-product-workspace",
    profile: "admin",
    route: "/admin/product-workspace",
    label: "Admin Product Workspace",
    description:
      "Standalone page generated from the agent intent to frame a new product: decision, graph specs, calculation notes, assumptions and guardrails.",
  },
  {
    key: "admin-agent-canvas",
    profile: "admin",
    route: "/admin/agent-canvas",
    label: "Agent Canvas",
    description:
      "Central workspace that the agent fills in live (sections, fields, HITL action proposals) to frame a product or an outreach campaign. The canvasId specifies which workshop to open. Admin only (gated by the /admin layout).",
  },
  {
    key: "admin-dashboard",
    profile: "admin",
    route: "/admin/dashboard",
    label: "Admin Dashboard",
    description:
      "Admin dashboard: monitoring, alerts, operational status.",
  },
  {
    key: "admin-vaults",
    profile: "admin",
    route: "/admin/vaults",
    label: "Admin Vaults",
    description:
      "Vault management: creation, editing, status, parameters and governance.",
  },
  {
    key: "admin-customers",
    profile: "admin",
    route: "/admin/customers",
    label: "Admin Customers",
    description:
      "Investor / customer management: list, records, KYC, positions and account creation.",
  },
  {
    key: "admin-outreach",
    profile: "admin",
    route: "/admin/outreach",
    label: "Admin Outreach",
    description:
      "Email campaigns and prospecting: drafts, compose, tracked sending (human-in-the-loop).",
  },
  {
    key: "admin-proofs",
    profile: "admin",
    route: "/admin/proofs",
    label: "Admin Proofs",
    description:
      "Attestations, proofs, publications and evidence consistency.",
  },
  {
    key: "admin-governance",
    profile: "admin",
    route: "/admin/governance",
    label: "Admin Governance",
    description:
      "Proposals, signatures, timelock and tracking of governance decisions.",
  },
  {
    key: "admin-roadmap",
    profile: "admin",
    route: "/admin/roadmap",
    label: "Admin Roadmap",
    description:
      "Product/technical execution tracking, validations and blockers.",
  },
  {
    key: "admin-home",
    profile: "admin",
    route: "/admin",
    label: "Admin — Operations (home)",
    description:
      "Admin home / Operations cockpit: entry point for internal surfaces.",
  },
  {
    key: "admin-vaults-new",
    profile: "admin",
    route: "/admin/vaults/new",
    label: "Admin — New vault",
    description: "Form to create a new vault.",
  },
  {
    key: "admin-outreach-compose",
    profile: "admin",
    route: "/admin/outreach/compose",
    label: "Admin — Outreach (compose)",
    description: "Compose an outreach email / message (human-in-the-loop).",
  },
  {
    key: "admin-proof-center",
    profile: "admin",
    route: "/admin/proof-center",
    label: "Admin — Proof Center",
    description:
      "Admin-side proof center: proof of reserves, attestations, events.",
  },
  {
    key: "admin-proof-center-full",
    profile: "admin",
    route: "/admin/proof-center/full",
    label: "Admin — Proof Center (full)",
    description: "Exhaustive admin proof center view.",
  },
  {
    key: "admin-governance-allowlist",
    profile: "admin",
    route: "/admin/governance/allowlist",
    label: "Admin — Governance (allowlist)",
    description: "Governance allowlist management (authorized addresses).",
  },
  {
    key: "admin-governance-propose",
    profile: "admin",
    route: "/admin/governance/propose",
    label: "Admin — Governance (propose)",
    description: "Create a new governance proposal.",
  },
  {
    key: "admin-audit",
    profile: "admin",
    route: "/admin/audit",
    label: "Admin — Audit",
    description: "Audit log: admin actions, mutations and traceability.",
  },
  {
    key: "admin-distributions",
    profile: "admin",
    route: "/admin/distributions",
    label: "Admin — Distributions",
    description:
      "Historical distributions ledger (legacy records). The v3.0 mining note accumulates BTC and delivers it at maturity — there is no periodic cash distribution to schedule.",
  },
  {
    key: "admin-feedback",
    profile: "admin",
    route: "/admin/feedback",
    label: "Admin — Feedback",
    description: "Feedback collected (customers, internal).",
  },
  {
    key: "admin-investor-memo",
    profile: "admin",
    route: "/admin/investor-memo",
    label: "Admin — Investor Memo",
    description: "Generation and tracking of investor memos.",
  },
  {
    key: "admin-monitoring",
    profile: "admin",
    route: "/admin/monitoring",
    label: "Admin — Monitoring",
    description: "Operational monitoring: system health, jobs, alerts.",
  },
  {
    key: "admin-security",
    profile: "admin",
    route: "/admin/security",
    label: "Admin — Security",
    description: "Security surface: access, roles, sessions, posture.",
  },
  {
    key: "admin-signals",
    profile: "admin",
    route: "/admin/signals",
    label: "Admin — Signals",
    description: "Market / mining signals and internal indicators.",
  },
  {
    key: "admin-spec",
    profile: "admin",
    route: "/admin/spec",
    label: "Admin — Product specs",
    description: "Index of product specs (docs/spec) viewable internally.",
  },
  {
    key: "admin-source",
    profile: "admin",
    route: "/admin/source",
    label: "Admin — Source",
    description:
      "Data source / ingestion (signals, data bricks) viewed admin-side. Visible in the Strategy sub-nav.",
  },
  {
    key: "admin-agentic",
    profile: "admin",
    route: "/admin/agentic",
    label: "Admin — Agents (placeholder)",
    description:
      "Agents placeholder: agent orchestration now lives on an external platform and will be re-integrated here. Visible in the Dashboard rail.",
  },
] as const;

export const NAV_DESTINATIONS: readonly NavDestination[] = [
  ...LP_NAV_DESTINATIONS,
  ...ADMIN_NAV_DESTINATIONS,
] as const;

/** Maps a router-supplied key back to its destination, or null when unknown. */
export function resolveNavDestination(
  key: string | null | undefined,
): NavDestination | null {
  if (!key) return null;
  return NAV_DESTINATIONS.find((d) => d.key === key) ?? null;
}

/** Profile-scoped destination resolver (prevents cross-profile key usage). */
export function resolveNavDestinationForProfile(
  key: string | null | undefined,
  profile: NavProfile,
): NavDestination | null {
  if (!key) return null;
  return NAV_DESTINATIONS.find((d) => d.key === key && d.profile === profile) ?? null;
}

/**
 * Routes where auto-navigation must NOT yank the user away — an in-progress
 * form/flow. On these the client bridge degrades to a non-intrusive suggestion
 * instead of pushing the route.
 *
 * `currentPath` is normalized first — the query string and a trailing slash are
 * stripped — so a flow stays protected regardless of `?step=2` or a trailing
 * `/`. The onboarding check is segment-anchored (`/onboarding` or
 * `/onboarding/...`) so a sibling like `/onboarding-complete` is NOT mistaken
 * for an in-progress onboarding step.
 */
export function isProtectedRoute(currentPath: string): boolean {
  const path = normalizePath(currentPath);
  return (
    /^\/vaults\/[^/]+\/invest(\/|$)/.test(path) || // deposit flow
    path === "/onboarding" ||
    path.startsWith("/onboarding/") ||
    path === "/totp-challenge"
  );
}

/** Strips the query string and a single trailing slash (root `/` preserved). */
function normalizePath(currentPath: string): string {
  const queryStart = currentPath.search(/[?#]/);
  const withoutQuery =
    queryStart === -1 ? currentPath : currentPath.slice(0, queryStart);
  if (withoutQuery.length > 1 && withoutQuery.endsWith("/")) {
    return withoutQuery.slice(0, -1);
  }
  return withoutQuery;
}
