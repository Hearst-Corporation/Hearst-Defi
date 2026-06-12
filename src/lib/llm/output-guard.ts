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
 * - The APY single-point check is deliberately CONSERVATIVE: it only fires on a
 *   completed sentence that contains the literal token "APY", at least one
 *   percentage, and NO genuine numeric range construct — so it can never block a
 *   legitimate range ("8 à 15 %", "9.4-12.8%", "entre 8 et 15 %") while still
 *   catching a lone APY percentage whose sentence merely happens to contain a
 *   bare "à"/"déjà"/"jusqu'à" or a hyphen.
 * - On a violation the stream emits the `\x00ERROR:content_blocked` sentinel
 *   already understood by the cockpit-shell client (no new client contract).
 */

import { containsForbiddenChat } from "@/lib/agents/forbidden-words";

/** Sentinel the cockpit-shell client parses to surface a stream error. */
export const BLOCK_SENTINEL = "\x00ERROR:content_blocked";

/** Chars held back from emission so a needle/sentence completing across a
 *  chunk boundary is caught before any of it is streamed. Must exceed the
 *  longest needle + a short trailing window. */
const SETTLE = 64;

/** Non-global so `.test()` is stateless across sentences (no `lastIndex` carry). */
const PERCENT_RE = /\d+(?:[.,]\d+)?\s?%/;

/**
 * A genuine PERCENTAGE range construct: two numbers joined by a range connector
 * where the construct itself carries a `%`. Requiring the `%` INSIDE the range
 * is what stops an incidental numeric range elsewhere in the sentence ("sur 8 à
 * 15 fermes", "entre 2024 et 2026", "3-4 fois le livret A") from excusing a
 * single-point APY percentage (P1). An APY fourchette is ALWAYS quoted in % —
 * "8 à 15 %", "9.4-12.8%", "8 % et 15 %" — so the genuine range always has a %
 * within it, while a bare "<num> à <num>" of farms/years/multiples does not.
 *
 *   <num>[ digits / sep ] <connector> <num>[ digits / sep ] %
 *   <num>[ digits / sep ] % <connector> <num>[ digits / sep ] %
 *
 * Connectors: "à", "to", "et", or a dash (- – —).
 */
const PERCENT_RANGE_RE =
  /\d[\d.,\s]*%?\s*(?:à|to|et|[-–—])\s*\d[\d.,\s]*%/i;

/**
 * "entre <num>[%] ... et <num> %" — the canonical French range phrasing. The
 * `%` must attach to the SECOND operand directly (only digits/decimal/space
 * between the number after "et" and the `%`), so an incidental "entre 2024 et
 * 2026" followed later by a lone "11 %" does NOT match (P1): there, the number
 * right after "et" is 2026, which carries no `%`.
 */
const ENTRE_RANGE_RE =
  /\bentre\b[^.!?\n]*?\d[^.!?\n]*?\bet\b[^\d.!?\n]*?\d[\d.,\s]*%/i;

/** Explicit range vocabulary that always denotes a fourchette. */
const RANGE_WORD_RE = /\b(?:fourchette|range)\b/i;

/** True when the sentence contains a genuine PERCENTAGE range construct (a
 *  range that itself carries a `%`), or explicit fourchette/range vocabulary.
 *  A bare numeric range with no `%` in it (farms, years, multiples) does NOT
 *  count — it must not excuse a single-point APY percentage (P1). */
function hasNumericRange(sentence: string): boolean {
  return (
    PERCENT_RANGE_RE.test(sentence) ||
    ENTRE_RANGE_RE.test(sentence) ||
    RANGE_WORD_RE.test(sentence)
  );
}

/** Split into sentences. When `final` is false, the trailing fragment (not yet
 *  terminated by . ! ? or newline) is dropped — it may still be growing and a
 *  range could complete in a later chunk. */
function completedSentences(text: string, final: boolean): string[] {
  const parts = text.split(/(?<=[.!?\n])\s+/);
  if (!final && !/[.!?\n]\s*$/.test(text)) {
    parts.pop();
  }
  return parts.filter((s) => s.trim().length > 0);
}

/** True when a completed sentence presents an APY as a single point: it names
 *  APY, quotes at least one percentage, and carries NO genuine numeric range
 *  construct. A bare "à" or stray hyphen no longer excuses it; only a number
 *  actually bracketed by a range connector (or explicit range vocabulary) does. */
function hasSinglePointApy(text: string, final: boolean): boolean {
  for (const sentence of completedSentences(text, final)) {
    if (!/\bAPY\b/i.test(sentence)) continue;
    if (!PERCENT_RE.test(sentence)) continue; // no percentage → nothing quoted
    if (hasNumericRange(sentence)) continue; // genuine fourchette → compliant
    return true;
  }
  return false;
}

/**
 * Returns a violation reason for `text`, or `null` when compliant.
 * `final` = true relaxes the sentence-completion guard for the last fragment
 * (end-of-stream is a sentence boundary).
 */
export function chatOutputViolation(
  text: string,
  final = false,
): "forbidden_words" | "single_point_apy" | null {
  if (containsForbiddenChat(text)) return "forbidden_words";
  if (hasSinglePointApy(text, final)) return "single_point_apy";
  return null;
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
        ctrl.terminate();
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
