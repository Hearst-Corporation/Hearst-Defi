/**
 * Send-copy compliance — the SINGLE throwing gate the outreach drafting agents
 * and admin Server Actions run on a subject/body before it can be persisted or
 * returned toward a prospect's inbox.
 *
 * It bundles the TWO non-negotiable output rules so they can never drift apart
 * across the outreach draft/edit call-sites:
 *   - #5 forbidden words     (assertNoForbiddenWords)
 *   - #1 APY always a range  (assertApyAlwaysRange)
 *
 * Both detectors are RE-EXPORTED from the canonical validators in
 * `src/lib/agents/validators.ts` — no forbidden-words or APY-range regex is
 * re-implemented here. That is the whole point: the outreach path enforces the
 * EXACT same logic the four batch agents and the LP chat already enforce.
 *
 * The Inngest send jobs deliberately do NOT use this throwing helper: a per-row
 * block there must mark the row `failed`, audit the reason, and let the fan-out
 * continue (a throw would abort the whole batch), so they call the canonical
 * non-throw detectors (`containsForbidden` + `hasSinglePointApy`) directly.
 */

import {
  assertApyAlwaysRange,
  assertNoForbiddenWords,
} from "@/lib/agents/validators";

/**
 * Throws if any of `parts` violates #5 (forbidden words) or #1 (single-point
 * APY). Forbidden words are checked first on each part, preserving the existing
 * error surface on that path. Each part is scanned independently (subject and
 * body separately), which is stricter than joining — a single-point APY split
 * across the subject/body boundary can never launder itself into a fake range.
 *
 * Pass the pieces you would otherwise concatenate, e.g.
 * `assertSendCopyCompliant(subject, body)` or `assertSendCopyCompliant(body)`.
 */
export function assertSendCopyCompliant(...parts: string[]): void {
  for (const part of parts) {
    assertNoForbiddenWords(part);
    assertApyAlwaysRange(part);
  }
}
