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

/**
 * Retired v1 YIELD vocabulary. Series 1 accumulates BTC and delivers it at
 * maturity: it pays no rate and makes no periodic cash distribution, so a rate
 * word on an investor surface is a product lie, not just a style issue.
 *
 * Kept separate from the leverage list because the two describe different
 * failures: leverage terms describe a mechanism the product does not have,
 * these describe a payout the product does not make.
 *
 * NOTE: "yield" alone is deliberately absent — it is legitimate in physical
 * mining contexts ("hashrate yield") and in honest negations. The banned forms
 * are the product-naming and rate-promising ones.
 */
export const SERIES1_BANNED_YIELD_TERMS: readonly string[] = [
  "yield vault",
  "mining yield",
  "yield range",
  "APY",
  "monthly USDC distribution",
  "monthly USDC distributions",
  "monthly distribution",
  "monthly distributions",
  "coupon",
  "DeFi yield",
  "select a product",
  "investment flow",
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

const YIELD_TERM_MATCHERS: ReadonlyArray<{ term: string; re: RegExp }> =
  SERIES1_BANNED_YIELD_TERMS.map((term) => ({ term, re: termPattern(term) }));

/**
 * Honest NEGATIONS an investor surface is expected to carry. Series 1 must be
 * able to say "no fixed rate" or "no periodic distribution" — stripping these
 * before the scan is what lets the guard ban the promise without banning the
 * disclaimer. Same technique the deposit-summary test uses for "not guaranteed".
 */
const ALLOWED_NEGATIONS: readonly RegExp[] = [
  /\bno\s+(?:fixed\s+)?(?:cash\s+)?(?:periodic\s+)?(?:monthly\s+)?(?:USDC\s+)?distributions?\b/gi,
  /\bno\s+periodic\s+cash\b/gi,
  /\bno\s+fixed\s+(?:rate|APY)\b/gi,
  /\bnever\s+a\s+rate\b/gi,
  /\bnot\s+distributed\b/gi,
];

/**
 * Scan text bound for a Series 1 investor surface against BOTH banned families
 * (leverage mechanics + retired yield vocabulary), after removing the honest
 * negations a compliant surface is required to state.
 *
 * Use this on rendered investor markup; use `scanSeries1Wording` when you only
 * care about the leverage family (e.g. the sandbox research boundary).
 */
export function scanSeries1InvestorWording(text: string): Series1WordingResult {
  if (!text) return { ok: true, hits: [] };

  // Blank out allowed negations, preserving offsets so reported indexes still
  // point at the right place in the original text.
  let scannable = text;
  for (const re of ALLOWED_NEGATIONS) {
    re.lastIndex = 0;
    scannable = scannable.replace(re, (m) => " ".repeat(m.length));
  }

  const leverage = scanSeries1Wording(scannable);
  const hits: Series1WordingHit[] = [...leverage.hits];

  for (const { term, re } of YIELD_TERM_MATCHERS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(scannable)) !== null) {
      hits.push({ term, match: m[0], index: m.index });
      if (m.index === re.lastIndex) re.lastIndex += 1;
    }
  }

  hits.sort((a, b) => a.index - b.index);
  return { ok: hits.length === 0, hits };
}
