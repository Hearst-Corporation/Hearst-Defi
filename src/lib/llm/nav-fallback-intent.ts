/**
 * Regex navigation shortcuts for the Master Agent.
 *
 * When a user message matches an explicit navigation intent, the route
 * short-circuits BEFORE the LLM (fixed ack + publishNav + deterministic
 * NavTrace) — same pattern as Product Workspace. Navigation is 100%
 * deterministic; no LLM call is made for nav-intent messages.
 */

import type { NavProfile } from "@/lib/llm/navigate-tool";
import {
  ADMIN_NAV_DESTINATIONS,
  LP_NAV_DESTINATIONS,
  resolveNavDestination,
} from "@/lib/llm/navigate-tool";


export const ADMIN_CUSTOMERS_DESTINATION_KEY = "admin-customers";
export const ADMIN_OUTREACH_DESTINATION_KEY = "admin-outreach";

/** Shared navigation verbs (FR + EN). */
const NAV_VERB =
  "(?:ouvre|ouvrir|ouvre-moi|ouvri|va|vas|aller|va sur|vas sur|aller sur|va dans|vas dans|aller dans|montre|montre-moi|affiche|affiche-moi|navigue|acc[eè]de|acc[eè]der|am[eè]ne|am[eè]ne-moi|emm[eè]ne|emm[eè]ne-moi|voir|consulte|consulter|open|go|go to|take me to|bring me to|show me|show|view|redirect)";

const LP_NAV_RULES: ReadonlyArray<{ key: string; re: RegExp }> = [
  {
    key: "portfolio",
    re: /^\s*(?:portfolio|portofolio|portefeuille|dashboard|dashbord)\s*$/i,
  },
  {
    key: "portfolio",
    re: /\b(?:dashboard|dashbord|tableau de bord|my dashboard|mon dashboard|my page|ma page)\b/i,
  },
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
      `\\b(${NAV_VERB}.*(produits?|vaults?|vaultes?|offres?|product page|page produit)|souscrire|subscribe|voir les produits|liste des vaults|open the product page|ouvre la page produit)\\b`,
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
    key: "admin-dashboard",
    re: /^\s*(?:dashboard|dashbord|dashboard admin|dashbord admin)\s*$/i,
  },
  {
    key: "admin-projection",
    re: /^\s*(?:projection|projetion|projection admin|projetion admin)\s*$/i,
  },
  {
    key: "admin-scenario-lab",
    re: /^\s*(?:scenario lab|scenarion lab)\s*$/i,
  },
  {
    key: "admin-home",
    re: /\b(control tower|tour de controle|tour de contrôle|admin home|operations admin|cockpit admin)\b/i,
  },
  {
    key: "admin-home",
    re: new RegExp(`\\b${NAV_VERB}.*(?:control tower|tour de contr[oô]le|admin home|operations admin|cockpit admin)\\b`, "i"),
  },
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
    re: /\b(outreach|outrich|outtrich|email de prospection|envoyer un email|compose email|campagne email|campagnes?|campain|prospection)\b/i,
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
  portfolio: ["portefeuille", "portfolio", "portofolio", "allocation", "tableau de bord", "dashboard", "dashbord", "my dashboard", "mon dashboard", "ma page", "my page"],
  "portfolio-positions": ["positions", "mes lignes", "détail des positions", "my positions", "mes positions"],
  "portfolio-activity": ["activité", "historique", "mouvements", "activity"],
  "portfolio-distributions": [
    "distributions",
    "distribution",
    "versements",
    "coupons",
  ],
  "portfolio-yield": ["rendement", "yield", "performance", "mes gains", "intérêts", "open yield"],
  "portfolio-tax": ["fiscalité", "fiscal", "fiscaux", "impôts", "tax", "settings fiscal"],
  vaults: ["vaults", "vault", "vaultes", "produits", "offres", "souscrire", "investir", "product page", "page produit", "products"],
  "proof-center": ["proof center", "preuve de réserve", "attestations", "réserves"],
  "proof-center-full": ["proof center complet", "toutes les preuves", "preuves complètes"],
  profile: ["profil", "profile", "settings", "mon compte", "my account", "kyc", "préférences", "paramètres", "session", "context", "memory"],
  legal: ["mentions légales", "documents légaux", "legal"],
  "legal-disclaimer": ["disclaimer", "avertissement"],
  "legal-privacy": ["confidentialité", "vie privée", "privacy"],
  "legal-terms": ["conditions", "cgu", "terms"],
  // Admin
  "admin-product-workspace": ["product workspace", "espace produit"],
  "admin-scenario-lab": ["scenario lab", "scenarion lab", "laboratoire de scénarios", "scenario", "scénario", "projection lab"],
  "admin-agent-canvas": ["agent canvas", "canvas agent", "atelier agent"],
  "lp-agent-canvas": ["agent canvas lecture", "canvas lecture", "explication produit"],
  "admin-dashboard": ["dashboard", "dashbord", "dashboard admin", "dashbord admin", "tableau de bord admin", "command center", "admin dashboard", "projection dashboard"],
  "admin-vaults": ["vaults admin", "gestion des vaults"],
  "admin-customers": ["clients", "customers", "investisseurs", "fiche client"],
  "admin-outreach": ["outreach", "outrich", "outtrich", "prospection", "campagne email", "campagnes", "campaigns", "campaign", "campain", "campagne"],
  "admin-proofs": ["proofs admin", "gestion des proofs"],
  "admin-governance": ["gouvernance", "governance"],
  "admin-roadmap": ["roadmap", "feuille de route"],
  "admin-projection": ["projection", "projections", "projetion", "projetion admin", "show me projection", "go to projection"],
  "admin-home": ["accueil admin", "operations admin", "console admin", "control tower", "tour de contrôle", "tour de controle", "admin"],
  "admin-vaults-new": ["nouveau vault", "créer un vault", "new vault"],
  "admin-outreach-compose": ["composer un email", "rédiger un email", "compose"],
  "admin-proof-center": ["proof center admin", "proof center", "proof centre"],
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

