/**
 * wording-series1 — pure wording guard for Series 1 (Hearst Mining Note, v3.0).
 *
 * Series 1 is a BTC-accumulation instrument: BTC accumulated over a 24-month term,
 * delivered at maturity, disclosed as a NON-guaranteed range. It has NO leverage
 * mechanics. The borrow / LTV / Morpho / liquidation / collateral-loan model belongs
 * to a SEPARATE sandbox research surface (e.g. /portfolio/preview, admin research) and
 * must NEVER appear on an investor-facing Series 1 surface (Option B, release cutover).
 *
 * This module is a PURE function (no I/O, no DB, no fetch) so it can be called from any
 * surface — Server Component, action, or agent output guard — to assert that copy bound
 * for a Series 1 investor surface is free of the banned leverage vocabulary.
 */

/**
 * Terms forbidden on any investor-facing Series 1 surface. Matched case-insensitively
 * on word boundaries so "LTV" hits but "loyalty" does not. Multi-word terms
 * ("collateral loan") tolerate arbitrary internal whitespace.
 */
export const SERIES1_BANNED_TERMS: readonly string[] = [
  "borrow",
  "borrowing",
  "LTV",
  "LLTV",
  "Morpho",
  "liquidation",
  "liquidate",
  "collateral loan",
  "collateralized loan",
  "collateralised loan",
  "collateral",
  "collateralised",
  "collateralized",
  "leverage",
  "leveraged",
] as const;

/** One detected banned-term occurrence. */
export interface Series1WordingHit {
  /** The banned term (as declared in SERIES1_BANNED_TERMS). */
  readonly term: string;
  /** The exact substring matched in the input text. */
  readonly match: string;
  /** Zero-based character index of the match in the input. */
  readonly index: number;
}

/** Result of scanning a piece of text against the Series 1 wording rules. */
export interface Series1WordingResult {
  /** true when NO banned term was found — safe for a Series 1 investor surface. */
  readonly ok: boolean;
  /** Every banned-term occurrence found, in order of appearance. */
  readonly hits: readonly Series1WordingHit[];
}

/** Escape a term for use inside a RegExp source. */
function escapeRegExp(source: string): string {
  return source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build a word-boundary matcher for one banned term. Internal spaces become `\s+`
 * so "collateral loan" also catches "collateral  loan" / "collateral\nloan".
 */
function termPattern(term: string): RegExp {
  const body = term
    .trim()
    .split(/\s+/)
    .map(escapeRegExp)
    .join("\\s+");
  return new RegExp(`\\b${body}\\b`, "gi");
}

const TERM_MATCHERS: ReadonlyArray<{ term: string; re: RegExp }> = SERIES1_BANNED_TERMS.map(
  (term) => ({ term, re: termPattern(term) }),
);

/**
 * Scan `text` for Series 1 banned leverage vocabulary.
 *
 * Pure: no side effects, deterministic. Returns every occurrence so callers can report
 * precisely what tripped the guard.
 */
export function scanSeries1Wording(text: string): Series1WordingResult {
  if (!text) return { ok: true, hits: [] };

  const hits: Series1WordingHit[] = [];
  for (const { term, re } of TERM_MATCHERS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      hits.push({ term, match: m[0], index: m.index });
      // Guard against zero-length matches looping forever.
      if (m.index === re.lastIndex) re.lastIndex += 1;
    }
  }

  hits.sort((a, b) => a.index - b.index);
  return { ok: hits.length === 0, hits };
}

/**
 * Convenience boolean: true when `text` contains at least one banned Series 1 term.
 */
export function hasSeries1BannedWording(text: string): boolean {
  return !scanSeries1Wording(text).ok;
}
