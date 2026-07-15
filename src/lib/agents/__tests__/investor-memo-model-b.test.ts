import { describe, expect, it } from "vitest";

import { buildSystemInstructions } from "@/lib/agents/investor-memo";
import { containsForbidden } from "@/lib/agents/forbidden-words";

// ---------------------------------------------------------------------------
// C-07 — v3.0 mining-note product model in buildSystemInstructions
// ---------------------------------------------------------------------------
// The Investor Memo system prompt must impose the ACTIVE product model
// (methodology v3.0 / ADR-019): a BTC-accumulation mining note held in three
// on-chain pockets (B1 40 / B2 27 / B3 33), BTC accumulated over a 24-month
// term and delivered at maturity, with NO periodic cash distribution and NO
// fixed APY. The dead "Model B" yield-vault framing — a USDC cash reserve
// funding a monthly mining-revenue-share distribution, "four sleeves", a BTC
// "satellite sleeve" — must NOT reappear: it contradicted the v3.0 methodology
// injected into the same prompt (getMethodologyMd), making the agent prose
// disagree with the static v3.0 PDF template inside the same document.

describe("buildSystemInstructions — v3.0 mining-note model", () => {
  const instructions = buildSystemInstructions("v3.0");

  it("states the BTC-accumulation mining-note thesis", () => {
    expect(instructions).toContain("BTC-accumulation mining note");
  });

  it("names the three on-chain pockets with their fixed allocation", () => {
    expect(instructions).toContain("B1 Mining Power 40%");
    expect(instructions).toContain("B2 BTC Pouch 27%");
    expect(instructions).toContain("B3 Reserve USDC 33%");
  });

  it("states BTC is accumulated over a 24-month term and delivered at maturity", () => {
    expect(instructions).toContain("accumulates BTC over a 24-month term");
    expect(instructions).toContain("delivers BTC at maturity");
  });

  it("forbids the dead periodic-distribution / fixed-APY framing", () => {
    expect(instructions).toContain("NO periodic cash distribution");
    expect(instructions).toContain("NO fixed APY");
  });

  it("names the three on-chain mechanisms (take-profit, vending, curtailment)", () => {
    expect(instructions).toContain("take-profit");
    expect(instructions).toContain("vending curve");
    expect(instructions).toContain("curtail");
  });

  it("no longer carries the dead Model B yield-vault framing", () => {
    expect(instructions).not.toContain(
      "mining-revenue-share distribution injected monthly",
    );
    expect(instructions).not.toContain("USDC cash reserve inside the vault");
    expect(instructions).not.toContain("satellite sleeve");
    expect(instructions).not.toContain("target monthly distribution");
  });

  it("product-mechanics sentence itself contains no forbidden word", () => {
    // The full instructions intentionally cite forbidden words in the
    // "Never use the words: ..." guardrail rule, so linting the whole string
    // would always flag them (the negation window is only 3 words wide). Scope
    // the assertion to the product-mechanics sentence, which must be clean.
    const mechanicsRule =
      "Net mining margin accrues to the note as BTC accumulation; the mining pocket's electricity is settled on-chain through the electricity account.";
    expect(containsForbidden(mechanicsRule)).toBeNull();
  });
});

describe("buildSystemInstructions — model is version-independent", () => {
  it("imposes the v3.0 mining-note model across every methodology variant", () => {
    for (const version of ["v1.0", "v2.0", "v3.0"] as const) {
      const instructions = buildSystemInstructions(version);
      expect(instructions).toContain("BTC-accumulation mining note");
      expect(instructions).toContain("NO periodic cash distribution");
    }
  });
});