export interface CanonicalNavMatrixRow {
  canonicalDestination: string;
  destinationKey: string;
  route: string;
  aliasesFr: readonly string[];
  aliasesEn: readonly string[];
  typos: readonly string[];
  requiredPermissions: "lp" | "admin";
  safe: true;
}

export const NAV_CANONICAL_MATRIX: readonly CanonicalNavMatrixRow[] = [
  {
    canonicalDestination: "dashboard",
    destinationKey: "portfolio",
    route: "/portfolio",
    aliasesFr: ["dashboard", "tableau de bord", "mon dashboard", "ma page"],
    aliasesEn: ["dashboard", "my dashboard"],
    typos: ["dashbord"],
    requiredPermissions: "lp",
    safe: true,
  },
  {
    canonicalDestination: "portfolio",
    destinationKey: "portfolio",
    route: "/portfolio",
    aliasesFr: ["portefeuille"],
    aliasesEn: ["portfolio"],
    typos: ["portofolio"],
    requiredPermissions: "lp",
    safe: true,
  },
  {
    canonicalDestination: "vaults/products",
    destinationKey: "vaults",
    route: "/vaults",
    aliasesFr: ["produits", "vault", "page produit"],
    aliasesEn: ["products", "vault", "product page"],
    typos: ["vaultes"],
    requiredPermissions: "lp",
    safe: true,
  },
  {
    canonicalDestination: "proof center",
    destinationKey: "proof-center",
    route: "/proof-center",
    aliasesFr: ["proof center", "preuve de réserve"],
    aliasesEn: ["proof center"],
    typos: [],
    requiredPermissions: "lp",
    safe: true,
  },
  {
    canonicalDestination: "positions",
    destinationKey: "portfolio-positions",
    route: "/portfolio/positions",
    aliasesFr: ["positions", "mes positions"],
    aliasesEn: ["positions", "my positions"],
    typos: [],
    requiredPermissions: "lp",
    safe: true,
  },
  {
    canonicalDestination: "activity",
    destinationKey: "portfolio-activity",
    route: "/portfolio/activity",
    aliasesFr: ["activité"],
    aliasesEn: ["activity"],
    typos: [],
    requiredPermissions: "lp",
    safe: true,
  },
  {
    canonicalDestination: "distributions",
    destinationKey: "portfolio-distributions",
    route: "/portfolio/distributions",
    aliasesFr: ["distributions"],
    aliasesEn: ["distributions"],
    typos: [],
    requiredPermissions: "lp",
    safe: true,
  },
  {
    canonicalDestination: "yield",
    destinationKey: "portfolio-yield",
    route: "/portfolio/yield",
    aliasesFr: ["rendement"],
    aliasesEn: ["yield"],
    typos: [],
    requiredPermissions: "lp",
    safe: true,
  },
  {
    canonicalDestination: "settings/profile",
    destinationKey: "profile",
    route: "/profile",
    aliasesFr: ["profil", "paramètres"],
    aliasesEn: ["profile", "settings"],
    typos: [],
    requiredPermissions: "lp",
    safe: true,
  },
  {
    canonicalDestination: "product workspace",
    destinationKey: "admin-product-workspace",
    route: "/admin/product-workspace",
    aliasesFr: ["espace produit", "product workspace"],
    aliasesEn: ["product workspace"],
    typos: [],
    requiredPermissions: "admin",
    safe: true,
  },
  {
    canonicalDestination: "projection",
    destinationKey: "admin-projection",
    route: "/admin/projection",
    aliasesFr: ["projection"],
    aliasesEn: ["projection"],
    typos: ["projetion"],
    requiredPermissions: "admin",
    safe: true,
  },
  {
    canonicalDestination: "scenario lab",
    destinationKey: "admin-scenario-lab",
    route: "/admin/scenario-lab",
    aliasesFr: ["scenario lab", "laboratoire de scénarios"],
    aliasesEn: ["scenario lab"],
    typos: ["scenarion lab"],
    requiredPermissions: "admin",
    safe: true,
  },
  {
    canonicalDestination: "outreach/campaigns",
    destinationKey: "admin-outreach",
    route: "/admin/outreach",
    aliasesFr: ["outreach", "campagnes"],
    aliasesEn: ["outreach", "campaigns"],
    typos: ["campain", "outrich", "outtrich"],
    requiredPermissions: "admin",
    safe: true,
  },
  {
    canonicalDestination: "agent canvas",
    destinationKey: "admin-agent-canvas",
    route: "/admin/agent-canvas",
    aliasesFr: ["agent canvas", "canvas agent"],
    aliasesEn: ["agent canvas"],
    typos: [],
    requiredPermissions: "admin",
    safe: true,
  },
  {
    canonicalDestination: "control tower/admin",
    destinationKey: "admin-home",
    route: "/admin",
    aliasesFr: ["control tower", "tour de contrôle", "admin"],
    aliasesEn: ["control tower", "admin"],
    typos: [],
    requiredPermissions: "admin",
    safe: true,
  },
  {
    canonicalDestination: "reports",
    destinationKey: "admin-investor-memo",
    route: "/admin/investor-memo",
    aliasesFr: ["rapports", "reporting"],
    aliasesEn: ["reports", "reporting"],
    typos: [],
    requiredPermissions: "admin",
    safe: true,
  },
] as const;

