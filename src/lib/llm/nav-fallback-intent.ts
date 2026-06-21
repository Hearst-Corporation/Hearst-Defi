/**
 * Regex navigation shortcuts for the Master Agent.
 *
 * When a user message matches an explicit navigation intent, the route
 * short-circuits BEFORE the LLM (fixed ack + publishNav) — same pattern as
 * Product Workspace. Post-LLM fallback reuses the same resolver when the model
 * answered in text without calling `navigate`.
 */

import type { NavProfile } from "@/lib/llm/navigate-tool";
import {
  ADMIN_NAV_DESTINATIONS,
  LP_NAV_DESTINATIONS,
} from "@/lib/llm/navigate-tool";


export const ADMIN_CUSTOMERS_DESTINATION_KEY = "admin-customers";
export const ADMIN_OUTREACH_DESTINATION_KEY = "admin-outreach";

/** Shared navigation verbs (FR + EN). */
const NAV_VERB =
  "(?:ouvre|ouvrir|ouvre-moi|va sur|vas sur|aller sur|montre|montre-moi|affiche|affiche-moi|navigue|acc[eè]de|acc[eè]der|am[eè]ne|am[eè]ne-moi|emm[eè]ne|emm[eè]ne-moi|voir|consulte|consulter|open|go to|take me to|bring me to|show me|show|view|redirect)";

const LP_NAV_RULES: ReadonlyArray<{ key: string; re: RegExp }> = [
  {
    key: "profile",
    re: new RegExp(
      `\\b(${NAV_VERB}.*profil|mon profil|my profile|statut kyc|mon compte)\\b`,
      "i",
    ),
  },
  {
    key: "proof-center",
    re: /\b(proof\s*center|preuve de r[eé]serve|attestations?|r[eé]serves on-?chain)\b/i,
  },
  {
    key: "proof-center",
    re: new RegExp(`\\b${NAV_VERB}.*(proof|preuve)\\b`, "i"),
  },
  {
    key: "vaults",
    re: new RegExp(
      `\\b(${NAV_VERB}.*(produits?|vaults?|offres?)|souscrire|subscribe|voir les produits|liste des vaults)\\b`,
      "i",
    ),
  },
  {
    key: "portfolio",
    re: new RegExp(
      `\\b(${NAV_VERB}.*(portefeuille|portfolio)|mon portefeuille|my portfolio|voir mon allocation|tableau de bord)\\b`,
      "i",
    ),
  },
];

const ADMIN_NAV_RULES: ReadonlyArray<{ key: string; re: RegExp }> = [
  {
    key: "admin-customers",
    re: new RegExp(
      [
        `\\b${NAV_VERB}.*(customers?|clients?|investisseurs?)`,
        "portefeuille (utilisateur|client|investisseur|lp)",
        "fiche (client|customer|investisseur)",
        "nouveau client",
        "cr[eé]er un client",
        "create (investor|customer|client)",
        "liste (des )?clients",
        "admin[/-]customers",
        "recherche(r)? (un )?client",
        "positions (du |d[''])?client",
      ].join("|"),
      "i",
    ),
  },
  {
    key: "admin-outreach",
    re: /\b(outreach|email de prospection|envoyer un email|compose email|campagne email|prospection)\b/i,
  },
  {
    key: "admin-dashboard",
    re: new RegExp(
      `\\b(${NAV_VERB}.*(dashboard admin|admin dashboard|tableau de bord admin)|admin[/-]dashboard)\\b`,
      "i",
    ),
  },
  {
    key: "admin-vaults",
    re: new RegExp(
      `\\b(${NAV_VERB}.*(admin vaults?|vaults admin|gestion des vaults)|admin[/-]vaults)\\b`,
      "i",
    ),
  },
  {
    key: "admin-proofs",
    re: new RegExp(
      `\\b(${NAV_VERB}.*(admin proofs?|proofs admin)|admin[/-]proofs)\\b`,
      "i",
    ),
  },
  {
    key: "admin-governance",
    re: new RegExp(
      `\\b(${NAV_VERB}.*(gouvernance|governance)|admin[/-]governance)\\b`,
      "i",
    ),
  },
  {
    key: "admin-roadmap",
    re: new RegExp(`\\b(${NAV_VERB}.*roadmap|admin[/-]roadmap)\\b`, "i"),
  },
  {
    key: "admin-projection",
    re: new RegExp(
      `\\b(${NAV_VERB}.*(projection admin|admin projection)|admin[/-]projection)\\b`,
      "i",
    ),
  },
  {
    key: "admin-scenario-lab",
    re: /\b(simuler|simulation|scenario|scénario|stress test|stress-test|monte carlo|backtest|run scenario)\b/i,
  },
];

