/**
 * Unit tests for the shared outreach send-copy gate
 * (src/lib/outreach/send-compliance.ts).
 *
 * This is the throwing guard the drafting agents + admin Server Actions run
 * before any subject/body is persisted or handed toward a prospect's inbox. It
 * must enforce BOTH non-negotiables together, using the canonical detectors:
 *   - #1 APY always a range   (assertApyAlwaysRange / hasSinglePointApy)
 *   - #5 forbidden words      (assertNoForbiddenWords / containsForbidden)
 *
 * The headline case: a "target APY 11%" single point is blocked, while the
 * compliant "8-15%" fourchette passes.
 */
import { describe, it, expect } from "vitest";

import { assertSendCopyCompliant } from "@/lib/outreach/send-compliance";

describe("assertSendCopyCompliant", () => {
  it("BLOCKS a single-point APY in the body (target APY 11%)", () => {
    expect(() =>
      assertSendCopyCompliant(
        "Institutional yield — quick intro",
        "Our estimated target APY is 11% net over the term.",
      ),
    ).toThrow(/single-point apy|range/i);
  });

  it("BLOCKS a single-point APY in the SUBJECT alone", () => {
    expect(() =>
      assertSendCopyCompliant(
        "Target APY 11% for qualified investors",
        "A perfectly clean body with a proper 8-15% range.",
      ),
    ).toThrow(/single-point apy|range/i);
  });

  it("BLOCKS a body-only single-point APY (WhatsApp/LinkedIn shape)", () => {
    expect(() =>
      assertSendCopyCompliant("Yield of exactly 12% on the note. Apply here."),
    ).toThrow(/single-point apy|range/i);
  });

  it("PASSES a compliant 8-15% range fourchette", () => {
    expect(() =>
      assertSendCopyCompliant(
        "A structured mining note — quick intro",
        "Our estimated target return range is 8-15% in BTC accumulated over the term, not distributed and not guaranteed.",
      ),
    ).not.toThrow();
  });

  it("PASSES clean copy with no yield figure at all", () => {
    expect(() =>
      assertSendCopyCompliant("Quick intro", "A short, on-brand institutional note."),
    ).not.toThrow();
  });

  it("still BLOCKS forbidden words (#5 not regressed by the #1 addition)", () => {
    expect(() =>
      assertSendCopyCompliant(
        "A guaranteed return",
        "This note offers a risk-free, guaranteed return.",
      ),
    ).toThrow(/forbidden/i);
  });
});