const CANONICAL_KEYS = new Set(NAV_CANONICAL_MATRIX.map((row) => row.destinationKey));
for (const key of CANONICAL_KEYS) {
  if (!resolveNavDestination(key)) {
    throw new Error(`NAV_CANONICAL_MATRIX references unknown destination key: ${key}`);
  }
}

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

  // Admins can also ask for LP surfaces from either admin or normal mode.
  if (isAdmin) {
    return resolveLpNavDestinationKey(message);
  }

  return null;
}

/** Fixed bubble when navigation is handled by regex (no LLM prose). */
export const NAV_SHORTCUT_ACK = "Je vous y emmène.";
export const NAV_SHORTCUT_ACK_EN = "Taking you there.";

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
  /^(?:ouvre|ouvrir|ouvre moi|ouvri|va|vas|aller|va sur|vas sur|aller sur|va dans|vas dans|aller dans|montre|montre moi|affiche|affiche moi|navigue|accede|acceder|amene|amene moi|emmene|emmene moi|voir|consulte|consulter|open|go|go to|take me to|bring me to|show me|show|view|redirect)\b/;

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
export const NAV_REJECT_ACK_EN =
  "I can't find that section in your workspace. Can I help with something else?";

type NavLanguage = "fr" | "en";

const FR_NAV_HINTS = new Set([
  "ouvre",
  "ouvrir",
  "montre",
  "affiche",
  "va",
  "vas",
  "aller",
  "amene",
  "emmene",
  "portefeuille",
  "campagne",
  "tableau",
  "preuve",
  "rendement",
  "distribution",
  "controle",
]);

const EN_NAV_HINTS = new Set([
  "open",
  "show",
  "go",
  "take",
  "bring",
  "my",
  "the",
  "dashboard",
  "portfolio",
  "campaign",
  "campaigns",
  "proof",
  "yield",
  "distribution",
  "control",
  "tower",
]);

function detectNavLanguage(message: string): NavLanguage {
  const tokens = message
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  if (tokens.length === 0) return "fr";
  let frScore = 0;
  let enScore = 0;
  for (const token of tokens) {
    if (FR_NAV_HINTS.has(token)) frScore++;
    if (EN_NAV_HINTS.has(token)) enScore++;
  }
  return enScore > frScore ? "en" : "fr";
}

export function buildNavShortcutAck(message: string): string {
  return detectNavLanguage(message) === "en"
    ? NAV_SHORTCUT_ACK_EN
    : NAV_SHORTCUT_ACK;
}

export function buildNavRejectAck(message: string): string {
  return detectNavLanguage(message) === "en"
    ? NAV_REJECT_ACK_EN
    : NAV_REJECT_ACK;
}
