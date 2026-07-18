/**
 * Output-side compliance guard for the LP-facing cockpit chat stream.
 *
 * The chat answer is streamed token-by-token from the model. Unlike the four
 * structured agents (which lint their buffered output via assertNoForbiddenWords),
 * the chat had NO output-side guardrail — so a prompt-override or model slip
 * could stream a non-compliant claim ("rendement garanti", a single-point APY)
 * straight to an investor. This module wraps the stream and enforces the same
 * forbidden-vocabulary rule plus the APY-always-a-range rule, aborting the
 * stream before the offending span is emitted.
 *
 * Design:
 * - Reuses `containsForbiddenChat` (the canonical FR∪EN, negation-aware matcher)
 *   so the chat enforces the SAME vocabulary as the agents — no divergent list.
 * - A look-back buffer of SETTLE chars is held back from emission so a forbidden
 *   needle (or a completing sentence) is detected while still un-emitted.
 * - The APY single-point check delegates to `hasSinglePointApy` in
 *   `@/lib/agents/apy-range` — see that module for the full detection contract.
 * - On a violation the stream emits the `\x00ERROR:` sentinel understood by the
 *   cockpit-shell client (no new client contract). The text AFTER the marker is
 *   what the client shows the user via `setError(...)`, so it is a human
 *   message — not a raw technical token (the client would otherwise surface
 *   "content_blocked" verbatim to an investor).
 */

import {
  containsForbiddenChat,
  normalizeForScan,
} from "@/lib/agents/forbidden-words";
// Single source of truth for the APY-always-a-range rule (#1), shared with the
// batch-agent validator so chat and agents enforce identical logic.
import {
  hasSinglePointApy,
  completedSentences,
  hasNumericRange,
  hasSourceAttribution,
} from "@/lib/agents/apy-range";

/**
 * Sentinel the cockpit-shell client parses to surface a stream error. The
 * client takes the first line AFTER `\x00ERROR:` and calls `setError(...)` with
 * it, so the suffix must be a user-readable message, not a technical token.
 */
export const BLOCK_SENTINEL =
  "\x00ERROR:Response blocked — it did not meet our compliance rules.";

/** Chars held back from emission so a needle/sentence completing across a
 *  chunk boundary is caught before any of it is streamed. Must exceed the
 *  longest needle + a short trailing window.
 *  Current longest CHAT_FORBIDDEN_WORDS needle: "sans aucun risque" (~17 chars).
 *  64 >> 17 + 8 (trailing window) = 25 chars. Safe margin. Update this comment
 *  if new multi-word needles longer than ~50 chars are ever added. */
const SETTLE = 64;

/**
 * Yield-keyword detector for the streaming hold-back (APY leak fix).
 *
 * `hasSinglePointApy` is a property of a COMPLETE sentence (keyword + % + no
 * range). In streaming, the SETTLE window emits everything older than 64 chars —
 * so a single-point claim whose sentence is longer than 64 chars leaks its
 * trick PREFIX ("Le rendement annualisé du vault, net de frais, est de ") to the
 * user before the "11 %" lands in the window and the guard fires. The persisted
 * answer is correctly blocked, but the user already saw the misleading lead-in.
 *
 * Fix: when the still-incomplete TRAILING sentence mentions a yield keyword, we
 * cannot know yet whether it will complete as a single point or a range — so we
 * hold emission at the last COMPLETED sentence boundary instead of the 64-char
 * window. Once the sentence completes (terminal punctuation), it is validated by
 * `chatOutputViolation` like any other settled text before it can be emitted.
 */
const YIELD_KEYWORD_RE =
  /\b(?:APY|yields?|returns?|rendements?|BTC|₿|bitcoins?|distribution\w*|deliver\w*|accumul\w*)\b|\d%|\d\s%/i;

/** Index of the last sentence terminator (. ! ? newline) in `text`, or -1. The
 *  emission boundary is just AFTER it, so a fully-terminated sentence is allowed
 *  out while an in-progress one is held. */
