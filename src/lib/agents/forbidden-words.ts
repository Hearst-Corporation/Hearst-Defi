/**
 * Canonical source of truth for the "forbidden words" rule (Non-négociable #5).
 *
 * Hearst agents, wizards, server actions, notification templates and PDF
 * generators must all consume the list and matcher from THIS module. Any
 * divergent re-implementation is forbidden — see
 * `docs/audit/coherence-2026-05-26/06-forbidden-words.md` (P0₂, P2₂).
 *
 * Pure module: no I/O, no Node-only or React-only imports. Safe to import from
 * client components, server actions, agents, hooks, and pure engine helpers.
 *
 * The consolidated list is the SUPERSET of every list previously duplicated
 * across the codebase (see audit table — section "Liste vraie vs liste
 * déclarée"). `"no risk"` lives here too because the canonical agent validator
 * already enforced it; CLAUDE.md and docs/spec/09-agents.mdx will be aligned
 * by Adrien.
 */

export const FORBIDDEN_WORDS = [
  "guarantee",
  "promise",
  "certain",
  "will deliver",
  "risk-free",
  "no risk",
  // EN counterpart of the French "rendement assuré" claim. Closes a real
  // false-negative: "an assured return" alone passed the EN guard while its
  // French equivalent was already blocked (see CHAT_FORBIDDEN_WORDS). The
  // prefix-anchored `\bassured\w*` catches "assured" / "assuredly" but NOT
  // "assurance" (assur-ance ≠ assur-ed) nor "reassured" (no word boundary), so
  // legitimate "product assurance" copy is unaffected, and the negation window
  // still exempts compliant disclaimers ("returns are not assured").
  "assured",
] as const;

export type ForbiddenWord = (typeof FORBIDDEN_WORDS)[number];

/**
 * French-aware needle set for the LP-facing cockpit chat, whose output is in
 * French. This is NOT a divergent re-implementation: it reuses the exact same
 * negation-aware scanning engine (`scanForbidden`) — only the needle list and
 * the negation vocabulary differ.
 *
 * Curation rationale:
 * - "garanti" (inflection `\w*` → garanti/e/s/t/r) is the core claim, but the
 *   REQUIRED disclaimers say "non garanti" / "sans garantie" — so the French
 *   negation set below MUST exempt those, otherwise the guard would block a
 *   compliant answer. The BEFORE-window negation handles that. Note this needle
 *   also matches "garantie des dépôts" (deposit-guarantee fund) — an ACCEPTED
 *   fail-closed case: blocking a regulatory term is the safe direction and the
 *   LP chat never needs to emit it.
 * - "sans risque" starts with a negation word ("sans"), so per the engine rule
 *   it is never exemptable — a "sans risque" claim is always caught.
 * - The bare English "certain" is DELIBERATELY excluded here: in French
 *   "certains/certaine" means "some" and would false-positive constantly. The
 *   French equivalents are added as MULTI-WORD needles ("rendement certain" /
 *   "gain certain") so the bare "certains/certaine" never trips.
 * - "rendement assuré" / "gain assuré" / "rendement est assuré" — same
 *   multi-word guard: bare "assuré" ("insured / policyholder") must not
 *   false-positive, only the yield claim. The copula form ("le rendement est
 *   assuré") is covered by the dedicated "rendement est assuré" needle.
 * - "zéro risque" is a multi-word needle whose first token ("zéro") is not a
 *   negation, so the claim is caught.
 * - "capital protégé" is multi-word so the legitimate custody phrasing
 *   "actifs protégés par Fireblocks" (no "capital" token) is NOT flagged.
 */
export const CHAT_FORBIDDEN_WORDS = [
  // English claims (guard against code-switching / verbatim quotes)
  "guarantee",
  "risk-free",
  "will deliver",
  "promise",
  // English verb-phrase idioms (win-certainty)
  // NOTE: bare "certain" is NOT in this list to avoid false-positives on
  // "certains"=some / "certaine"=some; these multi-word forms close the gap.
  "certain to win",
  "sure to win",
  "certain to double",
  "sure to double",
  "guaranteed to win",
  // French compliance vocabulary
  "garanti",
  "sans risque",
  "aucun risque",
  "sans aucun risque",
  "rendement sûr",
  "placement sûr",
  "rendement certain",
  "gain certain",
  "rendement assuré",
  "rendement est assuré",
  "gain assuré",
  "zéro risque",
  "capital protégé",
  "capital est protégé",
  "protégé contre les pertes",
  "promesse",
  // French verb-phrase idioms — win-certainty (compliance hole #1)
  // NOTE: bare "certain"/"sûr" still excluded (false-positive on "certains"=some,
  // "bien sûr"=of course, "il est sûr de lui"=self-confident). Only MULTI-WORD
  // forms that express an investment win-certainty claim are added here.
  //
  // "à coup sûr" idiom — anchoring strategy:
  //   REMOVED: bare "coup sûr" — it over-matched benign French:
  //     - "un coup sûr et réfléchi" (safe-bet usage) → false positive
  //     - "du premier coup sûrement" → trailing \w* on last token swallowed
  //       "sûrement", firing on "coup sûrement" → false positive
  //   REPLACED with two context-bound needles that require a win-verb nearby:
  //     - "gagner à coup sûr": \b anchors on "gagner" (ASCII); catches
  //       "gagner à coup sûr" and "vous gagnez à coup sûr" (gagner before).
  //     - "coup sûr vous gagnez": \b anchors on "coup" (word-boundary after
  //       space); catches "à coup sûr vous gagnez" (gagnez after).
  //   "bien sûr", "un coup sûr et réfléchi", "premier coup sûrement" all pass.
  //   Leading "à" is non-ASCII — \b before "à" fails — so it is NOT used as the
  //   first token; instead the ASCII anchor word ("gagner" or "coup") carries \b.
  "certain de gagner",
  "certaine de gagner",
  "certains de gagner",
  "certaines de gagner",
  "sûr de gagner",
  "sûre de gagner",
  "sûrs de gagner",
  "assuré de gagner",
  "assurée de gagner",
  "gagner à coup sûr",
  "gagnez à coup sûr",
  "coup sûr vous gagnez",
  "forcément gagner",
  "certain de doubler",
  "sûr de doubler",
  "gagner est certain",
] as const;

