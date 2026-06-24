/**
 * Regression suite for the broadened `hasSinglePointApy` topic gate
 * (compliance holes #2 + #3 closed).
 *
 * Before this fix the gate was `if (!/\bAPY\b/i.test(sentence)) continue;` —
 * a single-point yield phrased with "rendement", "yields", or "returns" (never
 * the literal "APY" token) was skipped entirely. The gate is now `YIELD_TOPIC_RE`
 * which covers APY + yields? + returns? + rendements?.
 *
 * Test structure:
 *   MUST FIRE   — single-point claims (FR + EN) that MUST be flagged.
 *   MUST NOT FIRE — compliant ranges, neutral prose, and edge cases that MUST
 *                   NOT trigger false positives.
 *   MULTI-SENTENCE — one non-compliant sentence among several — MUST fire.
 */

import { describe, expect, it } from "vitest";
import { hasSinglePointApy } from "@/lib/agents/apy-range";

// ---------------------------------------------------------------------------
// MUST FIRE — single-point yield claims, no range
// ---------------------------------------------------------------------------

describe("hasSinglePointApy — MUST FIRE (single-point yield, no range)", () => {
  it('FR: "rendement de 12%"', () => {
    expect(hasSinglePointApy("Le rendement de 12% est projeté.", true)).toBe(true);
  });

  it('EN: "yields exactly 9.4%"', () => {
    expect(hasSinglePointApy("The vault yields exactly 9.4%.", true)).toBe(true);
  });

  it('EN: "returns exactly 11%"', () => {
    expect(hasSinglePointApy("This structure returns exactly 11%.", true)).toBe(true);
  });

  it('EN: "APY 11%" (original gate, must still fire)', () => {
    expect(hasSinglePointApy("APY 11%.", true)).toBe(true);
  });

  it('EN: "return of 9.4%"', () => {
    expect(hasSinglePointApy("We project a return of 9.4%.", true)).toBe(true);
  });

  it('FR: "rendements de 12%"', () => {
    expect(hasSinglePointApy("Les rendements de 12% sont projetés.", true)).toBe(true);
  });

  it('EN: "yield of 11%" (bare yield singular)', () => {
    expect(hasSinglePointApy("The fund has a yield of 11%.", true)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// MUST NOT FIRE — compliant ranges and neutral prose
// ---------------------------------------------------------------------------

describe("hasSinglePointApy — MUST NOT FIRE (no false positives)", () => {
  it('FR range: "rendement de 8 à 15 %"', () => {
    expect(hasSinglePointApy("Le rendement de 8 à 15 % est projeté.", true)).toBe(false);
  });

  it('FR range: "fourchette 8-15%"', () => {
    expect(hasSinglePointApy("La fourchette 8-15% est indicative.", true)).toBe(false);
  });

  it('EN range: "9.4-12.8% APY"', () => {
    expect(hasSinglePointApy("The target is a 9.4-12.8% APY range.", true)).toBe(false);
  });

  it('FR range: "rendement entre 8 et 15 %"', () => {
    expect(hasSinglePointApy("Le rendement entre 8 et 15 % est projeté selon les hypothèses.", true)).toBe(false);
  });

  it('neutral: "Le café coûte 3% de plus" (no yield topic)', () => {
    expect(hasSinglePointApy("Le café coûte 3% de plus.", true)).toBe(false);
  });

  it('neutral: "80% of the reserve is USDC" (no yield topic)', () => {
    expect(hasSinglePointApy("80% of the reserve is USDC.", true)).toBe(false);
  });

  it('neutral: "Le rendement passé ne préjuge pas du futur" (no %)', () => {
    expect(hasSinglePointApy("Le rendement passé ne préjuge pas du futur.", true)).toBe(false);
  });

  it('EN range via "to": "yields 8 to 15%"', () => {
    expect(hasSinglePointApy("The vault yields 8 to 15%.", true)).toBe(false);
  });

  it('EN range via "fourchette" keyword', () => {
    expect(hasSinglePointApy("The fourchette for returns is communicated quarterly.", true)).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Regression: "returns"/"yields" as VERBS with an unrelated % elsewhere
  // (false-fire regression introduced when YIELD_TOPIC_RE was broadened
  // beyond "APY"; fixed by YIELD_PROXIMITY_RE requiring the % within 50 chars
  // of the keyword).
  // -------------------------------------------------------------------------

  it('regression: "returns capital monthly … 2% management fee" (verb, unrelated %)', () => {
    expect(
      hasSinglePointApy(
        "The vault returns capital monthly and charges a 2% management fee.",
        true,
      ),
    ).toBe(false);
  });

  it('regression: "share class returns capital monthly; fee is 2%" (verb, unrelated %)', () => {
    expect(
      hasSinglePointApy(
        "This share class returns capital monthly; the fee is 2%.",
        true,
      ),
    ).toBe(false);
  });

  it('regression: "Mining yields fluctuate … downtime up to 5%" (verb, unrelated %)', () => {
    expect(
      hasSinglePointApy(
        "Mining yields fluctuate, and downtime can be up to 5% in a bad month.",
        true,
      ),
    ).toBe(false);
  });

  it('regression: "Hashprice returns to baseline after a 3% drawdown" (verb, unrelated %)', () => {
    expect(
      hasSinglePointApy(
        "Hashprice returns to baseline after a 3% drawdown in week one.",
        true,
      ),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// MULTI-SENTENCE — one bad sentence among several good ones
// ---------------------------------------------------------------------------

describe("hasSinglePointApy — multi-sentence: fires when ONE sentence is a single-point yield", () => {
  it("detects a single-point FR yield buried after compliant sentences", () => {
    const text = [
      "Hearst distribue de l'USDC chaque mois aux investisseurs.",
      "La fourchette cible est de 9,4 à 12,8 %.",
      "Le rendement de 12% est projeté pour le trimestre.",
    ].join(" ");
    expect(hasSinglePointApy(text, true)).toBe(true);
  });

  it("does NOT fire when all sentences are compliant", () => {
    const text = [
      "Hearst distribue de l'USDC chaque mois aux investisseurs.",
      "La fourchette cible est de 9,4 à 12,8 %.",
      "Le rendement entre 8 et 15 % est projeté selon les hypothèses.",
    ].join(" ");
    expect(hasSinglePointApy(text, true)).toBe(false);
  });

  it("detects a single-point EN yield buried after compliant sentences", () => {
    const text = [
      "Monthly USDC distributions are wired to your connected wallet.",
      "The target APY range is 9.4-12.8%.",
      "The vault returns exactly 11% under current projections.",
    ].join(" ");
    expect(hasSinglePointApy(text, true)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SOURCE ATTRIBUTION exemption — a per-source component contribution is NOT the
// headline APY, so a single-point figure attributed to a yield source must NOT
// fire. This closed BUG 1 (educational "explique comment fonctionne le yield"
// answers were blocked because the methodology's own source figures — mining
// ~6,2 %, USDC base ~4,8 %, réserve ~4,5 % — looked like headline single-points).
// ---------------------------------------------------------------------------

describe("hasSinglePointApy — source attribution (BUG 1) MUST NOT FIRE", () => {
  it("FR: full source breakdown (mining / USDC base / réserve)", () => {
    const text =
      "Le rendement provient de plusieurs sources : le cashflow du mining contribue environ 6,2 %, le yield USDC de base environ 4,8 %, et la réserve stable environ 4,5 %.";
    expect(hasSinglePointApy(text, true)).toBe(false);
  });

  it('FR: single source "le mining génère un rendement d\'environ 6,2 % via le rev-share"', () => {
    const text =
      "Le mining génère un rendement d'environ 6,2 % via le rev-share des fermes partenaires.";
    expect(hasSinglePointApy(text, true)).toBe(false);
  });

  it('FR: "le yield USDC de base apporte environ 4,8 %"', () => {
    expect(
      hasSinglePointApy("Le yield USDC de base apporte environ 4,8 %.", true),
    ).toBe(false);
  });

  it('EN: "T-bills lending contributes around 4.8%"', () => {
    expect(
      hasSinglePointApy("Tokenized T-bills lending contributes around 4.8%.", true),
    ).toBe(false);
  });
});

// A source cue WITHOUT a real component, or a headline claim, must still fire —
// the exemption requires BOTH a contribution cue AND a named component, so it
// cannot launder the headline single-point rule.
describe("hasSinglePointApy — source exemption does NOT launder headline claims", () => {
  it('FR headline still blocks: "le rendement annualisé du vault est de 11 %"', () => {
    expect(
      hasSinglePointApy("Le rendement annualisé du vault est de 11 %.", true),
    ).toBe(true);
  });

  it('FR: component noun but no contribution cue still blocks: "le mining vault rend 11 %"', () => {
    // "mining" present but no contribution cue (provient/contribue/via…) → fires.
    expect(hasSinglePointApy("Le rendement du mining vault est de 11 %.", true)).toBe(
      true,
    );
  });
});
