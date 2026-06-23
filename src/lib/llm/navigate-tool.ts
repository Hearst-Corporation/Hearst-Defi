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
    key: "portfolio",
    profile: "lp",
    route: "/portfolio",
    label: "Portefeuille",
    description:
      "Tableau de bord du portefeuille de l'investisseur : valeur, rendement YTD, prochaine distribution, allocation, positions.",
  },
  {
    key: "portfolio-positions",
    profile: "lp",
    route: "/portfolio/positions",
    label: "Portefeuille — Positions",
    description:
      "Détail des positions actives de l'investisseur (par vault / share class).",
  },
  {
    key: "portfolio-activity",
    profile: "lp",
    route: "/portfolio/activity",
    label: "Portefeuille — Activité",
    description:
      "Historique d'activité du compte : souscriptions, distributions, mouvements.",
  },
  {
    key: "portfolio-distributions",
    profile: "lp",
    route: "/portfolio/distributions",
    label: "Portefeuille — Distributions",
    description:
      "Distributions mensuelles USDC reçues et à venir, calendrier et montants.",
  },
  {
    key: "portfolio-yield",
    profile: "lp",
    route: "/portfolio/yield",
    label: "Portefeuille — Rendement",
    description:
      "Décomposition du rendement (YTD, par période), sources et fourchette d'APY.",
  },
  {
    key: "portfolio-tax",
    profile: "lp",
    route: "/portfolio/tax",
    label: "Portefeuille — Fiscalité",
    description:
      "Documents et synthèse fiscale liés aux positions et distributions.",
  },
  {
    key: "vaults",
    profile: "lp",
    route: "/vaults",
    label: "Produits / Vaults",
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
    key: "proof-center-full",
    profile: "lp",
    route: "/proof-center/full",
    label: "Proof Center — Vue complète",
    description:
      "Vue exhaustive du proof center : tout l'historique des preuves, attestations et événements.",
  },
  {
    key: "profile",
    profile: "lp",
    route: "/profile",
    label: "Profil",
    description:
      "Profil et préférences du compte : email, wallet, statut KYC, positions actives.",
  },
  {
    key: "legal",
    profile: "lp",
    route: "/legal",
    label: "Mentions légales",
    description: "Index des documents légaux : disclaimer, confidentialité, conditions.",
  },
  {
    key: "legal-disclaimer",
    profile: "lp",
    route: "/legal/disclaimer",
    label: "Légal — Disclaimer",
    description: "Avertissement légal / disclaimer produit (non garanti, risques).",
  },
  {
    key: "legal-privacy",
    profile: "lp",
    route: "/legal/privacy",
    label: "Légal — Confidentialité",
    description: "Politique de confidentialité et traitement des données.",
  },
  {
    key: "legal-terms",
    profile: "lp",
    route: "/legal/terms",
    label: "Légal — Conditions",
    description: "Conditions d'utilisation du service.",
  },
  {
    key: "lp-agent-canvas",
    profile: "lp",
    route: "/agent-canvas",
    label: "Agent Canvas",
    description:
      "Page de travail centrale, en lecture seule, que l'agent remplit en direct pour expliquer le produit (sources de yield, hypothèses, risques). Le canvasId précise quel atelier ouvrir. Aucune action d'écriture.",
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
    key: "admin-agent-canvas",
    profile: "admin",
    route: "/admin/agent-canvas",
    label: "Agent Canvas",
    description:
      "Page de travail centrale que l'agent remplit en direct (sections, champs, propositions d'action HITL) pour cadrer un produit ou une campagne outreach. Le canvasId précise quel atelier ouvrir. Admin uniquement (gate du layout /admin).",
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
    key: "admin-customers",
    profile: "admin",
    route: "/admin/customers",
    label: "Admin Customers",
    description:
      "Gestion des investisseurs / clients: liste, fiches, KYC, positions et création de compte.",
  },
  {
    key: "admin-outreach",
    profile: "admin",
    route: "/admin/outreach",
    label: "Admin Outreach",
    description:
      "Campagnes email et prospection: brouillons, compose, envoi tracké (human-in-the-loop).",
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
  {
    key: "admin-home",
    profile: "admin",
    route: "/admin",
    label: "Admin — Operations (accueil)",
    description:
      "Accueil admin / cockpit Operations : point d'entrée des surfaces internes.",
  },
  {
    key: "admin-vaults-new",
    profile: "admin",
    route: "/admin/vaults/new",
    label: "Admin — Nouveau vault",
    description: "Formulaire de création d'un nouveau vault.",
  },
  {
    key: "admin-outreach-compose",
    profile: "admin",
    route: "/admin/outreach/compose",
    label: "Admin — Outreach (composer)",
    description: "Composer un email / message d'outreach (human-in-the-loop).",
  },
  {
    key: "admin-proof-center",
    profile: "admin",
    route: "/admin/proof-center",
    label: "Admin — Proof Center",
    description:
      "Proof center côté admin : preuves de réserve, attestations, événements.",
  },
  {
    key: "admin-proof-center-full",
    profile: "admin",
    route: "/admin/proof-center/full",
    label: "Admin — Proof Center (complet)",
    description: "Vue exhaustive du proof center admin.",
  },
  {
    key: "admin-governance-allowlist",
    profile: "admin",
    route: "/admin/governance/allowlist",
    label: "Admin — Gouvernance (allowlist)",
    description: "Gestion de l'allowlist de gouvernance (adresses autorisées).",
  },
  {
    key: "admin-governance-propose",
    profile: "admin",
    route: "/admin/governance/propose",
    label: "Admin — Gouvernance (proposer)",
    description: "Créer une nouvelle proposition de gouvernance.",
  },
  {
    key: "admin-agents",
    profile: "admin",
    route: "/admin/agents",
    label: "Admin — Agents",
    description:
      "Console agents : templates, instances, calibration et mémoire des agents.",
  },
  {
    key: "admin-agents-new",
    profile: "admin",
    route: "/admin/agents/new",
    label: "Admin — Nouvel agent",
    description: "Créer un nouveau template / instance d'agent.",
  },
  {
    key: "admin-audit",
    profile: "admin",
    route: "/admin/audit",
    label: "Admin — Audit",
    description: "Journal d'audit : actions admin, mutations et traçabilité.",
  },
  {
    key: "admin-distributions",
    profile: "admin",
    route: "/admin/distributions",
    label: "Admin — Distributions",
    description:
      "Gestion des distributions mensuelles USDC : calcul, planification, exécution.",
  },
  {
    key: "admin-feedback",
    profile: "admin",
    route: "/admin/feedback",
    label: "Admin — Feedback",
    description: "Retours / feedback collectés (clients, internes).",
  },
  {
    key: "admin-investor-memo",
    profile: "admin",
    route: "/admin/investor-memo",
    label: "Admin — Investor Memo",
    description: "Génération et suivi des investor memos.",
  },
  {
    key: "admin-monitoring",
    profile: "admin",
    route: "/admin/monitoring",
    label: "Admin — Monitoring",
    description: "Monitoring opérationnel : santé système, jobs, alertes.",
  },
  {
    key: "admin-security",
    profile: "admin",
    route: "/admin/security",
    label: "Admin — Sécurité",
    description: "Surface sécurité : accès, rôles, sessions, posture.",
  },
  {
    key: "admin-signals",
    profile: "admin",
    route: "/admin/signals",
    label: "Admin — Signals",
    description: "Signaux marché / mining et indicateurs internes.",
  },
  {
    key: "admin-spec",
    profile: "admin",
    route: "/admin/spec",
    label: "Admin — Specs produit",
    description: "Index des specs produit (docs/spec) consultables en interne.",
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
  const dests = NAV_DESTINATIONS.filter((d) => d.profile === profile);
  const keys = dests.map((d) => d.key);
  // The tool schema only exposes the ENUM OF KEYS to the model — the per-
  // destination labels are not otherwise visible. Now that the whitelist covers
  // the whole site (~40 pages), inline a compact `key → label` gloss so the
  // model can map an intent to the right page instead of guessing from the key
  // string alone. Single source of truth: derived from NAV_DESTINATIONS.
  const gloss = dests.map((d) => `- ${d.key} → ${d.label}`).join("\n");
  const intro =
    profile === "admin"
      ? "Amène l'utilisateur admin à la surface interne la plus pertinente sur tout le site admin. Pour toute demande de création/cadrage d'un nouveau produit, privilégie admin-product-workspace comme page indépendante. Utilise admin-scenario-lab uniquement pour des simulations/stress tests d'un produit déjà cadré."
      : "Amène l'utilisateur à la page la plus pertinente de Hearst Connect quand ta réponse renvoie à une surface précise — par exemple « où vois-je mon allocation ? », « mes distributions ? », « comment souscrire ? », ou pour appuyer une explication par la bonne page.";
  return {
    type: "function" as const,
    function: {
      name: "navigate",
      // The gloss below is AUTHORITATIVE: it is the real, exhaustive set of
      // pages that exist. The model must navigate to a listed page when asked
      // and must never claim a listed page does not exist (GPT-4.1 otherwise
      // refuses surfaces it doesn't "believe in", e.g. /admin/security).
      description: `${intro} La liste ci-dessous est la liste RÉELLE et EXHAUSTIVE des pages existantes de l'application : si la demande de l'utilisateur correspond à l'une d'elles, APPELLE navigate avec sa clé — n'affirme JAMAIS qu'une page n'existe pas si elle figure dans la liste. Continue TOUJOURS de répondre en texte aussi. Ne choisis QU'une clé EXACTE de la liste, n'invente jamais de destination ni d'URL.\n\nDestinations:\n${gloss}`,
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          destination: {
            type: "string",
            enum: [...keys],
            description: "La clé EXACTE de la destination à ouvrir (depuis la liste).",
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
