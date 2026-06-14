import { describe, expect, it } from "vitest";

import { hasSinglePointApy } from "@/lib/agents/apy-range";
import { assertApyAlwaysRange } from "@/lib/agents/validators";

describe("hasSinglePointApy — detector (shared with the chat output guard)", () => {
  it("flags a sentence that names APY with a single percentage and no range", () => {
    expect(hasSinglePointApy("The vault targets an APY of 11%.", true)).toBe(true);
    expect(hasSinglePointApy("Projected APY is 9.4%.", true)).toBe(true);
  });

  it("accepts a genuine percentage range", () => {
    expect(hasSinglePointApy("The vault targets a 9.4-12.8% APY range.", true)).toBe(false);
    expect(hasSinglePointApy("APY de 8 à 15 % selon les hypothèses.", true)).toBe(false);
    expect(hasSinglePointApy("Un APY entre 8 et 15 % est projeté.", true)).toBe(false);
    expect(hasSinglePointApy("APY 9.0-12.0% in Balanced mode.", true)).toBe(false);
  });

  it("does not flag a sentence with no APY token", () => {
    expect(hasSinglePointApy("Mining margin is healthy at 17.5%.", true)).toBe(false);
  });

  it("does not let an incidental non-percentage range excuse a single-point APY", () => {
    // "8 à 15 fermes" is a bare numeric range with no % inside it — it must NOT
    // excuse the lone "11%" APY in the same sentence.
    expect(
      hasSinglePointApy("Sur 8 à 15 fermes, l'APY ressort à 11%.", true),
    ).toBe(true);
  });
});

describe("assertApyAlwaysRange — agent output validator (#1)", () => {
  it("throws on a single-point APY", () => {
    expect(() => assertApyAlwaysRange("Projected APY is 11%.")).toThrow(/range/i);
  });

  it("passes a range and APY-free text", () => {
    expect(() => assertApyAlwaysRange("APY range is 9.4-12.8%.")).not.toThrow();
    expect(() => assertApyAlwaysRange("Margins are healthy at 17.5%.")).not.toThrow();
    expect(() => assertApyAlwaysRange("")).not.toThrow();
  });
});
