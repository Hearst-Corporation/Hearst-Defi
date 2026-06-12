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

export interface NavDestination {
  /** Closed enum value the model selects. */
  key: string;
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
export const NAV_DESTINATIONS: readonly NavDestination[] = [
  {
    key: "portfolio",
    route: "/portfolio",
    label: "Portefeuille",
    description:
      "Tableau de bord du portefeuille de l'investisseur : valeur, rendement YTD, prochaine distribution, allocation, positions.",
  },
  {
    key: "vaults",
    route: "/vaults",
    label: "Produits",
    description:
      "Liste des produits / vaults disponibles à la souscription (point de départ d'un dépôt).",
  },
  {
    key: "proof-center",
    route: "/proof-center",
    label: "Proof Center",
    description:
      "Preuve de réserves, événements on-chain, attestations, distributions, statut d'audit et version de méthodologie.",
  },
  {
    key: "profile",
    route: "/profile",
    label: "Profil",
    description:
      "Profil et préférences du compte : email, wallet, statut KYC, positions actives.",
  },
] as const;

/** Closed enum of destination keys exposed to the model. */
export const NAV_KEYS: readonly string[] = NAV_DESTINATIONS.map((d) => d.key);

/**
 * OpenAI Chat Completions function tool. The single, read-only capability of
 * the Master Agent.
 */
export const navigateTool = {
  type: "function" as const,
  function: {
    name: "navigate",
    description:
      "Amène l'utilisateur à la page la plus pertinente de Hearst Connect quand ta réponse renvoie à une surface précise (portefeuille, produits, proof center, profil) — par exemple « où vois-je mon allocation ? », « comment souscrire ? », ou pour appuyer une explication par la bonne page. Continue TOUJOURS de répondre en texte aussi. Ne choisis QUE dans l'énumération, n'invente jamais de destination.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        destination: {
          type: "string",
          enum: [...NAV_KEYS],
          description: "La destination à ouvrir.",
        },
      },
      required: ["destination"],
    },
  },
} as const;

/** Maps a model-supplied key back to its destination, or null when unknown. */
export function resolveNavDestination(
  key: string | null | undefined,
): NavDestination | null {
  if (!key) return null;
  return NAV_DESTINATIONS.find((d) => d.key === key) ?? null;
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
