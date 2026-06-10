import { describe, expect, it } from "vitest";

import {
  containsForbidden,
  findForbiddenMatches,
  FORBIDDEN_WORDS,
} from "@/lib/agents/forbidden-words";
import {
  DISCLAIMER_NOT_GUARANTEED,
  DISCLAIMER_PROJECTION,
} from "@/lib/agents/system-prompts/disclaimers";

// ---------------------------------------------------------------------------
// Canonical list
// ---------------------------------------------------------------------------

describe("FORBIDDEN_WORDS — canonical list", () => {
  it("contains the 6 consolidated needles", () => {
    expect([...FORBIDDEN_WORDS]).toEqual([
      "guarantee",
      "promise",
      "certain",
      "will deliver",
      "risk-free",
      "no risk",
    ]);
  });
});

// ---------------------------------------------------------------------------
// containsForbidden — shape contract
// ---------------------------------------------------------------------------

describe("containsForbidden — shape", () => {
  it("returns null on clean text", () => {
    expect(
      containsForbidden(
        "Under the stated assumption, projected APY is 9.4-12.8%. Outcomes may vary.",
      ),
    ).toBeNull();
  });

  it("returns null on empty input", () => {
    expect(containsForbidden("")).toBeNull();
  });

  it("returns { found: [...] } when a needle hits", () => {
    const r = containsForbidden("We guarantee returns of 15%.");
    expect(r).not.toBeNull();
    expect(r!.found).toContain("guarantee");
  });

  it("de-duplicates repeat hits of the same needle", () => {
    const r = containsForbidden("We promise, we promise, we promise.");
    expect(r).not.toBeNull();
    expect(r!.found.filter((w) => w === "promise")).toHaveLength(1);
  });

  it("collects multiple distinct needles into one result", () => {
    const r = containsForbidden(
      "We guarantee returns and promise outsized yield with certainty.",
    );
    expect(r).not.toBeNull();
    expect(r!.found).toEqual(
      expect.arrayContaining(["guarantee", "promise", "certain"]),
    );
  });
});

// ---------------------------------------------------------------------------
// Per-needle coverage — base form, inflections, casing
// ---------------------------------------------------------------------------

describe("containsForbidden — per-needle inflections", () => {
  // ---- guarantee ----------------------------------------------------------

  it.each([
    "We guarantee high yield.",
    "Profits are guaranteed every month.",
    "She guarantees consistent returns.",
    "He is guaranteeing capital protection.",
    "We GUARANTEE returns.",
    "We Guarantee returns.",
  ])("catches inflection / casing: %s", (text) => {
    const r = containsForbidden(text);
    expect(r).not.toBeNull();
    expect(r!.found).toContain("guarantee");
  });

  // ---- promise ------------------------------------------------------------

  it.each([
    "We promise stellar returns.",
    "She promises 20% APY.",
    "He promised investors.",
    "PROMISE of yield.",
  ])("catches inflection / casing: %s", (text) => {
    const r = containsForbidden(text);
    expect(r).not.toBeNull();
    expect(r!.found).toContain("promise");
  });

  it("documents the `\\b<needle>\\w*` limit: 'promising' is NOT caught", () => {
    // The canonical pattern is prefix-anchored on the literal needle
    // (`\bpromise\w*`). Stems that drop a letter ("promising" → "promis-")
    // do not match. This is a deliberate trade-off documented in the audit
    // report (06-forbidden-words.md): catching every Levenshtein-distance-1
    // variant would balloon false positives on legitimate words like
    // "promotion", "primary", "process". Add the stem explicitly if a real
    // legal incident makes it necessary.
    expect(containsForbidden("We are promising the moon.")).toBeNull();
  });

  // ---- certain ------------------------------------------------------------

  it.each([
    "Returns are certain.",
    "Certainty of outcome is unique.",
    "Certainly, you will profit.",
    "CERTAIN returns.",
  ])("catches inflection / casing: %s", (text) => {
    const r = containsForbidden(text);
    expect(r).not.toBeNull();
    expect(r!.found).toContain("certain");
  });

  // ---- will deliver -------------------------------------------------------

  it.each([
    "This product will deliver 12% APY.",
    "We WILL DELIVER outsized returns.",
    "We will deliverable next quarter.", // inflection \w* still matches
  ])("catches inflection / casing: %s", (text) => {
    const r = containsForbidden(text);
    expect(r).not.toBeNull();
    expect(r!.found).toContain("will deliver");
  });

  // ---- risk-free ----------------------------------------------------------

  it.each([
    "This is a risk-free product.",
    "RISK-FREE returns.",
    "risk-freeish offering",
  ])("catches inflection / casing: %s", (text) => {
    const r = containsForbidden(text);
    expect(r).not.toBeNull();
    expect(r!.found).toContain("risk-free");
  });

  // ---- no risk ------------------------------------------------------------

  it.each([
    "This investment has no risk.",
    "NO RISK strategy.",
    "no risks involved",
  ])("catches needle: %s", (text) => {
    const r = containsForbidden(text);
    expect(r).not.toBeNull();
    expect(r!.found).toContain("no risk");
  });
});

