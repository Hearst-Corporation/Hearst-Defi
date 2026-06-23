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

// ---------------------------------------------------------------------------
// Deny-first looksLikeNavIntent pipeline
// ---------------------------------------------------------------------------

/**
 * Normalize a raw message for guard matching:
 *   1. Unicode NFD decomposition + accent strip (é→e, à→a, …)
 *   2. Lowercase
 *   3. Non-alphanumeric chars → single space
 *   4. Collapse runs + trim
 */
function normalize(message: string): string {
  return message
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Mutating / creative action verbs — not navigation. */
const ACTION_VERB_GUARD =
  /^(?:cree|creer|ajoute|genere|redige|ecris|envoie|envoi|supprime|efface|modifie|change|renomme|exporte|telecharge|imprime|valide|approuve|configure|lance|update|mets?|fais(?!\s+voir)|create|add|generate|write|send|delete|remove|edit|configure)\b/;

/**
 * Question words — a question starting with these falls to the LLM even if it
 * contains a navigation verb ("comment ouvrir un compte ?").
 * Note: "where is/are" can be navigable (e.g. "where is the portfolio"), so
 * "where" is deliberately excluded and handled by the nav-verb path.
 */
const QUESTION_GUARD =
  /^(?:quoi|quel|quelle|quels|quelles|comment|pourquoi|combien|qui|quand|what|how|why|who|which)\b/;

/** Negation markers — "je ne veux pas ouvrir ça" is not a nav intent. */
const NEGATION_GUARD = /\b(?:pas|jamais|sans|aucun|do not|don'?t|without)\b/;

/** Conjunction in a compound command — "ouvre X et supprime Y" is not pure nav. */
const CONJUNCTION_GUARD = /\b(?:et|puis|then|and)\b/;

/**
 * Nav-verb lead anchored at the START of the normalized string.
 * Built from the same verb vocabulary as NAV_VERB above so there is no drift.
 */
const NAV_VERB_LEAD_RE =
  /^(?:ouvre|ouvrir|ouvre moi|va sur|vas sur|aller sur|montre|montre moi|affiche|affiche moi|navigue|accede|acceder|amene|amene moi|emmene|emmene moi|voir|consulte|consulter|open|go to|take me to|bring me to|show me|show|view|redirect)\b/;

/**
 * Deny-first navigator classifier.
 *
 * Returns `true` ONLY when the message is a genuine navigation attempt with
 * no matched destination (so route.ts can emit an instant NAV_REJECT_ACK
 * instead of an LLM call that would just say "I can't go there").
 *
 * Guards run in order; the first match exits with `false` (falls to LLM):
 *   1. Empty normalised string → false
 *   2. ACTION_VERB_GUARD  — starts with a mutating verb → false
 *   3. QUESTION_GUARD     — starts with a question word → false
 *   4. NEGATION_GUARD     — contains a negation → false
 *   5. A nav verb is REQUIRED (this project's nav is verb-gated) → false if absent
 *   6. Length threshold   — >58 chars behind a nav verb is prose → false
 *   7. CONJUNCTION_GUARD  — compound command → false
 *   8. Otherwise → true (instant nav reject is safe and correct)
 */
export function looksLikeNavIntent(message: string): boolean {
  const norm = normalize(message);
  if (!norm) return false;

  // Guard 1 – mutating action verb at the start
  if (ACTION_VERB_GUARD.test(norm)) return false;

  // Guard 2 – question word at the start
  if (QUESTION_GUARD.test(norm)) return false;

  // Guard 3 – negation anywhere
  if (NEGATION_GUARD.test(norm)) return false;

  const hasNavVerb = NAV_VERB_LEAD_RE.test(norm);

  // Guard 4 – a NAV VERB is REQUIRED. In this project every nav rule is
  // verb-gated (a bare keyword like "distributions" never resolves a route and
  // must reach the LLM — it may be a short question). So an instant nav-reject
  // only fires on an explicit navigation verb that matched no destination. This
  // is stricter than a generic "≤3 useful words" eligibility on purpose.
  if (!hasNavVerb) return false;

  // Guard 5 – length threshold (a long sentence behind a nav verb is prose).
  if (norm.length > 58) return false;

  // Guard 6 – conjunction (compound command) → let the LLM handle it.
  if (CONJUNCTION_GUARD.test(norm)) return false;

  // A nav-verb-led message that passed the action/question/negation/conjunction
  // denies is a clean navigation attempt.
  return true;
}

/**
 * Fixed bubble emitted on an instant nav-reject (the message looked like
 * navigation but matched no whitelisted destination). Keeps the <0.1s path;
 * no LLM call needed.
 */
export const NAV_REJECT_ACK =
  "Je ne trouve pas cette section dans votre espace. Puis-je vous aider autrement ?";
