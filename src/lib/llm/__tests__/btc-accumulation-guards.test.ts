import { describe, expect, it } from "vitest";

import {
  chatOutputViolation,
  hasSinglePointBtcClaim,
} from "@/lib/llm/output-guard";
import { RETURN_PROMISE_HYPOTHESES } from "@/lib/llm/semantic-guard";

/**
 * Series 1 mining note (v3.0, ADR-019) BTC-accumulation guards.
 *
 * The active product accumulates BTC over a 24-month term and delivers it at
 * maturity, disclosed as a RANGE in accumulated BTC, not guaranteed. These tests
 * pin the four framings the guard must block — single-point BTC claim, APY/yield
 * wording, monthly distribution, guaranteed delivery — and prove a COMPLIANT
 * statement (range + not guaranteed) still passes, plus that legitimate
 * exemptions (reported balance, source attribution, honest negations) survive.
 */

// ---------------------------------------------------------------------------
// 1. Single-point BTC accumulation claim → single_point_btc
// ---------------------------------------------------------------------------

describe("single-point BTC accumulation claim", () => {
  it.each([
    "You will accumulate 0.85 BTC over the 24-month term.",
    "The note delivers 0.85 BTC at maturity.",
    "Investors receive 1.2 BTC at the end of the term.",
    "Vous accumulerez 0.85 BTC sur la durée du produit.",
    "L'investisseur recevra 1.2 BTC à l'échéance.",
    "Expected accumulated amount: 0.9 BTC.",
    "0.85 BTC accumulated by maturity.",
  ])("flags a single fixed BTC figure: %s", (text) => {
    expect(hasSinglePointBtcClaim(text, true)).toBe(true);
    expect(chatOutputViolation(text, true)).toBe("single_point_btc");
  });

  it.each([
    "Estimated accumulation is 0.7–0.9 BTC over the term, not guaranteed.",
    "You may accumulate between 0.7 and 0.9 BTC, an estimate that is not guaranteed.",
    "Accumulation projetée : entre 0.7 et 0.9 BTC, estimation non garantie.",
    "The estimated range is 0.7 to 0.9 BTC over the 24-month term.",
  ])("does NOT flag a BTC RANGE: %s", (text) => {
    expect(hasSinglePointBtcClaim(text, true)).toBe(false);
  });

  it("does NOT flag a reported CURRENT balance (fact, not forward claim)", () => {
    expect(
      hasSinglePointBtcClaim(
        "Your position currently holds 0.30 BTC accumulated so far.",
        true,
      ),
    ).toBe(false);
    expect(
      hasSinglePointBtcClaim("Solde actuel de la position : 0.30 BTC à ce jour.", true),
    ).toBe(false);
  });

  it("does NOT flag a per-source BTC attribution breakdown", () => {
    // hasSourceAttribution requires a contribution cue (provient/contribue/via…)
    // AND a named component (mining/reserve…) — reuse the recognised vocabulary.
    expect(
      hasSinglePointBtcClaim(
        "Cette accumulation provient du mining à hauteur de 0.12 BTC.",
        true,
      ),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. APY / fixed-yield wording → apy_yield_wording
// ---------------------------------------------------------------------------

describe("APY / fixed-yield wording (retired framing)", () => {
  it.each([
    "The vault has a fixed annual yield.",
    "This instrument targets a target APY over the term.",
    "Cette note verse un rendement annuel.",
    "Ce produit offre un rendement fixe.",
  ])("flags an APY / fixed-yield assertion: %s", (text) => {
    expect(chatOutputViolation(text, true)).toBe("apy_yield_wording");
  });

  it("blocks 'APY of 8%' (single_point_apy fires first — either code blocks)", () => {
    // A concrete APY figure is caught by the single-point-APY rule earlier in the
    // chain; both codes are a valid block. What matters: it is NOT compliant.
    const v = chatOutputViolation("This note offers an APY of 8%.", true);
    expect(v === "single_point_apy" || v === "apy_yield_wording").toBe(true);
  });

  it("does NOT flag neutral education contrasting a yield vault", () => {
    expect(
      chatOutputViolation(
        "Series 1 accumulates Bitcoin over the term; it does not pay a fixed coupon.",
        true,
      ),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. Monthly / periodic distribution → monthly_distribution
// ---------------------------------------------------------------------------

describe("monthly / periodic distribution (retired framing)", () => {
  it.each([
    "The note pays a monthly distribution to investors.",
    "You receive a quarterly payout in USDC.",
    "Le produit verse une distribution mensuelle.",
    "Distribution versée chaque mois aux investisseurs.",
  ])("flags a periodic distribution claim: %s", (text) => {
    expect(chatOutputViolation(text, true)).toBe("monthly_distribution");
  });

  it.each([
    "There is no monthly distribution; BTC is delivered once at maturity.",
    "Aucune distribution mensuelle : le BTC est livré une seule fois à l'échéance.",
  ])("does NOT flag the compliant negation: %s", (text) => {
    // The negated form is the honest statement of the product mechanic.
    expect(chatOutputViolation(text, true)).not.toBe("monthly_distribution");
  });
});

// ---------------------------------------------------------------------------
// 4. Guaranteed BTC delivery → guaranteed_delivery (or forbidden_words)
// ---------------------------------------------------------------------------

describe("guaranteed BTC delivery promise", () => {
  it.each([
    "Guaranteed delivery of 0.85 BTC at maturity.",
    "You are guaranteed to receive your accumulated BTC.",
    "Livraison garantie du BTC à l'échéance.",
  ])("flags a guaranteed-delivery promise: %s", (text) => {
    // "guarantee" is also a forbidden word; either code is a valid block.
    const v = chatOutputViolation(text, true);
    expect(v === "guaranteed_delivery" || v === "forbidden_words").toBe(true);
    expect(v).not.toBeNull();
  });

  it("does NOT flag an honest 'delivery is not guaranteed' disclaimer", () => {
    expect(
      chatOutputViolation(
        "Delivery of any specific BTC amount is not guaranteed and depends on mining output.",
        true,
      ),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 5. A fully compliant Series 1 statement PASSES all guards
// ---------------------------------------------------------------------------

describe("compliant Series 1 statement passes", () => {
  it("passes a range + not-guaranteed + no-distribution narrative", () => {
    const compliant =
      "Series 1 is a BTC-accumulation mining note. Over the 24-month term the " +
      "estimated accumulation is 0.7–0.9 BTC, delivered at maturity. This is an " +
      "estimate, not guaranteed, and there is no monthly distribution or fixed APY.";
    expect(chatOutputViolation(compliant, true)).toBeNull();
    expect(hasSinglePointBtcClaim(compliant, true)).toBe(false);
  });

  it("does NOT regress the existing source-attribution exemption", () => {
    // hasSourceAttribution keeps a per-component % breakdown compliant.
    const attribution =
      "The estimated return provient du mining à hauteur de ~6,2 % et de la réserve stable.";
    expect(chatOutputViolation(attribution, true)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 6. Semantic guard hypotheses include BTC paraphrase coverage
// ---------------------------------------------------------------------------

describe("semantic-guard BTC hypotheses", () => {
  it("adds Bitcoin single-point / guaranteed-delivery hypotheses", () => {
    const joined = RETURN_PROMISE_HYPOTHESES.join(" ").toLowerCase();
    expect(joined).toContain("bitcoin");
    expect(joined).toContain("delivered at maturity");
    expect(joined).toContain("fixed amount of bitcoin");
  });
});
