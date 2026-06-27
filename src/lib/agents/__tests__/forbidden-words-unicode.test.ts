import { describe, expect, it } from "vitest";

import {
  containsForbidden,
  containsForbiddenChat,
  normalizeForScan,
} from "@/lib/agents/forbidden-words";
import { hasSinglePointApy } from "@/lib/agents/apy-range";
import { chatOutputViolation } from "@/lib/llm/output-guard";

/**
 * Unicode bypass defense (audit P0).
 *
 * The forbidden-word + single-point-APY guards used to scan raw lowercased text,
 * so a needle could be slipped past by inserting an invisible character
 * ("g​uaranteed"), using a compatibility/fullwidth form, or decomposing an
 * accent (NFD). `normalizeForScan` (NFKC + zero-width strip) closes that hole;
 * these tests pin every vector. Strings are built with explicit \uXXXX escapes
 * so the invisible characters are unambiguous in source.
 */

const ZWSP = "​"; // zero-width space
const ZWJ = "‍"; // zero-width joiner
const BOM = "﻿"; // zero-width no-break space
const SHY = "­"; // soft hyphen
const WJ = "⁠"; // word joiner

describe("normalizeForScan — Unicode normalization primitive", () => {
  it("strips zero-width characters", () => {
    expect(normalizeForScan(`g${ZWSP}uaranteed`)).toBe("guaranteed");
    expect(normalizeForScan(`guar${ZWJ}anteed`)).toBe("guaranteed");
    expect(normalizeForScan(`guarantee${BOM}d`)).toBe("guaranteed");
    expect(normalizeForScan(`guar${SHY}anteed`)).toBe("guaranteed");
    expect(normalizeForScan(`guar${WJ}anteed`)).toBe("guaranteed");
  });

  it("recomposes NFD-decomposed accents (e + combining ´ → é)", () => {
    const decomposed = "protégé"; // "protégé" fully decomposed
    expect(normalizeForScan(decomposed)).toBe("protégé");
  });

  it("folds fullwidth / compatibility forms to ASCII (NFKC)", () => {
    expect(normalizeForScan("ｇuaranteed")).toBe("guaranteed"); // fullwidth g
  });

  it("is a no-op on already-normal text", () => {
    expect(normalizeForScan("a normal compliant sentence")).toBe(
      "a normal compliant sentence",
    );
  });
});

describe("forbidden-words — Unicode bypass cannot slip a needle through", () => {
  it("blocks 'guaranteed' (plain)", () => {
    const r = containsForbidden("This is a guaranteed return.");
    expect(r).not.toBeNull();
    expect(r!.found).toContain("guarantee");
  });

  it("blocks zero-width-injected 'g\\u200Buaranteed'", () => {
    expect(
      containsForbidden(`This is a g${ZWSP}uaranteed return.`),
    ).not.toBeNull();
  });

  it("documents inter-letter spacing stays a non-match (needle-based)", () => {
    // The matcher is needle-based; "g u a r a n t e e d" is not a single needle.
    // Multi-WORD needles ("will deliver") get \s+ tolerance, single words do not.
    // Asserted so a future change is a deliberate decision, not an accident.
    expect(containsForbidden("g u a r a n t e e d")).toBeNull();
  });

  it("blocks 'no risk' and a zero-width split inside it", () => {
    expect(containsForbidden("There is no risk here.")).not.toBeNull();
    expect(
      containsForbidden(`There is no ri${ZWSP}sk here.`),
    ).not.toBeNull();
  });

  it("blocks 'assured' and a fullwidth variant", () => {
    expect(containsForbidden("an assured return")).not.toBeNull();
    expect(containsForbidden("an ａssured return")).not.toBeNull(); // fullwidth a
  });

  it("chat: blocks 'garanti' with a zero-width split", () => {
    expect(
      containsForbiddenChat(`Un rendement g${ZWSP}aranti.`),
    ).not.toBeNull();
  });

  it("chat: blocks NFD-decomposed 'capital protégé'", () => {
    const decomposed = "Le capital protégé contre les pertes.";
    expect(containsForbiddenChat(decomposed)).not.toBeNull();
  });

  it("chat: casing is still folded (regression fence)", () => {
    expect(containsForbiddenChat("Un rendement GARANTI.")).not.toBeNull();
  });

  it("does NOT false-positive on a compliant disclaimer with invisibles", () => {
    // "non garanti" must stay exempt even with a stray zero-width.
    expect(
      containsForbiddenChat(`Le rendement n'est pas g${ZWSP}aranti.`),
    ).toBeNull();
  });
});

describe("single-point APY — Unicode bypass cannot hide a single-point claim", () => {
  it("blocks a plain single-point APY", () => {
    expect(hasSinglePointApy("Le rendement annualisé est de 11 %.", true)).toBe(
      true,
    );
  });

  it("blocks a zero-width-split single-point APY", () => {
    expect(
      hasSinglePointApy(`Le rendement annualisé est de 1${ZWSP}1 %.`, true),
    ).toBe(true);
  });

  it("blocks a fullwidth-digit single-point APY", () => {
    // Fullwidth "１１"
    expect(
      hasSinglePointApy("Le rendement annualisé est de １１ %.", true),
    ).toBe(true);
  });

  it("still passes a compliant range", () => {
    expect(hasSinglePointApy("Le rendement vise 8 à 15 %.", true)).toBe(false);
  });
});

describe("chatOutputViolation — end-to-end Unicode bypass", () => {
  it("flags forbidden words through the chat entrypoint", () => {
    expect(chatOutputViolation(`Un rendement g${ZWSP}aranti.`, true)).toBe(
      "forbidden_words",
    );
  });

  it("flags single-point APY through the chat entrypoint", () => {
    expect(
      chatOutputViolation(`Le rendement annualisé est de 1${ZWSP}1 %.`, true),
    ).toBe("single_point_apy");
  });
});