/**
 * Result of a forbidden-words scan.
 *
 * `found` is the de-duplicated list of needles that matched, in declaration
 * order. Empty array is NEVER returned — when nothing is found we return
 * `null` so call-sites can branch on a truthy check.
 */
export interface ForbiddenScanResult {
  found: ForbiddenWord[];
}

/** English negation vocabulary — the default, used by `containsForbidden`. */
const EN_NEGATIONS = new Set(["not", "no", "never", "without"]);

/** Chat negation vocabulary — English ∪ French, used by `containsForbiddenChat`
 *  so French disclaimers ("non garanti", "sans garantie", "aucune garantie",
 *  "pas de promesse") correctly exempt the needle they negate. */
const CHAT_NEGATIONS = new Set([
  ...EN_NEGATIONS,
  "ne",
  "pas",
  "non",
  "sans",
  "jamais",
  "aucun",
  "aucune",
  "ni",
]);

/** Escape regex meta-characters in a literal needle. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build the case-insensitive, inflection-aware pattern for a needle.
 *
 * Multi-word needles ("will deliver", "sans risque", "rendement sûr") tolerate
 * any run of whitespace between tokens (`\s+`) so a stray double space
 * ("sans  risque") still matches. Single-word needles keep the exact escaped
 * literal. A trailing `\w*` captures inflections on the final token.
 */
function buildNeedlePattern(needle: string): RegExp {
  const tokens = needle.split(/\s+/);
  const body = tokens.map((t) => escapeRegex(t)).join("\\s+");
  return new RegExp(`\\b${body}\\w*`, "gi");
}

/** Strip non-alpha chars so hyphenated tokens like "guaranteed-not-applicable"
 *  normalise to "guaranteednotapplicable" — used for negation detection.
 *  Keeps accented letters so French negations (e.g. accented forms) survive. */
function stripPunct(word: string): string {
  return word.toLowerCase().replace(/[^a-zà-ÿ]/g, "");
}

/** True when `needle`'s first token is itself a negation word — such needles
 *  (e.g. "no risk", "sans risque") are never exempted: the negation IS the
 *  claim. */
function startsWithNegation(needle: string, negations: Set<string>): boolean {
  const first = needle.toLowerCase().split(/[\s-]+/)[0] ?? "";
  return negations.has(stripPunct(first));
}

/**
 * Returns `true` when a match at `[index, index+matchLength)` is exempted
 * because a negation word from `negations` appears within a 3-word window
 * BEFORE the match — and, when `checkAfter` is `true`, the 3-word window AFTER
 * the match as well.
 *
 * The window is clamped to 100 chars on each side; words split on whitespace
 * or hyphens so "money-back guarantee, not applicable" surfaces "not".
 *
 * `checkAfter` rationale: the EN matcher relies on bidirectional exemption
 * ("money-back guarantee, not applicable" must pass), so it sets
 * `checkAfter: true`. The French chat matcher MUST NOT exempt on a trailing
 * negation — "garanti, sans aucun doute" is a non-compliant claim, not a
 * disclaimer — so it sets `checkAfter: false` (BEFORE-window only).
 *
 * Needles that themselves START with a negation word (e.g. "no risk",
 * "sans risque") are never exempted, because the negation prefix is the needle.
 */
