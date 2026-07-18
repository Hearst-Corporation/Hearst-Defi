/**
 * Compliance output-guard stress test.
 *
 * Pounds `chatOutputViolation` (the output-side compliance guard for the
 * LP-facing cockpit chat stream) across a fourchette of phrasings — FR + EN
 * forbidden-vocabulary claims, single-point APY/yield claims, compliant APY
 * ranges, and neutral prose — and asserts the contract from CLAUDE.md
 * non-negotiables #1 (APY always a range) and #5 (forbidden words):
 *
 *   - forbidden phrase       -> MUST be blocked (a phrase that passes is a P0
 *                               compliance hole that would stream to an investor)
 *   - single-point APY/yield -> MUST be blocked (#1); the gate now covers
 *                               "rendement de 12%", "yields exactly 9.4%", and
 *                               equivalent FR/EN phrasings (holes #2 + #3 closed
 *                               in apy-range.ts)
 *   - APY as a range         -> MUST pass (a range wrongly blocked is a P1 false
 *                               positive that breaks the chat UX)
 *   - neutral prose          -> MUST pass
 *
 * Each list is looped to prove the guard is DETERMINISTIC: the same input is
 * scanned 25 times and every verdict must be identical (the guard is a pure
 * function — no state, no I/O, no randomness).
 *
 * Mocked-client policy: this exercises the PURE guard only (string in →
 * verdict out). It never imports an LLM client and never touches the network —
 * nothing to mock, nothing live.
 */

import { describe, it, expect } from "vitest";
import { chatOutputViolation } from "@/lib/llm/output-guard";

/** Repeat count used to prove determinism on every phrase. */
const RUNS = 25;

/**
 * Forbidden-vocabulary claims that MUST be blocked, FR + EN.
 * Per the task brief: a forbidden phrase that PASSES the guard is a P0
 * compliance hole.
 *
 * "certain de gagner" was promoted from it.todo (REMAINING HOLE) to a real
 * assertion once A1's forbidden-words.ts fix was integrated into main: A1 added
 * the multi-word "certain de gagner" / "certaine de gagner" / "certains de
 * gagner" / … needles that close compliance hole #1 (FR win-certainty idiom).
 */
const FORBIDDEN: readonly string[] = [
  // FR
  "rendement garanti",
  "certain de gagner",   // closed in A1 (forbidden-words.ts win-certainty idioms)
  // EN
  "guaranteed return",
  "we promise",
  "risk-free",
  "will deliver",
];

/**
 * Single-point APY / single-point yield claims that MUST be blocked (#1: APY
 * is always a range, never a single point).
 *
 * The two FR/EN yield phrasings below were previously in KNOWN_HOLES (holes #2
 * + #3). They are now real assertions because apy-range.ts broadened its topic
 * gate from the literal "APY" token to YIELD_TOPIC_RE (covers APY, yields?,
 * returns?, rendements?).
 */
const SINGLE_POINT_APY: readonly string[] = [
  "APY 11%",
  // Holes #2 + #3 — closed in apy-range.ts (YIELD_TOPIC_RE gate)
  "rendement de 12%",
  "yields exactly 9.4%",
];

// Holes #2 + #3 ("rendement de 12%", "yields exactly 9.4%") are now CLOSED —
// they were moved to SINGLE_POINT_APY above after apy-range.ts broadened its
// topic gate. Hole #1 ("certain de gagner") is now CLOSED — moved to FORBIDDEN
// above after A1's forbidden-words.ts win-certainty idioms were integrated.

/**
 * Compliant APY phrased as a range — MUST pass. A range wrongly blocked is a
 * P1 false positive that breaks the chat UX.
 */
const APY_RANGE: readonly string[] = [
  "APY 9.4-12.8%",
  "fourchette 8-15%",
];

/** Neutral prose with no yield/forbidden claim — MUST pass. */
const NEUTRAL: readonly string[] = [
  "Le coffre est structuré via une SPV aux îles Caïmans, ticket minimum 250k.",
];

/**
 * Monthly / periodic cash-distribution framing — MUST be blocked under Series 1.
 * Product decision (RC-fix): the retired "monthly USDC distribution" narrative
 * is NOT neutral prose on a Series 1 surface — Series 1 is a BTC-accumulation
 * note delivered ONCE at maturity, with NO periodic cash distribution. These
 * two phrasings were previously (wrongly) in NEUTRAL; the M9 guard correctly
 * blocks them, so the test contract is aligned to the guard, not the guard
 * weakened.
 */
const MONTHLY_DISTRIBUTION: readonly string[] = [
  "Hearst distribue de l'USDC chaque mois aux investisseurs.",
  "Monthly USDC distributions are wired to your connected wallet.",
];

/**
 * The guard runs on BUFFERED text via the stream's flush path
 * (`chatOutputViolation(text, true)`) — a complete answer is a sentence
 * boundary, so the single-point-APY sentence guard is active. We assert on the
 * `final = true` verdict, which is how a fully-rendered answer is validated.
 */
const verdict = (text: string) => chatOutputViolation(text, true);

/** Assert the same verdict is produced on every run (pure-function proof). */
function deterministic(text: string): ReturnType<typeof chatOutputViolation> {
  const first = verdict(text);
  for (let i = 1; i < RUNS; i++) {
    expect(verdict(text), `non-deterministic verdict for ${JSON.stringify(text)} on run ${i}`).toBe(first);
  }
  return first;
}

describe("compliance output guard — stress across phrasings", () => {
  describe("BLOCKS forbidden vocabulary (FR + EN) — #5", () => {
    it.each(FORBIDDEN)("blocks %j", (phrase) => {
      const v = deterministic(phrase);
      expect(v, `forbidden phrase passed the guard (P0 compliance hole): ${JSON.stringify(phrase)}`).not.toBeNull();
    });
  });

  describe("BLOCKS single-point APY — #1", () => {
    it.each(SINGLE_POINT_APY)("blocks %j", (phrase) => {
      const v = deterministic(phrase);
      expect(v, `single-point APY passed the guard (P0 compliance hole): ${JSON.stringify(phrase)}`).not.toBeNull();
    });
  });

  describe("BLOCKS monthly/periodic distribution — Series 1", () => {
    it.each(MONTHLY_DISTRIBUTION)("blocks %j", (phrase) => {
      const v = deterministic(phrase);
      expect(
        v,
        `monthly-distribution wording passed the guard (Series 1 compliance hole): ${JSON.stringify(phrase)}`,
      ).not.toBeNull();
    });
  });

  describe("PASSES compliant APY ranges — #1 (no false positive)", () => {
    it.each(APY_RANGE)("passes %j", (phrase) => {
      const v = deterministic(phrase);
      expect(v, `compliant APY range wrongly blocked (P1 false positive): ${JSON.stringify(phrase)} -> ${v}`).toBeNull();
    });
  });

  describe("PASSES neutral prose (no false positive)", () => {
    it.each(NEUTRAL)("passes %j", (phrase) => {
      const v = deterministic(phrase);
      expect(v, `neutral prose wrongly blocked (P1 false positive): ${JSON.stringify(phrase)} -> ${v}`).toBeNull();
    });
  });

});
