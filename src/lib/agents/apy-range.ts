/**
 * Single source of truth for non-negotiable #1 — "APY is always a range, never
 * a single point" (e.g. `9.4-12.8%`, not `11%`). Pure and dependency-free.
 *
 * Consumed by BOTH:
 *  - the LP chat output guard (`src/lib/llm/output-guard.ts`), on the streamed
 *    prose, and
 *  - the batch-agent output validator (`src/lib/agents/validators.ts`), on the
 *    structured narrative fields.
 * So the chat and the four agents enforce the EXACT same rule with no divergent
 * regex logic (this module used to live inline in output-guard; it was lifted
 * here so the agents could share it without depending on the chat layer).
 *
 * The detection is deliberately CONSERVATIVE: it only fires on a completed
 * sentence where a yield keyword (APY, yield/yields, return/returns, or the
 * French equivalents rendement/rendements) is paired with a percentage via a
 * yield-amount connector (de, of, exactly, is, are, at, à, est, equals), AND
 * the sentence carries NO genuine numeric range construct — so it never blocks
 * a legitimate fourchette ("8 à 15 %", "9.4-12.8%", "entre 8 et 15 %") while
 * still catching single-point claims.
 *
 * The connector requirement (vs. the old topic-gate + any-% approach) prevents
 * false fires when "returns"/"yields" are used as VERBS and an unrelated
 * percentage (a fee, a drawdown, downtime) appears elsewhere in the sentence
 * (compliance regression closed alongside holes #2 + #3).
 */

import { normalizeForScan } from "@/lib/agents/forbidden-words";

/**
 * Yield-claim detector: two-tier strategy that catches all single-point yield
 * claims while blocking false fires from verb-sense uses of "yields/returns".
 *
 * TIER 1 — APY and rendement(s): these words are unambiguous NOUNS in financial
 * prose (you cannot "APY" capital; you cannot "rendement" a baseline). Any %
 * within 60 chars of these keywords is treated as a yield claim. No connector
 * required. Window stops at sentence boundaries (.!?\n) so a keyword in one
 * sentence never links to a % in the next.
 *
 * TIER 2 — yields? and returns?: these are high-frequency English verbs. The %
 * must be DIRECTLY attached: connected by an explicit yield-amount word
 * (exactly, of, is, are, at, equals) immediately between the keyword and the
 * number, with no clause-breaking punctuation (;,) in between. This eliminates:
 *   "returns capital monthly … 2% fee"  — no connector between "returns" and "2%"
 *   "Hashprice returns to baseline after a 3% drawdown" — no connector
 *   "Mining yields fluctuate … up to 5%" — no connector
 * While preserving:
 *   "yields exactly 9.4%"  — connector "exactly"
 *   "returns exactly 11%"  — connector "exactly"
 *   "return of 9.4%"       — connector "of" (note: "return" singular = noun)
 *
 * Pattern B (% before keyword): catches reversed forms like "9.4-12.8% APY"
 * (excused by hasNumericRange) and "our return is exactly 11%".
 */
const YIELD_CLAIM_RE = new RegExp(
  // TIER 1a: APY anywhere within 60 chars before a percentage
  "\\bAPY\\b[^.!?\\n]{0,60}?\\d+(?:[.,]\\d+)?\\s?%" +
  "|" +
  // TIER 1b: rendement(s) anywhere within 60 chars before a percentage
  "\\brendements?\\b[^.!?\\n]{0,60}?\\d+(?:[.,]\\d+)?\\s?%" +
  "|" +
  // TIER 2: yields? or returns? + explicit connector + number+%
  // Connector words: exactly, of, is, are, at, equals
  // No clause-break (;, comma, or sentence punct) allowed in the span.
  "\\b(?:yields?|returns?)\\b[^.!?\\n;,]{0,20}?\\b(?:exactly|of|is|are|at|equals)\\b[^.!?\\n;,]{0,20}?\\d+(?:[.,]\\d+)?\\s?%" +
  "|" +
  // Pattern B: number+% then ≤30 chars then yield keyword (reversed, e.g. "11% APY")
  "\\d+(?:[.,]\\d+)?\\s?%[^.!?\\n]{0,30}?\\b(?:APY|yields?|returns?|rendements?)\\b",
  "i",
);

/**
 * A genuine PERCENTAGE range construct: two numbers joined by a range connector
 * where the construct itself carries a `%`. Requiring the `%` INSIDE the range
 * is what stops an incidental numeric range elsewhere in the sentence ("sur 8 à
 * 15 fermes", "entre 2024 et 2026", "3-4 fois le livret A") from excusing a
 * single-point APY percentage. An APY fourchette is ALWAYS quoted in % — "8 à
 * 15 %", "9.4-12.8%", "8 % et 15 %" — so the genuine range always has a % within
 * it, while a bare "<num> à <num>" of farms/years/multiples does not.
 *
 * Connectors: "à", "to", "et", or a dash (- – —).
 */
const PERCENT_RANGE_RE = /\d[\d.,\s]*%?\s*(?:à|to|et|[-–—])\s*\d[\d.,\s]*%/i;

/**
 * "entre <num>[%] ... et <num> %" — the canonical French range phrasing. The
 * `%` must attach to the SECOND operand directly, so an incidental "entre 2024
 * et 2026" followed later by a lone "11 %" does NOT match.
 */
const ENTRE_RANGE_RE = /\bentre\b[^.!?\n]*?\d[^.!?\n]*?\bet\b[^\d.!?\n]*?\d[\d.,\s]*%/i;