/**
 * Per-destination keywords for the DERIVED regex fast-path.
 *
 * Every whitelist key has an entry (a sync-guard test enforces it), so adding a
 * page to the whitelist gives it instant, LLM-free navigation as soon as it gets
 * keywords here. Keep terms DISTINCTIVE per page. The derived rules are
 * nav-verb-gated (see `buildDerivedRules`), so a mere conversational mention of
 * a term ("je ne comprends pas mes distributions") does NOT trigger navigation —
 * only an explicit "ouvre/va sur/montre … <term>" does.
 *
 * Hand-tuned rules above still run FIRST (zero regression); these cover the long
 * tail of pages that have no bespoke rule.
 */
export const NAV_KEYWORDS: Record<string, readonly string[]> = {
  // LP
  portfolio: ["portefeuille", "portfolio", "allocation", "tableau de bord"],
  "portfolio-positions": ["positions", "mes lignes", "détail des positions"],
  "portfolio-activity": ["activité", "historique", "mouvements", "activity"],
  "portfolio-distributions": [
    "distributions",
    "distribution",
    "versements",
    "coupons",
  ],
  "portfolio-yield": ["rendement", "yield", "performance", "mes gains", "intérêts"],
  "portfolio-tax": ["fiscalité", "fiscal", "fiscaux", "impôts", "tax"],
  vaults: ["vaults", "produits", "offres", "souscrire", "investir"],
  "proof-center": ["proof center", "preuve de réserve", "attestations", "réserves"],
  "proof-center-full": ["proof center complet", "toutes les preuves", "preuves complètes"],
  profile: ["profil", "mon compte", "kyc", "préférences", "paramètres"],
  legal: ["mentions légales", "documents légaux", "legal"],
  "legal-disclaimer": ["disclaimer", "avertissement"],
  "legal-privacy": ["confidentialité", "vie privée", "privacy"],
  "legal-terms": ["conditions", "cgu", "terms"],
  // Admin
  "admin-product-workspace": ["product workspace", "espace produit"],
  "admin-scenario-lab": ["scenario lab", "laboratoire de scénarios"],
  "admin-dashboard": ["dashboard admin", "tableau de bord admin", "command center"],
  "admin-vaults": ["vaults admin", "gestion des vaults"],
  "admin-customers": ["clients", "customers", "investisseurs", "fiche client"],
  "admin-outreach": ["outreach", "prospection", "campagne email"],
  "admin-proofs": ["proofs admin", "gestion des proofs"],
  "admin-governance": ["gouvernance", "governance"],
  "admin-roadmap": ["roadmap", "feuille de route"],
  "admin-projection": ["projection", "projections"],
  "admin-home": ["accueil admin", "operations admin", "console admin"],
  "admin-vaults-new": ["nouveau vault", "créer un vault", "new vault"],
  "admin-outreach-compose": ["composer un email", "rédiger un email", "compose"],
  "admin-proof-center": ["proof center admin"],
  "admin-proof-center-full": ["proof center admin complet"],
  "admin-governance-allowlist": ["allowlist", "liste blanche", "adresses autorisées"],
  "admin-governance-propose": ["proposer", "nouvelle proposition", "propose"],
  "admin-agents": ["agents", "console agents"],
  "admin-agents-new": ["nouvel agent", "créer un agent"],
  "admin-audit": ["audit", "journal d'audit", "traçabilité"],
  "admin-distributions": ["distributions admin", "gestion des distributions"],
  "admin-feedback": ["feedback", "retours"],
  "admin-investor-memo": ["investor memo", "mémo investisseur", "memo"],
  "admin-monitoring": ["monitoring", "surveillance", "santé système"],
  "admin-security": ["sécurité", "security", "contrôle d'accès"],
  "admin-signals": ["signals", "signaux", "indicateurs"],
  "admin-spec": ["specs", "spécifications", "spec produit"],
};

