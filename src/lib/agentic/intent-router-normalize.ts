/**
 * Deterministic Intent Router v1 — input normalization.
 *
 * Mirrors the accent-stripping approach already used by the nav guard
 * (`nav-fallback-intent.ts#normalize`) so the router and the legacy nav path
 * agree on canonical form — but keeps the ORIGINAL text too, since the nav
 * resolver matches on the raw message.
 *
 * Steps:
 *   1. Unicode NFD decomposition + combining-mark strip (é→e, à→a, ç→c, …)
 *   2. FR/EN apostrophe variants (’ ‘ ` ´) → space (so "n'ouvre"/"explique-moi"
 *      split cleanly into tokens)
 *   3. Lowercase
 *   4. Any non-alphanumeric run → single space
 *   5. Collapse whitespace + trim
 *
 * Pure: no I/O.
 */

export interface NormalizedIntentInput {
  /** Canonical form the rules run against. */
  normalized: string;
  /** The caller's original message, untouched (the nav resolver needs it raw). */
  original: string;
}

const COMBINING_MARKS = /[̀-ͯ]/g;
const APOSTROPHES = /[’‘`´']/g;
const NON_ALNUM = /[^a-z0-9]+/g;

export function normalizeIntentInput(raw: string): NormalizedIntentInput {
  const original = typeof raw === "string" ? raw : "";
  const normalized = original
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(APOSTROPHES, " ")
    .toLowerCase()
    .replace(NON_ALNUM, " ")
    .trim();
  return { normalized, original };
}

/** Token count of the normalized string (0 for empty). */
export function tokenCount(normalized: string): number {
  if (!normalized) return 0;
  return normalized.split(" ").filter(Boolean).length;
}