// ---------------------------------------------------------------------------
// Negation window — exemption rules
// ---------------------------------------------------------------------------

describe("containsForbidden — negation exemption", () => {
  it('"not guaranteed" is allowed', () => {
    expect(containsForbidden("Returns are not guaranteed.")).toBeNull();
  });

  it('"never guarantee" is allowed (lookbehind)', () => {
    expect(containsForbidden("We never guarantee outcomes.")).toBeNull();
  });

  it('"without promise" is allowed (lookbehind)', () => {
    expect(containsForbidden("Sold without promise of returns.")).toBeNull();
  });

  it("3-word window before still catches it", () => {
    expect(
      containsForbidden("I would not guarantee this outcome ever."),
    ).toBeNull();
  });

  it("3-word window after still catches it", () => {
    expect(containsForbidden("guarantee not on Tuesdays")).toBeNull();
  });

  it("hyphenated negation token is honoured (guaranteed-not-applicable)", () => {
    expect(containsForbidden("guaranteed-not-applicable")).toBeNull();
  });

  it("positive claim without negation still hits", () => {
    const r = containsForbidden("This is guaranteed.");
    expect(r).not.toBeNull();
    expect(r!.found).toContain("guarantee");
  });

  it('"no risk" is NOT exempted by its own "no" prefix', () => {
    // Regression: needles starting with a negation must NEVER be silently
    // skipped by the negation window — the prefix IS the needle.
    const r = containsForbidden("This vault has no risk.");
    expect(r).not.toBeNull();
    expect(r!.found).toContain("no risk");
  });

  it("disclaimer-shaped sentence with multiple negations passes", () => {
    expect(
      containsForbidden(
        "This is not an offer; returns are not guaranteed and no promise of capital protection is made.",
      ),
    ).toBeNull();
  });

  it('"No outcome is guaranteed" is allowed (off-by-one fix: "No" at boundary)', () => {
    expect(
      containsForbidden(
        "No outcome is guaranteed and nothing here is investment advice.",
      ),
    ).toBeNull();
  });

  it('"outcomes are not guaranteed" is allowed (off-by-one fix: negation before boundary)', () => {
    expect(
      containsForbidden(
        "Past performance does not indicate future results and outcomes are not guaranteed.",
      ),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Disclaimer templates — must pass containsForbidden
// ---------------------------------------------------------------------------

describe("disclaimer templates — forbidden-words clean", () => {
  it("DISCLAIMER_PROJECTION passes containsForbidden", () => {
    expect(containsForbidden(DISCLAIMER_PROJECTION)).toBeNull();
  });

  it("DISCLAIMER_NOT_GUARANTEED passes containsForbidden", () => {
    expect(containsForbidden(DISCLAIMER_NOT_GUARANTEED)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// findForbiddenMatches — granular API
// ---------------------------------------------------------------------------

describe("findForbiddenMatches", () => {
  it("returns [] on clean text", () => {
    expect(findForbiddenMatches("Outcomes may vary.")).toEqual([]);
  });

  it("returns [] on empty input", () => {
    expect(findForbiddenMatches("")).toEqual([]);
  });

  it("returns matches sorted by index", () => {
    const text = "We promise returns and we guarantee them.";
    const matches = findForbiddenMatches(text);
    expect(matches.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < matches.length; i++) {
      expect(matches[i]!.index).toBeGreaterThanOrEqual(matches[i - 1]!.index);
    }
  });

  it("range.length covers the inflectional suffix", () => {
    const text = "We guaranteed returns.";
    const m = findForbiddenMatches(text)[0]!;
    expect(text.slice(m.index, m.index + m.length).toLowerCase()).toBe(
      "guaranteed",
    );
  });

  it("skips negated occurrences", () => {
    const m = findForbiddenMatches(
      "Returns are not guaranteed and capital is not promised.",
    );
    expect(m).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Exhaustive guard — every word in the list must trip on a bare occurrence
// ---------------------------------------------------------------------------

describe("FORBIDDEN_WORDS — exhaustive guard", () => {
  it("each canonical word trips containsForbidden when used unconditionally", () => {
    for (const word of FORBIDDEN_WORDS) {
      const r = containsForbidden(`Some prefix ${word} some suffix.`);
      expect(r, `word "${word}" should be detected`).not.toBeNull();
      expect(r!.found).toContain(word);
    }
  });
});
