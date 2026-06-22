/**
 * Tests for compliance hole #1 — French (and EN) win-certainty verb-phrase
 * idioms added to CHAT_FORBIDDEN_WORDS.
 *
 * containsForbiddenChat returns { found: string[] } | null.
 * A truthy (non-null) result = violation detected.
 * A null result = clean (no violation).
 */

import { describe, expect, it } from "vitest";

import { containsForbiddenChat } from "@/lib/agents/forbidden-words";

// ---------------------------------------------------------------------------
// FR verb-phrase idioms — must be BLOCKED
// ---------------------------------------------------------------------------

describe("containsForbiddenChat — FR win-certainty idioms are blocked", () => {
  it.each([
    "vous êtes certain de gagner avec ce vault",
    "vous êtes certaine de gagner",
    "ils sont certains de gagner",
    "elles sont certaines de gagner",
    "vous êtes sûr de gagner",
    "vous êtes sûre de gagner",
    "vous serez sûrs de gagner",
    "vous êtes assuré de gagner",
    "vous êtes assurée de gagner",
    "vous gagnez à coup sûr",
    "vous allez forcément gagner",
    "vous êtes certain de doubler votre mise",
    "vous êtes sûr de doubler",
    "que gagner est certain",
    // "à coup sûr" idiom — must-fire cases (needle: "gagner à coup sûr" / "coup sûr vous gagnez")
    "gagner à coup sûr avec ce placement",
    "à coup sûr vous gagnez sur ce vault",
    "vous gagnez à coup sûr ici",
  ])("blocks FR idiom: %s", (text) => {
    expect(containsForbiddenChat(text)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// EN verb-phrase idioms — must be BLOCKED
// ---------------------------------------------------------------------------

describe("containsForbiddenChat — EN win-certainty idioms are blocked", () => {
  it.each([
    "you are certain to win",
    "you are sure to win",
    "you are certain to double your investment",
    "you are sure to double",
    "you are guaranteed to win",
  ])("blocks EN idiom: %s", (text) => {
    expect(containsForbiddenChat(text)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Casing and accent robustness
// ---------------------------------------------------------------------------

describe("containsForbiddenChat — casing / accent robustness", () => {
  it("catches uppercase: CERTAIN DE GAGNER", () => {
    expect(
      containsForbiddenChat("Vous êtes CERTAIN DE GAGNER"),
    ).not.toBeNull();
  });

  it("catches mixed case: Vous êtes CERTAIN de GAGNER", () => {
    expect(
      containsForbiddenChat("Vous êtes CERTAIN de GAGNER"),
    ).not.toBeNull();
  });

  it("catches extra whitespace: certain  de  gagner", () => {
    expect(
      containsForbiddenChat("vous êtes certain  de  gagner"),
    ).not.toBeNull();
  });

  it("catches: certain de gagner (lowercase, no accent on 'e')", () => {
    expect(containsForbiddenChat("certain de gagner")).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Benign phrases — must NOT be flagged (no false positives)
// ---------------------------------------------------------------------------

describe("containsForbiddenChat — benign phrases pass without false-positive", () => {
  it("does not flag: certains investisseurs préfèrent attendre", () => {
    expect(
      containsForbiddenChat("certains investisseurs préfèrent attendre"),
    ).toBeNull();
  });

  it("does not flag: une certaine volatilité de marché", () => {
    expect(
      containsForbiddenChat("une certaine volatilité de marché"),
    ).toBeNull();
  });

  it("does not flag: bien sûr, voici les détails", () => {
    expect(
      containsForbiddenChat("bien sûr, voici les détails"),
    ).toBeNull();
  });

  it("does not flag: il est sûr de lui", () => {
    expect(containsForbiddenChat("il est sûr de lui")).toBeNull();
  });

  it("does not flag: Certaines distributions sont mensuelles", () => {
    expect(
      containsForbiddenChat("Certaines distributions sont mensuelles"),
    ).toBeNull();
  });

  it("does not flag standalone 'sûr' in non-idiom context", () => {
    // "il est sûr que les distributions sont mensuelles" — sûr not followed by
    // "de gagner" / "de doubler" / "de win" so no needle matches.
    expect(
      containsForbiddenChat(
        "il est sûr que les distributions sont mensuelles",
      ),
    ).toBeNull();
  });

  it("does not flag 'assuré' in insurance context (non-idiom)", () => {
    // "le souscripteur assuré" — bare assuré without "de gagner"
    // The existing "rendement assuré" and "assuré de gagner" needles are
    // multi-word; bare "assuré" is not in the list.
    expect(
      containsForbiddenChat("le contrat de l'assuré"),
    ).toBeNull();
  });

  // "coup sûr" benign uses — these must NOT fire after the needle was narrowed
  // to "gagner à coup sûr" / "coup sûr vous gagnez" (P2 over-match fix).
  it('does not flag benign "coup sûr": un coup sûr et réfléchi', () => {
    expect(
      containsForbiddenChat("un coup sûr et réfléchi"),
    ).toBeNull();
  });

  it('does not flag benign trailing suffix: du premier coup sûrement', () => {
    // Old needle "coup sûr" + trailing \w* incorrectly matched "coup sûrement".
    expect(
      containsForbiddenChat("Il a réussi du premier coup sûrement."),
    ).toBeNull();
  });

  it('does not flag standalone "bien sûr"', () => {
    expect(
      containsForbiddenChat("bien sûr, voici les chiffres"),
    ).toBeNull();
  });

  it('does not flag "c\'est un bon coup"', () => {
    expect(containsForbiddenChat("c'est un bon coup")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Return shape contract
// ---------------------------------------------------------------------------

describe("containsForbiddenChat — return shape for new needles", () => {
  it("returns { found: string[] } for a hit", () => {
    const result = containsForbiddenChat("vous êtes certain de gagner");
    expect(result).not.toBeNull();
    expect(Array.isArray(result!.found)).toBe(true);
    expect(result!.found.length).toBeGreaterThan(0);
    expect(result!.found).toContain("certain de gagner");
  });

  it("returns null for clean text", () => {
    expect(
      containsForbiddenChat("certains investisseurs apprécient la transparence"),
    ).toBeNull();
  });
});
