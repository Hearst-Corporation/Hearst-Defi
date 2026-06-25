/**
 * Deterministic Intent Router v1 — negation layer.
 *
 * Runs on the NORMALIZED input (accents already stripped, so "n'ouvre" →
 * "n ouvre", "déploie" → "deploie"). A negated positive intent (navigation,
 * outreach setup, deploy, send…) must NEVER produce a positive action — the
 * router flips it to `cancellation` (or `unknown` for education). This closes the
 * "ne va pas dans vaults" / "don't open outreach" / "ne déploie pas ce vault"
 * class of bugs.
 *
 * Pure: no I/O.
 */

/**
 * Negation markers (FR ∪ EN), each a whole normalized token.
 * - FR: ne / n / pas / jamais / sans / aucun / aucune / ni
 * - EN: not / no / never / without / dont (don't → "dont" after apostrophe strip)
 *
 * "no" is included but, because it matches the standalone cancellation token too,
 * the router treats a bare "no"/"non" as cancellation directly — here it only
 * serves to negate a longer sentence ("no don't go to vaults").
 */
const NEGATION_TOKENS = new Set([
  "ne",
  "n",
  "pas",
  "jamais",
  "sans",
  "aucun",
  "aucune",
  "ni",
  "not",
  "no",
  "never",
  "without",
  "dont",
  "don",
]);

/**
 * True when the normalized message carries a negation. We scan tokens rather than
 * a loose regex so "sans" inside an unrelated word can't false-fire (tokens are
 * exact). The "ne … pas" wrap, bare "pas/jamais", and EN "not/don't/never/without"
 * all surface here.
 */
export function detectNegation(normalized: string): boolean {
  if (!normalized) return false;
  const tokens = normalized.split(" ").filter(Boolean);
  return tokens.some((t) => NEGATION_TOKENS.has(t));
}

/**
 * Some affirmatives embed a negation token as a substring of intent ("sans
 * risque" is a forbidden CLAIM, handled by the compliance guard, not here). The
 * router only uses `detectNegation` to decide routing, never to assert
 * compliance — so this stays intentionally simple and conservative: ANY negation
 * token present ⇒ do not emit a positive action.
 */
export function isNegated(normalized: string): boolean {
  return detectNegation(normalized);
}
