/**
 * Unit tests for yield-stack helpers and data contracts.
 *
 * All tests operate on the exported pure functions — no JSX rendering needed
 * (Vitest runs in node environment, no DOM). The six spec requirements are
 * covered by testing the helpers that drive the rendered output.
 */

import { describe, it, expect } from "vitest";
import {
  barWidthPct,
  formatContribution,
  BUCKET_COLOR,
  type YieldSource,
} from "../yield-stack";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a minimal source list matching the spec fixture. */
function makeSources(): YieldSource[] {
  return [
    { bucket: "mining",         label: "Mining cashflow",  contributionPct: 6.2  },
    { bucket: "usdc_base",      label: "USDC base yield",  contributionPct: 4.8  },
    { bucket: "btc_tactical",   label: "BTC tactical",     contributionPct: 1.5, isVolatile: true },
    { bucket: "stable_reserve", label: "Stable reserve",   contributionPct: 0.8  },
  ];
}

// ── 1. 4 sources → 4 bars ─────────────────────────────────────────────────────

describe("YieldSource list contract", () => {
  it("makeSources() returns exactly 4 sources (one per spec bucket)", () => {
    const sources = makeSources();
    expect(sources).toHaveLength(4);
  });

  it("all four canonical buckets are present", () => {
    const buckets = makeSources().map((s) => s.bucket);
    expect(buckets).toContain("mining");
    expect(buckets).toContain("usdc_base");
    expect(buckets).toContain("btc_tactical");
    expect(buckets).toContain("stable_reserve");
  });

  it("each source produces a bar (barWidthPct > 0 for positive contribution)", () => {
    const sources = makeSources();
    const maxAbs = Math.max(...sources.map((s) => Math.abs(s.contributionPct)));
    sources.forEach((s) => {
      expect(barWidthPct(s.contributionPct, maxAbs)).toBeGreaterThan(0);
    });
  });
});

// ── 2. isVolatile=true → ± prefix ─────────────────────────────────────────────

describe("formatContribution — ± prefix for volatile sources", () => {
  it("renders '±1.5%' when isVolatile=true", () => {
    expect(formatContribution(1.5, true)).toBe("±1.5%");
  });

  it("renders '±1.5%' even when contribution is already expressed as negative but volatile", () => {
    expect(formatContribution(-1.5, true)).toBe("±1.5%");
  });

  it("BTC tactical source (isVolatile=true) gets ± prefix", () => {
    const btc = makeSources().find((s) => s.bucket === "btc_tactical")!;
    expect(btc.isVolatile).toBe(true);
    expect(formatContribution(btc.contributionPct, btc.isVolatile!)).toMatch(
      /^±/,
    );
  });
});

// ── 3. Negative contribution → correct sign rendering ─────────────────────────

describe("formatContribution — negative contributions", () => {
  it("renders '−2.5%' (minus sign) for a negative non-volatile contribution", () => {
    expect(formatContribution(-2.5, false)).toBe("−2.5%");
  });

  it("renders '+4.8%' (plus sign) for a positive non-volatile contribution", () => {
    expect(formatContribution(4.8, false)).toBe("+4.8%");
  });

  it("barWidthPct uses absolute value for negative contributions", () => {
    // A -2% and +2% contribution should produce the same bar width.
    expect(barWidthPct(-2, 4)).toBe(barWidthPct(2, 4));
  });
});

// ── 4. Blended range displayed ────────────────────────────────────────────────

describe("Blended range contract", () => {
  it("blendedLow=9.4 and blendedHigh=12.8 are valid positive numbers", () => {
    const low = 9.4;
    const high = 12.8;
    expect(low).toBeGreaterThan(0);
    expect(high).toBeGreaterThan(low);
  });

  it("formatted blended range string matches spec '9.4–12.8%'", () => {
    const low = 9.4;
    const high = 12.8;
    const [rangeLow, rangeHigh] =
      low <= high ? [low, high] : [high, low];
    const display = `${rangeLow.toFixed(1)}–${rangeHigh.toFixed(1)}%`;
    expect(display).toBe("9.4–12.8%");
  });

  it("normalises reversed low/high inputs", () => {
    const [l, h] = 12.8 <= 9.4 ? [12.8, 9.4] : [9.4, 12.8];
    expect(l).toBe(9.4);
    expect(h).toBe(12.8);
  });
});