function isNegated(
  text: string,
  needle: string,
  index: number,
  matchLength: number,
  negations: Set<string>,
  {
    checkAfter,
    exemptNegationPrefixed = false,
  }: { checkAfter: boolean; exemptNegationPrefixed?: boolean },
): boolean {
  // A needle whose first token is itself a negation ("sans risque", "no risk")
  // is normally never exempted — the negation IS the claim. But the chat matcher
  // sets `exemptNegationPrefixed` so a SECOND, distinct negation in front of it
  // ("n'est pas sans risque", "ni sans risque") still exempts it: the before-
  // window below never includes the needle's own prefix (it ends at `index`),
  // so a preceding "pas"/"ni"/"aucun" flips a "sans risque" claim into a
  // compliant negation — symmetric with how "garanti" / "non garanti" behaves.
  if (!exemptNegationPrefixed && startsWithNegation(needle, negations)) {
    return false;
  }

  const WINDOW = 3;
  const before = text.slice(Math.max(0, index - 100), index);
  const beforeWords = before.split(/[\s-]+/).filter(Boolean).slice(-WINDOW);

  if (beforeWords.some((w) => negations.has(stripPunct(w)))) return true;
  if (!checkAfter) return false;

  const after = text.slice(index + matchLength, index + matchLength + 100);
  const afterWords = after.split(/[\s-]+/).slice(0, WINDOW);

  return afterWords.some((w) => negations.has(stripPunct(w)));
}

/**
 * Shared negation-aware scanning core. Returns the deduped list of matched
 * needles (declaration order) or `null` when clean. Both public matchers
 * (`containsForbidden` EN, `containsForbiddenChat` FR∪EN) call this — there is
 * a single matching engine, no divergent re-implementation.
 */
function scanForbidden(
  text: string,
  needles: readonly string[],
  negations: Set<string>,
  {
    checkAfter,
    exemptNegationPrefixed = false,
  }: { checkAfter: boolean; exemptNegationPrefixed?: boolean },
): string[] | null {
  if (!text) return null;
  const haystack = text.toLowerCase();
  const found: string[] = [];

  for (const needle of needles) {
    const pattern = buildNeedlePattern(needle);
    let m: RegExpExecArray | null;
    let hit = false;
    while ((m = pattern.exec(haystack)) !== null) {
      if (
        isNegated(haystack, needle, m.index, m[0].length, negations, {
          checkAfter,
          exemptNegationPrefixed,
        })
      )
        continue;
      hit = true;
      break;
    }
    if (hit) found.push(needle);
  }

  return found.length === 0 ? null : found;
}

/**
 * Scan `text` for any forbidden word, case-insensitive, with inflection
 * support (`\bguarantee\w*\b` matches `guarantee`, `guaranteed`,
 * `guarantees`, `guaranteeing`).
 *
 * Returns `{ found }` with the (deduped, declaration-ordered) list of matched
 * needles, or `null` when the text is clean.
 *
 * Negation exemption: a match is silently skipped when a negation word
 * appears in the 3-word window surrounding it — BEFORE or AFTER — so
 * "money-back guarantee, not applicable" passes (e.g. `not guaranteed`).
 * Multi-word needles starting with a negation (`no risk`) are NOT eligible
 * for the exemption — the negation prefix IS the needle.
 */
export function containsForbidden(text: string): ForbiddenScanResult | null {
  const found = scanForbidden(text, FORBIDDEN_WORDS, EN_NEGATIONS, {
    checkAfter: true,
  });
  return found === null ? null : { found: found as ForbiddenWord[] };
}

/**
 * French-aware variant for the cockpit chat output. Scans the curated
 * `CHAT_FORBIDDEN_WORDS` (FR ∪ EN) with the FR ∪ EN negation vocabulary, so
 * required disclaimers like "non garanti" / "sans garantie" are NOT flagged
 * while a bare "garanti" / "sans risque" claim is. Same engine as
 * `containsForbidden`, but the exemption window is BEFORE-only (`checkAfter:
 * false`): a trailing French negation ("garanti, sans aucun doute") is part of
 * a non-compliant claim, not a disclaimer, and must NOT exempt the match.
 */
export function containsForbiddenChat(
  text: string,
): { found: string[] } | null {
  const found = scanForbidden(text, CHAT_FORBIDDEN_WORDS, CHAT_NEGATIONS, {
    checkAfter: false,
    // "sans risque" is exemptable by a preceding negation ("n'est pas sans
    // risque", "ni sans risque") — a compliant refusal, not a claim.
    exemptNegationPrefixed: true,
  });
  return found === null ? null : { found };
}

/**
 * `findForbiddenMatches(text)` — exhaustive match list used by the React
 * wizard hook to position squiggles in the rendered textarea.
 *
 * Returns every non-negated match for every needle, sorted by index.
 * Each entry carries the matched needle, the start index, and the length of
 * the matched substring (including inflectional suffix).
 *
 * This is the granular sibling of `containsForbidden` — the latter answers
 * "is there at least one violation?", this one answers "where exactly?".
 */
export interface ForbiddenMatchRange {
  word: ForbiddenWord;
  index: number;
  length: number;
}

export function findForbiddenMatches(text: string): ForbiddenMatchRange[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const out: ForbiddenMatchRange[] = [];

  for (const word of FORBIDDEN_WORDS) {
    const pattern = buildNeedlePattern(word);
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(lower)) !== null) {
      if (
        isNegated(lower, word, m.index, m[0].length, EN_NEGATIONS, {
          checkAfter: true,
        })
      )
        continue;
      out.push({ word, index: m.index, length: m[0].length });
    }
  }

  out.sort((a, b) => a.index - b.index);
  return out;
}