/** Escape regex metacharacters in a literal keyword. */
function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Route depth (segment count). Deeper = more specific → matched first so a
 *  sub-page ("/portfolio/tax") wins over its parent ("/portfolio"). */
function routeDepth(route: string): number {
  return route.split("/").filter(Boolean).length;
}

/**
 * Build nav-verb-gated regex rules from each destination's keywords. The rule
 * matches only when a navigation verb precedes one of the page's keywords, so a
 * conversational mention never hijacks navigation. Rules are ordered deepest
 * route first so a sub-page beats its parent.
 */
function buildDerivedRules(
  destinations: readonly { key: string; route: string }[],
): ReadonlyArray<{ key: string; re: RegExp }> {
  return [...destinations]
    .filter((d) => (NAV_KEYWORDS[d.key]?.length ?? 0) > 0)
    .sort((a, b) => routeDepth(b.route) - routeDepth(a.route))
    .map((d) => {
      const kws = (NAV_KEYWORDS[d.key] ?? []).map(escapeRe).join("|");
      return {
        key: d.key,
        // Nav verb, then anything, then a page keyword. Boundaries use
        // Unicode-aware lookarounds (NOT `\b`, which is ASCII-only and would
        // fail right after an accented letter — "sécurité", "fiscalité",
        // "activité" all end in "é"). The `u` flag enables `\p{L}`.
        re: new RegExp(
          `(?<![\\p{L}\\p{N}])${NAV_VERB}.*(?<![\\p{L}\\p{N}])(?:${kws})(?![\\p{L}\\p{N}])`,
          "iu",
        ),
      };
    });
}

const LP_DERIVED_RULES = buildDerivedRules(LP_NAV_DESTINATIONS);
const ADMIN_DERIVED_RULES = buildDerivedRules(ADMIN_NAV_DESTINATIONS);

function firstMatchingKey(
  message: string,
  rules: ReadonlyArray<{ key: string; re: RegExp }>,
): string | null {
  const trimmed = message.trim();
  if (!trimmed) return null;
  for (const { key, re } of rules) {
    if (re.test(trimmed)) return key;
  }
  return null;
}

/** LP-only navigation regex. Hand-tuned rules first (priority), then the
 *  keyword-derived rules covering every other LP page. */
export function resolveLpNavDestinationKey(message: string): string | null {
  return (
    firstMatchingKey(message, LP_NAV_RULES) ??
    firstMatchingKey(message, LP_DERIVED_RULES)
  );
}

/** Admin navigation regex (customers, outreach, ops surfaces). Hand-tuned rules
 *  first (priority), then the keyword-derived rules covering every other admin
 *  page. */
export function resolveAdminNavFallbackKey(message: string): string | null {
  return (
    firstMatchingKey(message, ADMIN_NAV_RULES) ??
    firstMatchingKey(message, ADMIN_DERIVED_RULES)
  );
}

/**
 * Resolves a whitelisted destination key from regex, or null.
 * Admins in normal chat mode still get admin shortcuts when the message is
 * clearly an internal ops navigation (e.g. "portefeuille utilisateur").
 */
export function resolveNavFallbackDestinationKey(args: {
  navProfile: NavProfile;
  isAdmin?: boolean;
  message: string;
  scenarioLabDestinationKey: string;
  scenarioLabNavEnabled: boolean;
}): string | null {
  const { navProfile, isAdmin = false, message, scenarioLabNavEnabled } = args;
  const scenarioLabDestinationKey = args.scenarioLabDestinationKey;

  if (navProfile === "admin" || isAdmin) {
    const adminKey = resolveAdminNavFallbackKey(message);
    if (adminKey === "admin-scenario-lab" && !scenarioLabNavEnabled) {
      return null;
    }
    if (adminKey) return adminKey;
  }

  if (navProfile === "lp" && !isAdmin) {
    return resolveLpNavDestinationKey(message);
  }

  // Admin in normal (LP) mode asking for their own LP surfaces.
  if (isAdmin && navProfile === "lp") {
    return resolveLpNavDestinationKey(message);
  }

  return null;
}

/** Fixed bubble when navigation is handled by regex (no LLM prose). */
export const NAV_SHORTCUT_ACK = "Je vous y emmène.";
