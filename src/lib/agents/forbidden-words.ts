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
 *   compliant answer. That is exactly what the negation window handles.
 * - "sans risque" starts with a negation word ("sans"), so per the engine rule
 *   it is never exemptable — a "sans risque" claim is always caught.
 * - The bare English "certain" is DELIBERATELY excluded here: in French
 *   "certains/certaine" means "some" and would false-positive constantly.
 */
export const CHAT_FORBIDDEN_WORDS = [
  // English claims (guard against code-switching / verbatim quotes)
  "guarantee",
  "risk-free",
  "will deliver",
  "promise",
  // French compliance vocabulary
  "garanti",
  "sans risque",
  "rendement sûr",
  "promesse",
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
 * BEFORE or AFTER the match.
 *
 * The window is clamped to 100 chars on each side; words split on whitespace
 * or hyphens so "money-back guarantee, not applicable" surfaces "not".
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
): boolean {
  if (startsWithNegation(needle, negations)) return false;

  const WINDOW = 3;
  const before = text.slice(Math.max(0, index - 100), index);
  const after = text.slice(index + matchLength, index + matchLength + 100);

  const beforeWords = before.split(/[\s-]+/).filter(Boolean).slice(-WINDOW);
  const afterWords = after.split(/[\s-]+/).slice(0, WINDOW);

  return [...beforeWords, ...afterWords].some((w) =>
    negations.has(stripPunct(w)),
  );
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
): string[] | null {
  if (!text) return null;
  const haystack = text.toLowerCase();
  const found: string[] = [];

  for (const needle of needles) {
    const pattern = new RegExp(`\\b${escapeRegex(needle)}\\w*`, "gi");
    let m: RegExpExecArray | null;
    let hit = false;
    while ((m = pattern.exec(haystack)) !== null) {
      if (isNegated(haystack, needle, m.index, m[0].length, negations)) continue;
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
 * appears in the 3-word window surrounding it (e.g. `not guaranteed`).
 * Multi-word needles starting with a negation (`no risk`) are NOT eligible
 * for the exemption — the negation prefix IS the needle.
 */
export function containsForbidden(text: string): ForbiddenScanResult | null {
  const found = scanForbidden(text, FORBIDDEN_WORDS, EN_NEGATIONS);
  return found === null ? null : { found: found as ForbiddenWord[] };
}

/**
 * French-aware variant for the cockpit chat output. Scans the curated
 * `CHAT_FORBIDDEN_WORDS` (FR ∪ EN) with the FR ∪ EN negation vocabulary, so
 * required disclaimers like "non garanti" / "sans garantie" are NOT flagged
 * while a bare "garanti" / "sans risque" claim is. Same engine as
 * `containsForbidden`.
 */
export function containsForbiddenChat(
  text: string,
): { found: string[] } | null {
  const found = scanForbidden(text, CHAT_FORBIDDEN_WORDS, CHAT_NEGATIONS);
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
    const pattern = new RegExp(`\\b${escapeRegex(word)}\\w*`, "gi");
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(lower)) !== null) {
      if (isNegated(lower, word, m.index, m[0].length)) continue;
      out.push({ word, index: m.index, length: m[0].length });
    }
  }

  out.sort((a, b) => a.index - b.index);
  return out;
}