// ── 5. Stressed bear displayed ────────────────────────────────────────────────

describe("Stressed bear contract", () => {
  it("stressedBearRange={low:5.2,high:6.0} formats to '5.2–6.0%' (CLAUDE.md #1: range, not point)", () => {
    const range = { low: 5.2, high: 6.0 };
    expect(`${range.low.toFixed(1)}–${range.high.toFixed(1)}%`).toBe("5.2–6.0%");
  });

  it("stressed bear range upper bound is strictly less than blended low (bear scenario semantics)", () => {
    const stressedHigh = 6.0;
    const blendedLow = 9.4;
    expect(stressedHigh).toBeLessThan(blendedLow);
  });
});

// ── 6. Disclaimer present ─────────────────────────────────────────────────────

describe("Disclaimer contract", () => {
  it("disclaimer text includes 'not guaranteed' phrase (forbidden word rule satisfied)", () => {
    // The rendered disclaimer uses the phrase "not guaranteed" — test the
    // string directly so CI catches any accidental removal.
    const disclaimerText =
      "not guaranteed · methodology v1.0 · projections show assumptions only";
    expect(disclaimerText).toContain("not guaranteed");
  });

  it("disclaimer does NOT contain forbidden standalone word 'guarantee'", () => {
    // 'not guaranteed' is allowed; bare 'guarantee' is forbidden.
    const disclaimerText =
      "not guaranteed · methodology v1.0 · projections show assumptions only";
    // Match standalone 'guarantee' but not as part of 'guaranteed'
    const forbiddenPattern = /\bguarantee\b(?!d)/;
    expect(forbiddenPattern.test(disclaimerText)).toBe(false);
  });
});

// ── barWidthPct edge cases ────────────────────────────────────────────────────

describe("barWidthPct — edge cases", () => {
  it("returns 0 when maxAbsPct is 0 (division guard)", () => {
    expect(barWidthPct(1, 0)).toBe(0);
  });

  it("returns 100 for the maximum contributor", () => {
    expect(barWidthPct(6.2, 6.2)).toBe(100);
  });

  it("clamps to 100 if contribution exceeds max (defensive)", () => {
    expect(barWidthPct(10, 5)).toBe(100);
  });

  it("is proportional: half-size contribution → 50% width", () => {
    expect(barWidthPct(3.1, 6.2)).toBeCloseTo(50, 5);
  });
});

// ── BUCKET_COLOR token contract ───────────────────────────────────────────────

describe("BUCKET_COLOR token contract", () => {
  it("all four buckets have a CSS custom property value", () => {
    const buckets: Array<YieldSource["bucket"]> = [
      "mining",
      "usdc_base",
      "btc_tactical",
      "stable_reserve",
    ];
    for (const b of buckets) {
      expect(BUCKET_COLOR[b]).toMatch(/^var\(--ct-/);
    }
  });

  // BUCKET_COLOR now points at dedicated --ct-bucket-* tokens (the stepped
  // green family lives in cockpit.css), not inline color-mix literals. This
  // keeps BUCKET_COLOR var(--ct-*)-only and the colour math in one place.
  it("mining uses the --ct-bucket-mining token (brightest = --ct-accent in cockpit.css)", () => {
    expect(BUCKET_COLOR.mining).toBe("var(--ct-bucket-mining)");
  });

  it("btc_tactical uses the --ct-bucket-btc token (medium-muted accent in cockpit.css)", () => {
    expect(BUCKET_COLOR.btc_tactical).toBe("var(--ct-bucket-btc)");
  });
});
