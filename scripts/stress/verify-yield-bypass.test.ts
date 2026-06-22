/**
 * Independent adversarial reproduction for tier2:compliance finding:
 * "Single-point yield 'yields exactly 9.4%' passes the compliance guard".
 *
 * Calls the PRODUCTION guard (`chatOutputViolation`) directly with `final=true`
 * (buffered / flush path), exactly how a fully-rendered chat answer is validated
 * in chat-agent.ts:572. No LLM client, no network, no mocks needed.
 */
import { describe, it, expect } from "vitest";
import { chatOutputViolation } from "@/lib/llm/output-guard";
import { hasSinglePointApy } from "@/lib/agents/apy-range";

describe("REPRO: EN single-point yield bypass (#1)", () => {
  it("the exact cited phrase is NOT blocked", () => {
    expect(chatOutputViolation("yields exactly 9.4%", true)).toBeNull();
  });

  it("hasSinglePointApy never even checks it (no APY token)", () => {
    expect(hasSinglePointApy("yields exactly 9.4%", true)).toBe(false);
    // Same percent WITH the APY token -> correctly caught:
    expect(hasSinglePointApy("APY exactly 9.4%", true)).toBe(true);
  });

  it("scope: any yield/return phrasing without the literal 'APY' bypasses", () => {
    // These are real, investor-facing single-point yield claims:
    expect(chatOutputViolation("The vault returns exactly 11%.", true)).toBeNull();
    expect(chatOutputViolation("You earn 12% yield.", true)).toBeNull();
    expect(chatOutputViolation("rendement de 12%", true)).toBeNull(); // FR twin
  });

  it("control: an explicit APY single point IS blocked", () => {
    expect(chatOutputViolation("APY 11%", true)).toBe("single_point_apy");
  });
});
