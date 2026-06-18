/**
 * Regex navigation shortcuts for the Master Agent.
 *
 * When a user message matches an explicit navigation intent, the route
 * short-circuits BEFORE the LLM (fixed ack + publishNav) — same pattern as
 * Product Workspace. Post-LLM fallback reuses the same resolver when the model
 * answered in text without calling `navigate`.
 */

import type { NavProfile } from "@/lib/llm/navigate-tool";
import { isExplicitSimulationIntent } from "@/lib/llm/product-workspace-intent";

export const ADMIN_CUSTOMERS_DESTINATION_KEY = "admin-customers";
export const ADMIN_OUTREACH_DESTINATION_KEY = "admin-outreach";

/** Shared navigation verbs (FR + EN). */
const NAV_VERB =
  "(?:ouvre|ouvrir|va sur|vas sur|montre|affiche|navigue|acc[eè]de|am[eè]ne|open|go to|take me to|bring me to|show me|show|view|redirect)";

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

/** LP-only navigation regex. */
export function resolveLpNavDestinationKey(message: string): string | null {
  return firstMatchingKey(message, LP_NAV_RULES);
}

/** Admin navigation regex (customers, outreach, ops surfaces). */
export function resolveAdminNavFallbackKey(message: string): string | null {
  return firstMatchingKey(message, ADMIN_NAV_RULES);
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
