/**
 * Keyword fallbacks when the Master Agent answers in plain text without calling
 * `navigate`. Mirrors the admin Scenario Lab pattern in route.ts — deterministic,
 * no extra LLM call, fail-safe (no match → no navigation).
 */

import type { NavProfile } from "@/lib/llm/navigate-tool";
import { isExplicitSimulationIntent } from "@/lib/llm/product-workspace-intent";

export const ADMIN_CUSTOMERS_DESTINATION_KEY = "admin-customers";
export const ADMIN_OUTREACH_DESTINATION_KEY = "admin-outreach";

const LP_NAV_RULES: ReadonlyArray<{ key: string; re: RegExp }> = [
  {
    key: "profile",
    re: /\b(mon profil|my profile|ouvre.*profil|open.*profile|statut kyc|mon compte)\b/i,
  },
  {
    key: "proof-center",
    re: /\b(proof center|preuve de r[eé]serve|attestation|ouvre.*(proof|preuve)|r[eé]serves on-?chain)\b/i,
  },
  {
    key: "vaults",
    re: /\b(ouvre.*(produits?|vaults?|offres?)|souscrire|subscribe|voir les produits|liste des vaults)\b/i,
  },
  {
    key: "portfolio",
    re: /\b(ouvre.*portefeuille|mon portefeuille|my portfolio|voir mon allocation|tableau de bord)\b/i,
  },
];

const ADMIN_CUSTOMERS_INTENT_RE =
  /\b(nouveau client|cr[eé]er un client|create investor|create customer|fiche customer|liste clients|admin customers)\b/i;

const ADMIN_OUTREACH_INTENT_RE =
  /\b(outreach|email de prospection|envoyer un email|compose email|campagne email)\b/i;

/** Resolves an LP destination key from an explicit navigation phrase, or null. */
export function resolveLpNavDestinationKey(message: string): string | null {
  const trimmed = message.trim();
  if (!trimmed) return null;
  for (const { key, re } of LP_NAV_RULES) {
    if (re.test(trimmed)) return key;
  }
  return null;
}

/** Resolves an admin destination key from outreach/customers phrases, or null. */
export function resolveAdminNavFallbackKey(message: string): string | null {
  const trimmed = message.trim();
  if (!trimmed) return null;
  if (ADMIN_CUSTOMERS_INTENT_RE.test(trimmed)) return ADMIN_CUSTOMERS_DESTINATION_KEY;
  if (ADMIN_OUTREACH_INTENT_RE.test(trimmed)) return ADMIN_OUTREACH_DESTINATION_KEY;
  return null;
}

/**
 * Fallback navigation key when the model emitted no `navigate` tool call.
 * Profile-scoped — never returns a cross-profile destination.
 */
export function resolveNavFallbackDestinationKey(args: {
  navProfile: NavProfile;
  message: string;
  scenarioLabDestinationKey: string;
  scenarioLabNavEnabled: boolean;
}): string | null {
  const { navProfile, message, scenarioLabDestinationKey, scenarioLabNavEnabled } = args;

  if (navProfile === "admin") {
    if (scenarioLabNavEnabled && isExplicitSimulationIntent(message)) {
      return scenarioLabDestinationKey;
    }
    return resolveAdminNavFallbackKey(message);
  }

  return resolveLpNavDestinationKey(message);
}
