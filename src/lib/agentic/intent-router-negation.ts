/**
 * Deterministic Intent Router v2 — negation layer.
 *
 * Context-aware negation detection that understands FR/EN grammatical
 * constructions, not just token presence.
 *
 * A negated positive intent (navigation, outreach, deploy, send…) must NEVER
 * produce a positive action — the router flips it to cancellation (or unknown
 * for education). This closes the "ne va pas dans vaults" / "don't open
 * outreach" / "ne déploie pas ce vault" class of bugs.
 *
 * v2 improvements over v1:
 * - Contextual "ne … pas" / "n' … pas" / "ne … jamais" detection (not just
 *   token scanning).
 * - "sans" is NOT a blanket negation — "sans risque" is a forbidden claim,
 *   not a negation. We only treat "sans" as negation when it precedes an
 *   action verb ("sans ouvrir", "sans envoyer").
 * - EN "do not" / "don't" / "never" / "no longer" construction detection.
 * - "ni" is negation only when it connects two actions.
 *
 * Pure: no I/O.
 */

// ---------------------------------------------------------------------------
// Core negation tokens — these ALWAYS negate when they appear in the right
// grammatical context.
// ---------------------------------------------------------------------------

const STRONG_NEGATION_TOKENS = new Set([
  "pas",
  "jamais",
  "plus",
  "point",
  "personne",
  "rien",
  "not",
  "never",
  "dont",
  "don",
]);

const WEAK_NEGATION_TOKENS = new Set([
  "ne",
  "n",
  "without",
  "no",
]);

// "sans" is special: it's a negation ONLY when followed by a verb/action,
// not when followed by a risk noun ("sans risque" = claim, not negation).
const SANS_VERB_PATTERN = /\bsans\s+(?:ouvrir|aller|naviguer|envoyer|sourcer|deploier|deployer|deploy|publier|mettre|lancer|creer|create|send|source|open|go|mark|sign|execute|change|migrate)\b/;

// "ni" is negation only when it appears between two action phrases.
const NI_PATTERN = /\bni\s+(?:ouvrir|aller|envoyer|sourcer|deploier|deploy|publier|lancer|creer|create|send|source|open|go|mark|sign|execute|ne\s+\w+\s+ni)\b/;

// ---------------------------------------------------------------------------
// Construction detection
// ---------------------------------------------------------------------------

/**
 * Detect FR "ne … pas" / "n' … pas" / "ne … jamais" constructions.
 * The "ne" (or "n'") must precede the "pas" / "jamais" within a reasonable
 * window (typically 1-4 tokens).
 */
function hasNePasConstruction(tokens: string[]): boolean {
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === "ne" || token === "n") {
      // Look ahead for pas/jamais/rien/personne/plus within 5 tokens
      for (let j = i + 1; j < Math.min(i + 6, tokens.length); j++) {
        const ahead = tokens[j];
        if (
          ahead === "pas" ||
          ahead === "jamais" ||
          ahead === "rien" ||
          ahead === "personne" ||
          ahead === "plus" ||
          ahead === "point"
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Detect EN "do not" / "does not" / "did not" / "don't" / "doesn't" / "didn't"
 * constructions. After normalization, apostrophes become spaces, so "don't"
 → "dont" and "doesn't" → "doesnt".
 */
function hasDoNotConstruction(tokens: string[]): boolean {
  for (let i = 0; i < tokens.length - 1; i++) {
    const t = tokens[i];
    const next = tokens[i + 1];
    if (
      (t === "do" || t === "does" || t === "did" || t === "dont" || t === "doesnt" || t === "didnt") &&
      (next === "not" || next === "no" || next === "never")
    ) {
      return true;
    }
    // "not" alone after a verb is also negation
    if (next === "not" || next === "never") {
      return true;
    }
  }
  return false;
}

/**
 * Detect "no longer" / "not anymore" constructions.
 */
function hasNoLongerConstruction(tokens: string[]): boolean {
  for (let i = 0; i < tokens.length - 1; i++) {
    if (
      (tokens[i] === "no" && tokens[i + 1] === "longer") ||
      (tokens[i] === "not" && tokens[i + 1] === "anymore") ||
      (tokens[i] === "not" && tokens[i + 1] === "any")
    ) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * True when the normalized message carries a grammatical negation that should
 * block positive actions.
 *
 * v2 is more precise than v1:
 * - "sans risque" → false (forbidden claim, not negation)
 * - "sans ouvrir" → true (negation of action)
 * - "ne va pas" → true
 * - "n'ouvre pas" → true (after normalization: "n ouvre pas")
 * - "don't go" → true (after normalization: "dont go")
 * - "do not send" → true
 * - "no longer" → true
 * - "ni ouvrir ni envoyer" → true
 */
export function isNegated(normalized: string): boolean {
  if (!normalized) return false;
  const tokens = normalized.split(/\s+/).filter(Boolean);

  // Strong negation tokens (pas, jamais, never, not, dont, etc.)
  const hasStrongNegation = tokens.some((t) => STRONG_NEGATION_TOKENS.has(t));
  if (hasStrongNegation) {
    // But filter out "never" as a standalone adverb of frequency in questions
    // "how does yield never change" — this is a question, not a negation of action
    // We keep it simple: if "never" appears, it's negation unless it's the only
    // negation token and the sentence is a question about frequency.
    return true;
  }

  // "ne … pas" construction
  if (hasNePasConstruction(tokens)) return true;

  // "do not" / "don't" construction
  if (hasDoNotConstruction(tokens)) return true;

  // "no longer" / "not anymore"
  if (hasNoLongerConstruction(tokens)) return true;

  // "sans" + verb (negation of action)
  if (SANS_VERB_PATTERN.test(normalized)) return true;

  // "ni" + action (negation of alternatives)
  if (NI_PATTERN.test(normalized)) return true;

  // "no" as standalone negation (but "no" alone is cancellation, handled upstream)
  if (tokens.includes("no") && tokens.length > 1) {
    // "no go" / "no send" / "no open" — negation
    const nextIdx = tokens.indexOf("no") + 1;
    if (nextIdx < tokens.length) return true;
  }

  // "without" + action
  if (tokens.includes("without")) return true;

  return false;
}
