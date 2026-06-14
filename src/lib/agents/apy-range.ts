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
 * sentence that names "APY", quotes at least one percentage, and carries NO
 * genuine numeric range construct — so it can never block a legitimate range
 * ("8 à 15 %", "9.4-12.8%", "entre 8 et 15 %") while still catching a lone APY
 * percentage whose sentence merely happens to contain a bare "à"/"jusqu'à" or a
 * stray hyphen.
 */

/** Non-global so `.test()` is stateless across sentences (no `lastIndex` carry). */
const PERCENT_RE = /\d+(?:[.,]\d+)?\s?%/;

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

/** True when a completed sentence presents an APY as a single point: it names
 *  APY, quotes at least one percentage, and carries NO genuine numeric range
 *  construct. For buffered (non-streamed) text pass `final = true`. */
export function hasSinglePointApy(text: string, final: boolean): boolean {
  for (const sentence of completedSentences(text, final)) {
    if (!/\bAPY\b/i.test(sentence)) continue;
    if (!PERCENT_RE.test(sentence)) continue; // no percentage → nothing quoted
    if (hasNumericRange(sentence)) continue; // genuine fourchette → compliant
    return true;
  }
  return false;
}
