/**
 * Navigation tool + destination whitelist for the LP-facing Master Agent.
 *
 * The conversational assistant can guide the user by navigating to the right
 * page. To keep that capability SAFE on an institutional product:
 *  - The model never emits a free-form URL. It picks a `key` from a closed
 *    enum (`NAV_DESTINATIONS`), which the server maps to a real route. The
 *    model cannot invent or reach an arbitrary/admin route.
 *  - This is the ONLY tool the agent has. There is no write / financial /
 *    admin tool — navigation is a client-side, read-only route change.
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
  /** Human label (FR) shown in the navigation toast. */
  label: string;
  /** What the model reads to decide whether this destination fits. */
  description: string;
}

/**
 * LP destinations only. Detail pages with a dynamic `[id]` are excluded (the
 * model has no id to fill), as are admin/debug routes.
 */
export const LP_NAV_DESTINATIONS: readonly NavDestination[] = [
  {
    key: "portfolio",
    profile: "lp",
    route: "/portfolio",
    label: "Portefeuille",
    description:
      "Tableau de bord du portefeuille de l'investisseur : valeur, rendement YTD, prochaine distribution, allocation, positions.",
  },
  {
    key: "vaults",
    profile: "lp",
    route: "/vaults",
    label: "Produits",
    description:
      "Liste des produits / vaults disponibles à la souscription (point de départ d'un dépôt).",
  },
  {
    key: "proof-center",
    profile: "lp",
    route: "/proof-center",
    label: "Proof Center",
    description:
      "Preuve de réserves, événements on-chain, attestations, distributions, statut d'audit et version de méthodologie.",
  },
  {
    key: "profile",
    profile: "lp",
    route: "/profile",
    label: "Profil",
    description:
      "Profil et préférences du compte : email, wallet, statut KYC, positions actives.",
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
      "Page indépendante générée depuis l'intention agent pour cadrer un nouveau produit: décision, graph specs, notes de calcul, hypothèses et garde-fous.",
  },
  {
    key: "admin-scenario-lab",
    profile: "admin",
    route: "/admin/scenario-lab",
    label: "Admin Scenario Lab",
    description:
      "Laboratoire de scénarios et stress tests pour un produit déjà cadré: paramètres moteur, hypothèses et runbook de simulation.",
  },
  {
    key: "admin-dashboard",
    profile: "admin",
    route: "/admin/dashboard",
    label: "Admin Dashboard",
    description:
      "Tableau de bord admin: monitoring, alerts, état opérationnel.",
  },
  {
    key: "admin-vaults",
    profile: "admin",
    route: "/admin/vaults",
    label: "Admin Vaults",
    description:
      "Gestion des vaults: création, édition, statut, paramètres et gouvernance.",
  },
  {
    key: "admin-proofs",
    profile: "admin",
    route: "/admin/proofs",
    label: "Admin Proofs",
    description:
      "Attestations, proofs, publications et cohérence des evidences.",
  },
  {
    key: "admin-governance",
    profile: "admin",
    route: "/admin/governance",
    label: "Admin Governance",
    description:
      "Propositions, signatures, timelock et suivi des décisions de gouvernance.",
  },
  {
    key: "admin-roadmap",
    profile: "admin",
    route: "/admin/roadmap",
    label: "Admin Roadmap",
    description:
      "Suivi d'exécution produit/technique, validations et blocages.",
  },
  {
    key: "admin-projection",
    profile: "admin",
    route: "/admin/projection",
    label: "Admin Projection",
    description:
      "Projections/scénarios internes et analyses de risques opérationnels.",
  },
] as const;

export const NAV_DESTINATIONS: readonly NavDestination[] = [
  ...LP_NAV_DESTINATIONS,
  ...ADMIN_NAV_DESTINATIONS,
] as const;

/** Closed enum of destination keys exposed to the model by profile. */
export function getNavKeys(profile: NavProfile): readonly string[] {
  return NAV_DESTINATIONS.filter((d) => d.profile === profile).map((d) => d.key);
}

/**
 * OpenAI Chat Completions function tool. The single, read-only capability of
 * the Master Agent.
 */
export function createNavigateTool(profile: NavProfile) {
  const keys = getNavKeys(profile);
  return {
    type: "function" as const,
    function: {
      name: "navigate",
      description:
        profile === "admin"
          ? "Amène l'utilisateur admin à la surface interne la plus pertinente (product workspace, scenario lab, dashboard, vaults, proofs, governance, roadmap, projection). Pour toute demande de création/cadrage d'un nouveau produit, privilégie admin-product-workspace comme page indépendante. Utilise admin-scenario-lab uniquement pour des simulations/stress tests d'un produit déjà cadré. Continue TOUJOURS de répondre en texte aussi. Ne choisis QUE dans l'énumération, n'invente jamais de destination."
          : "Amène l'utilisateur à la page la plus pertinente de Hearst Connect quand ta réponse renvoie à une surface précise (portefeuille, produits, proof center, profil) — par exemple « où vois-je mon allocation ? », « comment souscrire ? », ou pour appuyer une explication par la bonne page. Continue TOUJOURS de répondre en texte aussi. Ne choisis QUE dans l'énumération, n'invente jamais de destination.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          destination: {
            type: "string",
            enum: [...keys],
            description: "La destination à ouvrir.",
          },
        },
        required: ["destination"],
      },
    },
  } as const;
}

/** Maps a model-supplied key back to its destination, or null when unknown. */
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
