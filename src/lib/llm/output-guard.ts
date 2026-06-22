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