/** Explicit range vocabulary that always denotes a fourchette. */
const RANGE_WORD_RE = /\b(?:fourchette|range)\b/i;

/**
 * Yield-SOURCE attribution exemption (non-négociable #1 scope guard).
 *
 * Rule #1 forbids quoting the vault's HEADLINE / expected APY as a single point
 * ("11 %" instead of "8 à 15 %"). It does NOT forbid explaining WHERE the yield
 * comes from: a component breakdown legitimately quotes each source's point
 * contribution — the methodology itself states "mining ~6,2 %, USDC base ~4,8 %,
 * réserve stable ~4,5 %". Those per-source figures are not a headline claim, they
 * sum INTO the 8–15 % range.
 *
 * Without this exemption the guard blocked the educational answer to "explique
 * comment fonctionne le yield" (the model faithfully reproduces the source
 * figures). We exempt a sentence ONLY when it carries BOTH:
 *   1. a contribution/attribution cue (provient, contribue, via, généré par…), AND
 *   2. a named yield COMPONENT (mining, T-bills, USDC base, lending, réserve…).
 *
 * Requiring BOTH signals keeps the headline rule intact: "le rendement annualisé
 * du vault est de 11 %" has neither a component noun nor a contribution cue, so it
 * is still blocked — as is any forbidden-words claim (handled separately).
 */
const CONTRIBUTION_CUE_RE =
  /\b(?:provient|proviennent|provenance|contribue|contribuent|contribution|via|issus?|issue|généré|genere|génère|genère|apporte|apportent|représente|representente|representent|composé|compose|composée|réparti|repartie|répartie|décompos|decompos|rev[-\s]?share|revenue\s+share|part\s+de)\b/i;

const YIELD_COMPONENT_RE =
  /\b(?:mining|t[-\s]?bills?|usdc|lending|aave|compound|staking|réserve|reserve|basis|funding|trésorerie|treasury|obligations|rev[-\s]?share)\b/i;

/**
 * True when the sentence attributes a percentage to a specific yield SOURCE /
 * component (a breakdown), rather than stating the headline APY. Requires both a
 * contribution cue AND a component noun so it cannot launder a headline claim.
 */
export function hasSourceAttribution(sentence: string): boolean {
  return CONTRIBUTION_CUE_RE.test(sentence) && YIELD_COMPONENT_RE.test(sentence);
}

/** True when the sentence contains a genuine PERCENTAGE range construct (a range
 *  that itself carries a `%`), or explicit fourchette/range vocabulary. A bare
 *  numeric range with no `%` in it (farms, years, multiples) does NOT count. */
export function hasNumericRange(sentence: string): boolean {
  return (
    PERCENT_RANGE_RE.test(sentence) ||
    ENTRE_RANGE_RE.test(sentence) ||
    RANGE_WORD_RE.test(sentence)
  );
}

/** Split into sentences. When `final` is false, the trailing fragment (not yet
 *  terminated by . ! ? or newline) is dropped — it may still be growing and a
 *  range could complete in a later chunk (streaming case). */
export function completedSentences(text: string, final: boolean): string[] {
  const parts = text.split(/(?<=[.!?\n])\s+/);
  if (!final && !/[.!?\n]\s*$/.test(text)) {
    parts.pop();
  }
  return parts.filter((s) => s.trim().length > 0);
}

/**
 * True when a completed sentence presents a yield as a single point: YIELD_CLAIM_RE
 * detects a yield-amount pattern, and the sentence carries NO genuine numeric range
 * construct. For buffered (non-streamed) text pass `final = true`.
 *
 * The two-tier YIELD_CLAIM_RE prevents false fires when "returns"/"yields" are
 * used as VERBS with an unrelated percentage elsewhere in the sentence (Tier 1
 * covers APY/rendement with a loose window; Tier 2 requires an explicit connector
 * for the ambiguous yields/returns):
 *   ✗ "The vault returns capital monthly and charges a 2% management fee."
 *   ✗ "Mining yields fluctuate, and downtime can be up to 5% in a bad month."
 *   ✗ "Hashprice returns to baseline after a 3% drawdown in week one."
 *   ✓ "yields exactly 9.4%"   — Tier 2, connector "exactly"
 *   ✓ "rendement de 12%"      — Tier 1b, rendement within 60 chars
 *   ✓ "APY 11%"               — Tier 1a, APY within 60 chars
 *
 * Exemption order (MUST remain in this order):
 *   1. Claim gate (YIELD_CLAIM_RE) — skip sentences with no yield-amount
 *      pattern (verb-sense uses and unrelated % are excluded here).
 *   2. Range exemption (hasNumericRange) — pass compliant fourchettes through.
 *   3. Source attribution (hasSourceAttribution) — a per-source component
 *      contribution ("mining contribue ~6,2 %") is not the headline APY.
 *   4. Fire — the sentence is a single-point yield claim.
 */
export function hasSinglePointApy(text: string, final: boolean): boolean {
  // Unicode bypass defense (parity with the forbidden-words scan): fold
  // compatibility forms + recompose decomposed accents and strip zero-width
  // separators so a "1​1 %" or fullwidth "１１ %" single-point claim can't slip
  // past the yield-claim regex. Display/persistence still use the original text.
  const normalized = normalizeForScan(text);
  for (const sentence of completedSentences(normalized, final)) {
    if (!YIELD_CLAIM_RE.test(sentence)) continue; // no yield-amount pattern → skip
    if (hasNumericRange(sentence)) continue;       // genuine fourchette → compliant
    if (hasSourceAttribution(sentence)) continue;  // yield-source breakdown → compliant
    return true;
  }
  return false;
}
