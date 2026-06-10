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
 * Result of a forbidden-words scan.
 *
 * `found` is the de-duplicated list of needles that matched, in declaration
 * order. Empty array is NEVER returned — when nothing is found we return
 * `null` so call-sites can branch on a truthy check.
 */
export interface ForbiddenScanResult {
  found: ForbiddenWord[];
}

const NEGATION_WORDS = new Set(["not", "no", "never", "without"]);

/** Escape regex meta-characters in a literal needle. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Strip non-alpha chars so hyphenated tokens like "guaranteed-not-applicable"
 *  normalise to "guaranteednotapplicable" — used for negation detection. */
function stripPunct(word: string): string {
  return word.toLowerCase().replace(/[^a-z]/g, "");
}

/**
 * Returns `true` when a match at `[index, index+matchLength)` is exempted
 * because a negation word ("not" / "no" / "never" / "without") appears within
 * a 3-word window BEFORE or AFTER the match.
 *
 * The window is clamped to 100 chars on each side; words split on whitespace
 * or hyphens so "money-back guarantee, not applicable" surfaces "not".
 *
 * Needles that themselves START with a negation word (e.g. "no risk") are
 * never exempted by negation, because the negation prefix is the needle.
 */
function isNegated(
  text: string,
  needle: string,
  index: number,
  matchLength: number,
): boolean {
  if (/^(not|no|never|without)\b/.test(needle)) return false;

  const WINDOW = 3;
  const before = text.slice(Math.max(0, index - 100), index);
  const after = text.slice(index + matchLength, index + matchLength + 100);

  const beforeWords = before.split(/[\s-]+/).filter(Boolean).slice(-WINDOW);
  const afterWords = after.split(/[\s-]+/).slice(0, WINDOW);

  return [...beforeWords, ...afterWords].some((w) =>
    NEGATION_WORDS.has(stripPunct(w)),
  );
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
  if (!text) return null;
  const haystack = text.toLowerCase();
  const found: ForbiddenWord[] = [];

  for (const needle of FORBIDDEN_WORDS) {
    const pattern = new RegExp(`\\b${escapeRegex(needle)}\\w*`, "gi");
    let m: RegExpExecArray | null;
    let hit = false;
    while ((m = pattern.exec(haystack)) !== null) {
      if (isNegated(haystack, needle, m.index, m[0].length)) continue;
      hit = true;
      break;
    }
    if (hit) found.push(needle);
  }

  return found.length === 0 ? null : { found };
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
