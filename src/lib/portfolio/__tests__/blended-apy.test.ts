import { describe, expect, it } from "vitest";

import { positionApyRange, withPositionApyFallback } from "@/lib/portfolio/blended-apy";

const ACTIVE = (apyLow: number | null, apyHigh: number | null) =>
  ({ status: "active" as const, apyLow, apyHigh });

describe("positionApyRange", () => {
  it("returns null with no positions", () => {
    expect(positionApyRange([])).toBeNull();
  });

  it("returns null when no active position carries a range", () => {
    expect(positionApyRange([{ status: "exited", apyLow: 8, apyHigh: 15 }])).toBeNull();
    expect(positionApyRange([ACTIVE(null, null)])).toBeNull();
  });

  it("takes min low / max high across active positions", () => {
    expect(positionApyRange([ACTIVE(8, 15), ACTIVE(9, 18)])).toEqual({ low: 8, high: 18 });
  });

  it("ignores non-active positions in the aggregate", () => {
    expect(
      positionApyRange([ACTIVE(8, 15), { status: "exited", apyLow: 2, apyHigh: 30 }]),
    ).toEqual({ low: 8, high: 15 });
  });
});

describe("withPositionApyFallback", () => {
  const STALE = { blendedLow: 0, blendedHigh: 0, source: "stale" as const };
  const LIVE = { blendedLow: 9.9, blendedHigh: 11.1, source: "live" as const };

  it("grafts the position range and marks source estimated when blended is 0/0", () => {
    const out = withPositionApyFallback(STALE, [ACTIVE(8, 15)]);
    expect(out.blendedLow).toBe(8);
    expect(out.blendedHigh).toBe(15);
    expect(out.source).toBe("estimated");
  });

  it("leaves a real vault blend untouched (no override when snapshot present)", () => {
    const out = withPositionApyFallback(LIVE, [ACTIVE(8, 15)]);
    expect(out).toEqual(LIVE);
  });

  it("leaves blended at 0 when there is no position range to fall back to", () => {
    const out = withPositionApyFallback(STALE, []);
    expect(out.blendedLow).toBe(0);
    expect(out.blendedHigh).toBe(0);
    expect(out.source).toBe("stale");
  });
});