function lastSentenceBoundary(text: string): number {
  for (let i = text.length - 1; i >= 0; i--) {
    const c = text.charCodeAt(i);
    // . ! ? or \n
    if (c === 46 || c === 33 || c === 63 || c === 10) return i + 1;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Series 1 mining-note (v3.0) BTC-accumulation guards
// ---------------------------------------------------------------------------
//
// The active product is a BTC-ACCUMULATION mining note (ADR-019): BTC is
// accumulated over a 24-month term and delivered at maturity — there is NO
// periodic cash distribution and NO fixed APY. Three non-compliant framings must
// be blocked on every human-facing surface, beyond the generic forbidden-words +
// single-point-APY rules already enforced above:
//
//   1. SINGLE-POINT BTC ACCUMULATION CLAIM — the estimated accumulated BTC is a
//      RANGE, never a single figure ("you will accumulate 0.85 BTC"). Same
//      range-mechanic as rule #1, applied to a BTC amount instead of a %.
//   2. APY / YIELD / FIXED-RETURN WORDING — the retired "yield vault / target APY
//      8–15 %" framing. A BTC note has no APY; asserting one is non-compliant.
//   3. MONTHLY DISTRIBUTION — the retired "monthly USDC distribution" framing.
//      BTC is delivered ONCE at maturity, nothing is distributed monthly.
//   4. GUARANTEED-DELIVERY PROMISE — "we will deliver 0.85 BTC" / "guaranteed
//      delivery at maturity". Delivery of a specific amount is never assured.
//      ("will deliver" / "guarantee" are already forbidden words; this adds the
//      BTC-specific paraphrases the keyword list does not carry.)
//
// Every detector is CONSERVATIVE and preserves the existing exemptions: a BTC
// amount quoted as a RANGE ("0.7–0.9 BTC"), a source-attribution breakdown, or a
// reported real balance ("your position currently holds 0.30 BTC") must NOT fire.

/**
 * BTC-amount keyword tied to a specific accumulation/delivery claim. Requires an
 * accumulation/projection/delivery verb near a `<number> BTC` figure — so a bare
 * "0.30 BTC" balance readout is not a claim. Window stops at sentence
 * boundaries. Covers EN + FR ("accumulate/accumulated/accumulering",
 * "accumulera/accumulé", "deliver/delivered", "livrer/livré", "receive/get",
 * "recevrez/toucherez", "earn", "projected/estimated/expected").
 */
const BTC_ACCUMULATION_CLAIM_RE = new RegExp(
  // verb/cue BEFORE the amount, within 60 chars
  "\\b(?:accumulate\\w*|accumul\\w*|deliver\\w*|livr\\w*|receive\\w*|recev\\w*|touch\\w*|get|earn\\w*|gagn\\w*|project\\w*|estimat\\w*|expect\\w*|attend\\w*|obtiendr\\w*|will\\s+hold|end\\s+with)\\b" +
    "[^.!?\\n]{0,60}?\\d+(?:[.,]\\d+)?\\s?(?:BTC|₿|bitcoins?)\\b" +
    "|" +
    // amount BEFORE the cue (reversed: "0.85 BTC accumulated / delivered")
    "\\d+(?:[.,]\\d+)?\\s?(?:BTC|₿|bitcoins?)\\b[^.!?\\n]{0,40}?" +
    "\\b(?:accumulate\\w*|accumul\\w*|deliver\\w*|livr\\w*|projected|estimated|expected|attendu\\w*|garanti\\w*|guaranteed)\\b",
  "i",
);

/** A genuine BTC-amount RANGE construct: two numbers joined by a range connector
 *  where a BTC unit is inside the construct. Mirrors PERCENT_RANGE_RE but for
 *  BTC, so "0.7–0.9 BTC" / "0.7 à 0.9 BTC" / "entre 0.7 et 0.9 BTC" is exempt. */
const BTC_RANGE_RE =
  /\d[\d.,\s]*(?:BTC|₿)?\s*(?:à|to|et|and|[-–—])\s*\d[\d.,\s]*\s?(?:BTC|₿|bitcoins?)\b/i;
const BTC_ENTRE_RANGE_RE =
  /\bentre\b[^.!?\n]*?\d[^.!?\n]*?\bet\b[^.!?\n]*?\d[\d.,\s]*\s?(?:BTC|₿|bitcoins?)\b/i;

/** True when the sentence quotes a BTC amount as a genuine range / fourchette. */
function hasBtcRange(sentence: string): boolean {
  return (
    BTC_RANGE_RE.test(sentence) ||
    BTC_ENTRE_RANGE_RE.test(sentence) ||
    /\b(?:fourchette|range)\b/i.test(sentence)
  );
}

/** Reported-balance exemption: an honest read-out of a CURRENT / held position
 *  ("your position currently holds 0.30 BTC", "solde actuel : 0.30 BTC") is a
 *  fact, not a forward accumulation claim, so it must not fire. Requires a
 *  present-state cue AND no forward verb governing the amount. */
const BTC_BALANCE_CUE_RE =
  /\b(?:current\w*|currently|so\s?far|to\s?date|held|holds?|holding|balance|solde|actuel\w*|à\s?ce\s?jour|jusqu'?\s?ici|déjà|already)\b/i;
const BTC_FORWARD_CUE_RE =
  /\b(?:will|projected|estimated|expected|accumulate\b|accumulera\w*|deliver\w*|livrer\w*|at\s+maturity|à\s+maturité|over\s+the\s+term|sur\s+le\s+terme|by\s+the\s+end)\b/i;

function isReportedBtcBalance(sentence: string): boolean {
  return BTC_BALANCE_CUE_RE.test(sentence) && !BTC_FORWARD_CUE_RE.test(sentence);
}

/**
 * True when a completed sentence presents projected/accumulated BTC as a SINGLE
 * POINT (a BTC amount tied to an accumulation/delivery cue, with NO genuine BTC
 * range and NOT a reported current balance). For buffered text pass `final=true`.
 *
 * Exemption order (mirrors hasSinglePointApy):
 *   1. Claim gate (BTC_ACCUMULATION_CLAIM_RE) — skip sentences with no BTC-claim.
 *   2. Range exemption (hasBtcRange) — a fourchette passes.
 *   3. Reported-balance exemption — a current held amount is a fact, not a claim.
 *   4. Source attribution — a per-source breakdown is not the headline figure.
 *   5. Fire — single-point forward BTC accumulation/delivery claim.
 */
export function hasSinglePointBtcClaim(text: string, final: boolean): boolean {
  const normalized = normalizeForScan(text);
  for (const sentence of completedSentences(normalized, final)) {
    if (!BTC_ACCUMULATION_CLAIM_RE.test(sentence)) continue;
    if (hasBtcRange(sentence)) continue;
    if (isReportedBtcBalance(sentence)) continue;
    if (hasSourceAttribution(sentence)) continue;
    return true;
  }
  return false;
}

/**
 * APY / fixed-yield wording detector for the BTC note. The active product has NO
 * APY and NO fixed yield — asserting either is the retired framing. Fires when a
 * sentence asserts THIS vault / note / instrument HAS an APY / annual yield /
 * fixed return. Uses a subject+claim shape so neutral education ("a yield vault
 * would pay an APY; this note does not") is not blocked. Reuses the range /
 * source-attribution exemptions so a legitimate BTC-return range is untouched.
 */
const APY_YIELD_WORDING_RE = new RegExp(
  "\\b(?:this\\s+(?:vault|note|instrument|product)|the\\s+(?:vault|note|instrument)|cette\\s+note|ce\\s+(?:vault|produit|instrument)|it)\\b" +
    "[^.!?\\n]{0,40}?" +
    "\\b(?:has|offers?|pays?|targets?|yields?|delivers?|earns?|a|an|its?|of|verse\\w*|offre\\w*|vise\\w*|rapporte\\w*)\\b" +
    "[^.!?\\n]{0,40}?" +
    "\\b(?:APY|annual\\s+percentage\\s+yield|(?:fixed\\s+)?annual\\s+yield|fixed\\s+(?:return|yield|apy)|target\\s+apy|rendement\\s+annuel|taux\\s+annuel|rendement\\s+fixe)\\b",
  "i",
);

/** Monthly-distribution detector: the retired "monthly USDC distribution"
 *  framing. BTC is delivered ONCE at maturity — nothing is distributed monthly /
 *  periodically / quarterly. EN + FR. Negation-agnostic on purpose is WRONG here
 *  ("there is no monthly distribution" IS compliant) — so we exempt a preceding
 *  negation in the same clause. */
const MONTHLY_DISTRIBUTION_RE = new RegExp(
  "\\b(?:monthly|quarterly|periodic\\w*|mensuel\\w*|trimestriel\\w*|périodique\\w*|chaque\\s+mois|each\\s+month|every\\s+month)\\b" +
    "[^.!?\\n]{0,40}?" +
    "\\b(?:distribution\\w*|distribute\\w*|distribu\\w*|payout\\w*|payment\\w*|paiement\\w*|versement\\w*|verse\\w*|dividend\\w*|coupon\\w*|income|revenu\\w*)\\b" +
    "|" +
    "\\b(?:distribution\\w*|distribute\\w*|distribu\\w*|payout\\w*|versement\\w*|dividend\\w*|coupon\\w*)\\b" +
    "[^.!?\\n]{0,30}?" +
    "\\b(?:monthly|quarterly|mensuel\\w*|trimestriel\\w*|chaque\\s+mois|per\\s+month|par\\s+mois)\\b",
  "i",
);

/** In-clause negation exemption for the monthly-distribution rule: "there is NO
 *  monthly distribution", "aucune distribution mensuelle", "pas de versement
 *  mensuel" are the COMPLIANT statements and must pass. */
const DISTRIBUTION_NEGATION_RE =
  /\b(?:no|not|never|without|zero|aucun\w*|pas|sans|jamais|ni|ne)\b/i;

function assertsMonthlyDistribution(sentence: string): boolean {
  if (!MONTHLY_DISTRIBUTION_RE.test(sentence)) return false;
  // A negation anywhere in the (already sentence-bounded) span flips it to the
  // compliant "no monthly distribution" statement.
  return !DISTRIBUTION_NEGATION_RE.test(sentence);
}

/** Guaranteed-BTC-delivery paraphrase detector. "will deliver" / "guarantee" are
 *  already forbidden words; this catches the BTC-specific promise shapes the
 *  keyword list misses ("guaranteed delivery of X BTC at maturity", "you are
 *  guaranteed to receive X BTC", "livraison garantie de X BTC"). Any preceding
 *  in-clause negation ("delivery is not guaranteed") is compliant → exempt. */
const GUARANTEED_DELIVERY_RE = new RegExp(
  "\\b(?:guaranteed|guarantee\\w*|assured|garanti\\w*|assur[ée]?\\w*)\\b" +
    "[^.!?\\n]{0,40}?" +
    "\\b(?:deliver\\w*|delivery|livr\\w*|receive\\w*|recev\\w*|accumul\\w*|payout|maturity|maturité|BTC|₿|bitcoins?)\\b" +
    "|" +
    "\\b(?:deliver\\w*|delivery|livr\\w*)\\b" +
    "[^.!?\\n]{0,30}?" +
    "\\b(?:guaranteed|guarantee\\w*|garanti\\w*|assur[ée]?\\w*)\\b",
  "i",
);
const DELIVERY_NEGATION_RE =
  /\b(?:no|not|never|without|cannot|can'?t|won'?t|do(?:es)?n'?t|aucun\w*|pas|sans|jamais|non|ni|ne)\b/i;

function assertsGuaranteedDelivery(sentence: string): boolean {
  if (!GUARANTEED_DELIVERY_RE.test(sentence)) return false;
  return !DELIVERY_NEGATION_RE.test(sentence);
}

/** Sentence-level scan for the APY-wording / monthly-distribution / guaranteed-
 *  delivery rules (each is a property of a completed sentence). Returns the
 *  matching violation code or null. */
function btcFramingViolation(
  text: string,
  final: boolean,
): "apy_yield_wording" | "monthly_distribution" | "guaranteed_delivery" | null {
  const normalized = normalizeForScan(text);
  for (const sentence of completedSentences(normalized, final)) {
    if (hasNumericRange(sentence) || hasSourceAttribution(sentence)) {
      // A compliant range / source breakdown never carries these violations;
      // skip to avoid false positives on educational component copy.
    }
    if (APY_YIELD_WORDING_RE.test(sentence)) return "apy_yield_wording";
    if (assertsMonthlyDistribution(sentence)) return "monthly_distribution";
    if (assertsGuaranteedDelivery(sentence)) return "guaranteed_delivery";
  }
  return null;
}

export type ChatOutputViolation =
  | "forbidden_words"
  | "single_point_apy"
  | "single_point_btc"
  | "apy_yield_wording"
  | "monthly_distribution"
  | "guaranteed_delivery";

/**
 * Returns a violation reason for `text`, or `null` when compliant.
 * `final` = true relaxes the sentence-completion guard for the last fragment
 * (end-of-stream is a sentence boundary).
 */
export function chatOutputViolation(
  text: string,
  final = false,
): ChatOutputViolation | null {
  if (containsForbiddenChat(text)) return "forbidden_words";
  if (hasSinglePointApy(text, final)) return "single_point_apy";
  if (hasSinglePointBtcClaim(text, final)) return "single_point_btc";
  return btcFramingViolation(text, final);
}

/**
 * Wraps the model's text stream, scanning the settled prefix on every chunk and
 * the full text at flush. On a violation it emits the block sentinel and stops
 * — the offending span is never streamed (it is still inside the held-back
 * SETTLE window when detected, because content already validated and emitted
 * cannot become a violation later).
 */
export function guardChatStream(
  upstream: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  const dec = new TextDecoder();
  const enc = new TextEncoder();
  let scanned = "";
  let emitted = 0;
  let blocked = false;

  const transform = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, ctrl) {
      if (blocked) return;
      scanned += dec.decode(chunk, { stream: true });

      let settledEnd = Math.max(emitted, scanned.length - SETTLE);

      // APY-leak hold-back. A single-point APY is a property of a COMPLETE
      // sentence (keyword + % + no range). The SETTLE window alone can split a
      // long yield sentence and emit its misleading PREFIX ("…, est de ") before
      // the "11 %" is scanned. So whenever the UNEMITTED region mentions a yield
      // keyword, we emit only up to the last COMPLETED sentence boundary — never
      // a partial yield sentence. Each whole completed sentence is still inside
      // `settled` below, so `chatOutputViolation(settled)` validates (and blocks)
      // it BEFORE it is released. If the trailing yield sentence has no terminator
      // yet, nothing past the previous boundary is emitted (held for a later
      // chunk / the final flush). Only tightens settledEnd, never below `emitted`.
      const unemitted = scanned.slice(emitted);
      if (YIELD_KEYWORD_RE.test(unemitted)) {
        // Release ONLY whole completed sentences (boundary = just after the last
        // terminator), never a SETTLE-window slice that could split this yield
        // sentence. settledEnd becomes exactly the boundary: a completed yield
        // sentence is fully inside `settled` → validated/blocked below before
        // emit; an unterminated trailing yield sentence (boundary ≤ emitted)
        // emits nothing past what's already out, held for a later chunk/flush.
        const boundary = lastSentenceBoundary(scanned);
        settledEnd = boundary < 0 ? emitted : Math.max(emitted, boundary);
      }

      // Never cut a UTF-16 surrogate pair: if the boundary lands right after a
      // lone high surrogate, hold the half-pair back for the next chunk.
      if (settledEnd > emitted && settledEnd < scanned.length) {
        const lead = scanned.charCodeAt(settledEnd - 1);
        if (lead >= 0xd800 && lead <= 0xdbff) settledEnd -= 1;
      }
      const settled = scanned.slice(0, settledEnd);

      if (chatOutputViolation(settled, false)) {
        blocked = true;
        ctrl.enqueue(enc.encode(BLOCK_SENTINEL));
        // Do NOT ctrl.terminate() here: terminating cancels the UPSTREAM source
        // mid-flight, which (when guardChatStream wraps the chat-agent stream)
        // races the source's own end-of-turn finalisation and could resolve the
        // turn as "client_cancelled" (blocked=false) instead of the correct
        // blocked=true. Instead we set `blocked` and swallow every later chunk
        // (the `if (blocked) return` guard at the top) + the flush, letting the
        // source drain and finalise normally. Nothing more is emitted to the user.
        return;
      }

      if (settledEnd > emitted) {
        ctrl.enqueue(enc.encode(scanned.slice(emitted, settledEnd)));
        emitted = settledEnd;
      }
    },

    flush(ctrl) {
      if (blocked) return;
      scanned += dec.decode();

      if (chatOutputViolation(scanned, true)) {
        ctrl.enqueue(enc.encode(BLOCK_SENTINEL));
        return;
      }

      if (scanned.length > emitted) {
        ctrl.enqueue(enc.encode(scanned.slice(emitted)));
      }
    },
  });

  return upstream.pipeThrough(transform);
}
