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
 *   what the client shows the user via `setError(...)`, so it is a human FR
 *   message — not a raw technical token (the client would otherwise surface
 *   "content_blocked" verbatim to an investor).
 */

import { containsForbiddenChat } from "@/lib/agents/forbidden-words";
// Single source of truth for the APY-always-a-range rule (#1), shared with the
// batch-agent validator so chat and agents enforce identical logic.
import { hasSinglePointApy } from "@/lib/agents/apy-range";

/**
 * Sentinel the cockpit-shell client parses to surface a stream error. The
 * client takes the first line AFTER `\x00ERROR:` and calls `setError(...)` with
 * it, so the suffix must be a user-readable FR message, not a technical token.
 */
export const BLOCK_SENTINEL =
  "\x00ERROR:Réponse bloquée — elle ne respectait pas nos règles de conformité.";

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
  /\b(?:APY|yields?|returns?|rendements?)\b|\d%|\d\s%/i;

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
