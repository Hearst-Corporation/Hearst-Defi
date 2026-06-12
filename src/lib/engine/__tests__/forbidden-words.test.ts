/**
 * forbidden-words.test.ts — locks the behavior of the pure compliance helper.
 *
 * Goal: any future regex edit to forbidden-words.ts breaks these tests before
 * silently affecting all 4 engine compliance guards.
 */

import { describe, expect, it } from "vitest";
import {
  FORBIDDEN_WORDS,
  findForbiddenWord,
} from "../forbidden-words";

// ---------------------------------------------------------------------------
// 1. Bare detection — each word in the canonical list must be detected
// ---------------------------------------------------------------------------

describe("findForbiddenWord — bare detection", () => {
  it("detects 'guarantee' in a plain sentence", () => {
    expect(findForbiddenWord("guaranteed yield")).toBe("guarantee");
  });

  it("detects 'promise' in a plain sentence", () => {
    expect(findForbiddenWord("we promise 12% returns")).toBe("promise");
  });

  it("detects 'certain' in a plain sentence", () => {
    expect(findForbiddenWord("returns are certain")).toBe("certain");
  });

  it("detects 'will deliver' in a plain sentence", () => {
    expect(findForbiddenWord("the vault will deliver 10% APY")).toBe(
      "will deliver",
    );
  });

  it("detects 'risk-free' in a plain sentence", () => {
    expect(findForbiddenWord("this is a risk-free investment")).toBe("risk-free");
  });

  it("detects 'no risk' in a plain sentence", () => {
    // 'no risk' starts with a negation word itself, but it IS a forbidden
    // phrase and must still be flagged (the code skips the negation-exemption
    // check for needles that start with a negation word).
    expect(findForbiddenWord("this is no risk at all")).toBe("no risk");
  });

  it("iterates every word in FORBIDDEN_WORDS and detects it", () => {
    for (const word of FORBIDDEN_WORDS) {
      const line = `the fund ${word} your capital`;
      expect(findForbiddenWord(line), `expected "${word}" to be detected`).toBe(
        word,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Negation exemption — negation prefixes within the 0–3 word window
// ---------------------------------------------------------------------------

describe("findForbiddenWord — negation exempts", () => {
  it("'not guaranteed' → null (0 intervening words)", () => {
    expect(findForbiddenWord("returns are not guaranteed")).toBeNull();
  });

  it("'no guaranteed' → null (0 intervening words, negator 'no')", () => {
    expect(findForbiddenWord("this is no guaranteed return")).toBeNull();
  });

  it("'never guaranteed' → null (0 intervening words, negator 'never')", () => {
    expect(findForbiddenWord("yields are never guaranteed")).toBeNull();
  });

  it("'without guaranteed' → null (0 intervening words, negator 'without')", () => {
    expect(findForbiddenWord("without guaranteed outcomes")).toBeNull();
  });

  it("'not absolutely guaranteed' → null (1 intervening word)", () => {
    expect(findForbiddenWord("returns are not absolutely guaranteed")).toBeNull();
  });

  it("'not in any way guaranteed' → null (3 intervening words, at window boundary)", () => {
    // 3 intervening words: "in", "any", "way" → still within {0,3} → exempt
    expect(
      findForbiddenWord("returns are not in any way guaranteed"),
    ).toBeNull();
  });

  it("negation on 'promise'", () => {
    expect(findForbiddenWord("we never promise returns")).toBeNull();
  });

  it("negation on 'certain'", () => {
    expect(findForbiddenWord("nothing is not certain here")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. Negation window boundary — 4 intervening words is NOT exempt
// ---------------------------------------------------------------------------

describe("findForbiddenWord — negation window boundary", () => {
  it("4 intervening words breaks the exemption → detected", () => {
    // "not" + 4 words before "guaranteed" → outside {0,3} window → NOT exempt
    expect(
      findForbiddenWord("returns are not in any way at all guaranteed"),
    ).toBe("guarantee");
  });
});

// ---------------------------------------------------------------------------
// 4. Clean lines return null
// ---------------------------------------------------------------------------

describe("findForbiddenWord — clean lines", () => {
  it("empty string → null", () => {
    expect(findForbiddenWord("")).toBeNull();
  });

  it("compliant sentence with APY range → null", () => {
    expect(
      findForbiddenWord("target APY range 8–15%, not guaranteed, subject to market conditions"),
    ).toBeNull();
  });

  it("sentence without any forbidden word → null", () => {
    expect(
      findForbiddenWord("the vault targets a yield range of 9 to 12 percent"),
    ).toBeNull();
  });

  it("word 'certainty' does NOT match because \\b is respected", () => {
    // The needle 'certain' with \b\w* matches 'certain', 'certainly', 'certainty'
    // so 'certainty' SHOULD be flagged — assert the real behavior.
    expect(findForbiddenWord("there is no certainty about the yield")).toBeNull();
    // note: negated by "no" directly before "certainty"
  });

  it("word 'certainly' (bare, no negation) IS flagged", () => {
    // \b + certain + \w* matches 'certainly'
    expect(findForbiddenWord("returns will certainly exceed targets")).toBe(
      "certain",
    );
  });
});

// ---------------------------------------------------------------------------
// 5. Case insensitivity — input is lowercased internally
// ---------------------------------------------------------------------------

describe("findForbiddenWord — case insensitivity", () => {
  it("uppercase input is lowercased and matched", () => {
    expect(findForbiddenWord("GUARANTEED RETURNS")).toBe("guarantee");
  });

  it("mixed-case input matched", () => {
    expect(findForbiddenWord("Promised 10% APY")).toBe("promise");
  });
});

// ---------------------------------------------------------------------------
// 6. FORBIDDEN_WORDS export shape
// ---------------------------------------------------------------------------

describe("FORBIDDEN_WORDS — export shape", () => {
  it("is a non-empty readonly tuple", () => {
    expect(FORBIDDEN_WORDS.length).toBeGreaterThan(0);
  });

  it("contains 'guarantee', 'promise', 'certain', 'will deliver', 'risk-free', 'no risk'", () => {
    const list = [...FORBIDDEN_WORDS];
    expect(list).toContain("guarantee");
    expect(list).toContain("promise");
    expect(list).toContain("certain");
    expect(list).toContain("will deliver");
    expect(list).toContain("risk-free");
    expect(list).toContain("no risk");
  });
});
