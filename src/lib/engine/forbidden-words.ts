/**
 * forbidden-words.ts — PURE engine module (zero I/O, zero nondeterminism).
 *
 * Single source of truth for the compliance forbidden-words list shared across
 * all engine files (scenario.ts, backtest.ts, rebalancing-rules.ts,
 * btc-tactical.ts).
 *
 * Design constraints (engine purity rule #6):
 *   - NO imports of prisma, fetch, fs, Date.now(), Math.random(), process.env
 *   - NO imports from src/lib/agents/*, src/app/*, src/components/*
 *   - Only plain data + pure functions
 *
 * NOTE: src/lib/agents/validators.ts maintains its OWN copy of this list for
 * the agent compliance guard. That copy is intentionally separate — agents sit
 * ABOVE the engine in the dependency graph and must not create a circular dep.
 * When updating this list, also update agents/validators.ts and vice-versa.
 */

// ---------------------------------------------------------------------------
// Canonical forbidden-words list
// ---------------------------------------------------------------------------

export const FORBIDDEN_WORDS = [
  "guarantee",
  "promise",
  "certain",
  "will deliver",
  "risk-free",
  "no risk",
] as const;

export type ForbiddenWord = (typeof FORBIDDEN_WORDS)[number];

// ---------------------------------------------------------------------------
// Core helper — returns the matched needle or null
// ---------------------------------------------------------------------------

/**
 * Tests a single lowercase haystack string against the forbidden-words list.
 * Returns the first matching needle (as the original cased string from the
 * list) if a bare (non-negated) match is found, or `null` if clean.
 *
 * Negation check: if the needle is preceded by "not", "no", "never", or
 * "without" (with up to 3 intervening words), the match is not flagged.
 * Needles that themselves start with a negation word (e.g. "no risk") are
 * also handled correctly — they are matched as written and are NOT exempt from
 * the negation rule since they already embed the negation.
 *
 * Pure function — same input always returns the same output. No I/O.
 */
export function findForbiddenWord(line: string): ForbiddenWord | null {
  const haystack = line.toLowerCase();
  for (const needle of FORBIDDEN_WORDS) {
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const needlePattern = new RegExp(`\\b${escaped}\\w*`);
    if (!needlePattern.test(haystack)) continue;
    const needleStartsWithNegation = /^(not|no|never|without)\b/.test(needle);
    if (!needleStartsWithNegation) {
      const negatedPattern = new RegExp(
        `\\b(not|no|never|without)\\s+(\\w+\\s+){0,3}${escaped}`,
      );
      if (negatedPattern.test(haystack)) continue;
    }
    return needle;
  }
  return null;
}
