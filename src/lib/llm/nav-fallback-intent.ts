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
import { isProductWorkspaceIntent } from "@/lib/llm/product-workspace-intent";


export const ADMIN_CUSTOMERS_DESTINATION_KEY = "admin-customers";
export const ADMIN_OUTREACH_DESTINATION_KEY = "admin-outreach";

/** Shared navigation verbs (FR + EN). */
const NAV_VERB =
  "(?:ouvre|ouvrir|ouvre-moi|ouvri|va|vas|aller|va sur|vas sur|aller sur|va dans|vas dans|aller dans|montre|montre-moi|affiche|affiche-moi|navigue|acc[eè]de|acc[eè]der|am[eè]ne|am[eè]ne-moi|emm[eè]ne|emm[eè]ne-moi|voir|consulte|consulter|open|go|go to|take me to|bring me to|show me|show|view|redirect)";

const LP_NAV_RULES: ReadonlyArray<{ key: string; re: RegExp }> = [
  // Bare-keyword exact command (whole string is a single destination TYPO,
  // optionally padded). Only DISTINCTIVE TYPOS resolve verb-less here
  // ("portofolio", "dashbord") — a misspelling is an explicit command, never a
  // conversational mention. Correctly-spelled common nouns ("portfolio",
  // "portefeuille", "dashboard") are DELIBERATELY excluded: bare, they are
  // ambiguous ("portfolio value is wrong", "le dashboard est cassé") and must
  // reach the LLM, not navigate. With a verb they go through the derived path.
  {
    key: "portfolio",
    re: /^\s*(?:portofolio|dashbord)\s*$/i,
  },
  // Possessive dashboard ("mon dashboard", "my dashboard", "ma page") — an
  // explicit ownership phrase, navigational without a verb. A BARE "dashboard"
  // mid-sentence is intentionally NOT matched here (it goes through the bare
  // command above or, with a verb, the derived path) so "le dashboard est cassé"
  // never navigates.
  {
    key: "portfolio",
    re: /\b(?:my dashboard|mon dashboard|my page|ma page|mon tableau de bord)\b/i,
  },
  {
    key: "profile",
    re: new RegExp(
      `\\b(${NAV_VERB}.*profil|mon profil|my profile|statut kyc|mon compte)\\b`,
      "i",
    ),
  },
  // Proof center — a nav verb before the term, OR the term as a leading command
  // ("proof center attestations", "preuve de réserve"). The previous rule matched
  // the term ANYWHERE, so a conversational "peux-tu m'expliquer la preuve de
  // réserve" navigated (P0 false positive). Anchoring the verb-less form at the
  // START (^) makes it a command, not a mention buried in a sentence.
  {
    key: "proof-center",
    re: new RegExp(`\\b${NAV_VERB}.*(proof\\s*center|proof|preuve)\\b`, "i"),
  },
  // Leading proof-center COMMAND that carries an extra destination qualifier
  // ("proof center attestations", "preuve de réserve on-chain"). A bare two-word
  // "proof center" / "preuve de réserve" alone is treated as a MENTION (it must
  // reach the LLM — e.g. "peux-tu m'expliquer la preuve de réserve"), so the
  // qualifier (attestations / réserves / on-chain) is what marks an explicit
  // command here.
  {
    key: "proof-center",
    re: /^\s*(?:proof\s*center|preuve de r[eé]serve)\s+\S+/i,
  },
  {
    key: "proof-center",
    re: /^\s*(?:attestations|r[eé]serves on-?chain)\b/i,
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
  // Bare admin commands: distinctive TYPOS or admin-qualified forms only. A bare
  // correctly-spelled "dashboard"/"projection"/"scenario lab" is ambiguous with a
  // conversational mention (and "dashboard" also collides with the LP space), so
  // it must NOT navigate verb-less — only the typo ("dashbord admin", "projetion",
  // "scenarion lab") or the explicit admin-qualified phrase resolves here.
  {
    key: "admin-dashboard",
    re: /^\s*(?:dashboard admin|dashbord admin|admin dashboard)\s*$/i,
  },
  {
    key: "admin-projection",
    re: /^\s*(?:projetion|projection admin|projetion admin)\s*$/i,
  },
  {
    key: "admin-scenario-lab",
    re: /^\s*(?:scenarion lab)\s*$/i,
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
  // Outreach — navigates on (a) a nav verb before an outreach term, (b) an email
  // compose/prepare intent, or (c) a bare short command / typo ("campain",
  // "outrich"). A conversational mention ("j'ai une question sur les campagnes")
  // must NOT navigate, so a bare "campagnes" mid-sentence no longer matches.
  {
    key: "admin-outreach",
    re: new RegExp(
      [
        // (a) nav verb + outreach term
        `\\b${NAV_VERB}.*(outreach|outrich|outtrich|campagnes?|campain|prospection)`,
        // (b) explicit email compose/prepare intent
        "(?:compose|composer|r[eé]dige[rz]?|pr[eé]pare[rz]?|envoie[rz]?|envoyer|cr[eé]e[rz]?).{0,20}(email|campagne|prospection|outreach)",
        "email de prospection",
        // (c) distinctive typos — never a plausible conversational mention, so
        // they may match anywhere ("campain outreach", a bare "outrich").
        "\\b(outrich|outtrich|campain)\\b",
        // (d) bare short command for the real words (whole message is the term).
        "^\\s*(outreach|prospection)\\s*$",
      ].join("|"),
      "i",
    ),
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
  // Scenario Lab — an explicit SIMULATION intent (an imperative simulation verb
  // leading the message, or a nav verb before a scenario term), NOT a bare
  // mention. The previous rule matched "simulation"/"scenario"/"stress test"
  // anywhere, so "j'ai une question sur la simulation" navigated. Now it fires on
  // a leading "simuler/lance/exécute/run … (stress test|scenario|monte carlo|
  // backtest)" command or "<nav verb> … scenario lab". The bare-keyword rule
  // above (`^scenario lab|scenarion lab$`) still covers the short command form.
  {
    key: "admin-scenario-lab",
    re: new RegExp(
      [
        // (a) leading simulation imperative
        "^\\s*(?:simule[rz]?|lance[rz]?|ex[eé]cute[rz]?|fais|run)\\b.*\\b(simulation|sc[eé]nario|scenario|stress[-\\s]?test|monte carlo|backtest)",
        // (b) leading scenario/stress noun as a direct command
        "^\\s*(?:stress[-\\s]?test|monte carlo|backtest|run scenario)\\b",
        // (c) nav verb before a scenario-lab term
        `\\b${NAV_VERB}.*(scenario lab|sc[eé]nario|scenario|stress[-\\s]?test|monte carlo|backtest)`,
      ].join("|"),
      "i",
    ),
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
  // Portfolio sub-leaves (positions / activity / distributions / yield / tax) are
  // intentionally NOT chat-navigable: the leaf pages are unwired stubs and the chat
  // must not route investors to blank surfaces. Removed from the LP whitelist +
  // NAV_CANONICAL_MATRIX too. Re-add keywords once a leaf renders real data.
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
  // "dashboard" is intentionally an admin keyword too: an ADMIN saying "ouvre
  // dashboard" wants the admin dashboard, and the admin resolver is queried first
  // for admins. The LP resolver maps the same verb-gated phrase to `portfolio`.
  // Same phrase, different resolver → different (but each deterministic)
  // destination; that is correct profile-dependent routing, not non-determinism.
  "admin-dashboard": ["dashboard", "dashbord", "dashboard admin", "dashbord admin", "tableau de bord admin", "command center", "admin dashboard", "projection dashboard"],
  "admin-vaults": ["vaults admin", "gestion des vaults"],
  "admin-customers": ["clients", "customers", "investisseurs", "fiche client"],
  "admin-outreach": ["outreach", "outrich", "outtrich", "prospection", "campagne email", "campagnes", "campaigns", "campaign", "campain", "campagne"],
  "admin-proofs": ["proofs admin", "gestion des proofs"],
  "admin-governance": ["gouvernance", "governance"],
  "admin-roadmap": ["roadmap", "feuille de route"],
  "admin-projection": ["projection", "projections", "projetion", "projetion admin", "show me projection", "go to projection"],
  "admin-home": ["accueil admin", "operations admin", "console admin", "control tower", "tour de contrôle", "tour de controle", "admin"],
  "admin-vaults-new": ["vault wizard", "wizard vault", "nouveau vault wizard"],
  "admin-outreach-compose": ["composer un email", "rédiger un email", "compose"],
  // "proof center" is an admin keyword too: an ADMIN navigating there wants the
  // admin proof center (admin resolver is queried first for admins); the LP
  // resolver maps the same verb-gated phrase to the LP `proof-center`. Profile-
  // dependent routing, each side deterministic.
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
  "admin-source": ["source", "sources", "data source", "sources de données", "ingestion"],
  "admin-agentic": ["agentic", "agentic console", "console agentique", "agentique"],
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
  // Portfolio sub-leaves (positions / activity / distributions / yield) removed from
  // the canonical matrix in lockstep with the LP whitelist + NAV_KEYWORDS — the leaf
  // pages are unwired stubs, so they are not chat-navigable destinations. The
  // module-load guard below stays consistent (no matrix row references a key that is
  // absent from the whitelist).
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

/** Vault list/wizard nav must lose to Product Workspace creation/framing. */
const VAULT_NAV_KEYS = new Set(["vaults", "admin-vaults", "admin-vaults-new"]);

function vaultNavSupersededByProductWorkspace(
  message: string,
  key: string | null,
): boolean {
  return key !== null && VAULT_NAV_KEYS.has(key) && isProductWorkspaceIntent(message);
}

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
    if (adminKey && !vaultNavSupersededByProductWorkspace(message, adminKey)) {
      return adminKey;
    }
  }

  if (navProfile === "lp" && !isAdmin) {
    const lpKey = resolveLpNavDestinationKey(message);
    return vaultNavSupersededByProductWorkspace(message, lpKey) ? null : lpKey;
  }

  // Admins can also ask for LP surfaces from either admin or normal mode.
  if (isAdmin) {
    const lpKey = resolveLpNavDestinationKey(message);
    return vaultNavSupersededByProductWorkspace(message, lpKey) ? null : lpKey;
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
