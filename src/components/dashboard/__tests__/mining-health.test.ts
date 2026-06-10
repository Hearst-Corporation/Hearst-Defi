/**
 * Mining Health — unit tests for pure-logic helpers exported from the component.
 *
 * Tests cover:
 *  1. marginScoreCell helper returns 0–100 and is deterministic
 *  2. cellFill maps score buckets to the correct CSS vars
 *  3. pairToXY positions the marker within SVG bounds
 *  4. buildHeatmapGrid dimensions + score bounds
 *  5. LEGEND_SWATCHES has exactly 5 entries
 *  6. clamp utility
 */
import { describe, expect, it } from "vitest";
import {
  buildHeatmapGrid,
  cellFill,
  clamp,
  LEGEND_SWATCHES,
  marginScoreCell,
  pairToXY,
} from "../mining-health";

// ── 1. marginScoreCell ────────────────────────────────────────────────────────

describe("marginScoreCell", () => {
  it("returns 0 for min hashprice + min BTC", () => {
    const score = marginScoreCell(0.05, 50000);
    expect(score).toBe(0);
  });

  it("returns 100 for max hashprice + max BTC", () => {
    const score = marginScoreCell(0.10, 75000);
    expect(score).toBe(100);
  });

  it("always returns a value in [0, 100]", () => {
    const pairs = [
      [0.05, 50000],
      [0.06, 55000],
      [0.07, 60000],
      [0.082, 68000], // spec "current position"
      [0.10, 75000],
      [0.03, 40000], // below min — clamp
      [0.15, 90000], // above max — clamp
    ] as const;
    for (const [hp, btc] of pairs) {
      const s = marginScoreCell(hp, btc);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    }
  });

  it("is deterministic (same inputs → same output)", () => {
    expect(marginScoreCell(0.082, 68000)).toBe(marginScoreCell(0.082, 68000));
  });

  it("spec example: hashprice 0.082, BTC 68k → score > 50", () => {
    // Mid-range inputs should yield a meaningful mid-range score
    const score = marginScoreCell(0.082, 68000);
    expect(score).toBeGreaterThan(50);
    expect(score).toBeLessThanOrEqual(100);
  });
});

// ── 2. cellFill ───────────────────────────────────────────────────────────────

describe("cellFill", () => {
  it("score 0 (unprofitable) → faint fill, low opacity", () => {
    const { fill, opacity } = cellFill(0);
    expect(fill).toContain("ct-text-faint");
    expect(opacity).toBeLessThan(0.4);
  });

  it("score 20 (<40) → danger fill", () => {
    const { fill } = cellFill(20);
    expect(fill).toContain("ct-status-danger");
  });

  it("score 50 (40–60) → warning fill", () => {
    const { fill } = cellFill(50);
    expect(fill).toContain("ct-status-warning");
  });

  it("score 70 (60–80) → accent fill, opacity 0.5", () => {
    const { fill, opacity } = cellFill(70);
    expect(fill).toContain("ct-accent");
    expect(opacity).toBe(0.5);
  });

  it("score 85 (>80) → accent fill, opacity 0.9", () => {
    const { fill, opacity } = cellFill(85);
    expect(fill).toContain("ct-accent");
    expect(opacity).toBe(0.9);
  });

  it("boundary: score 40 → warning (≥40, <60)", () => {
    const { fill } = cellFill(40);
    expect(fill).toContain("ct-status-warning");
  });

  it("boundary: score 60 → accent 0.5 (≥60, <80)", () => {
    const { fill, opacity } = cellFill(60);
    expect(fill).toContain("ct-accent");
    expect(opacity).toBe(0.5);
  });

  it("boundary: score 80 → accent 0.9 (≥80)", () => {
    const { fill, opacity } = cellFill(80);
    expect(fill).toContain("ct-accent");
    expect(opacity).toBe(0.9);
  });
});

// ── 3. pairToXY ───────────────────────────────────────────────────────────────

describe("pairToXY", () => {
  const SVG_W = 300;
  const SVG_H = 160;
  const PAD_L = 36;
  const PAD_T = 8;
  const PAD_R = 8;
  const PAD_B = 28;

  const xy = (hp: number, btc: number) =>
    pairToXY(hp, btc, SVG_W, SVG_H, PAD_L, PAD_T, PAD_R, PAD_B);

  it("marker is within SVG bounds for spec current position", () => {
    const { cx, cy } = xy(0.082, 68000);
    expect(cx).toBeGreaterThan(PAD_L);
    expect(cx).toBeLessThan(SVG_W - PAD_R);
    expect(cy).toBeGreaterThan(PAD_T);
    expect(cy).toBeLessThan(SVG_H - PAD_B);
  });

  it("min pair → top-left area", () => {
    const { cx, cy } = xy(0.05, 50000);
    // leftmost column, bottom row
    expect(cx).toBeLessThan(SVG_W / 2);
    expect(cy).toBeGreaterThan(SVG_H / 2);
  });

  it("max pair → bottom-right area of the grid", () => {
    const { cx, cy } = xy(0.10, 75000);
    // rightmost column, top row
    expect(cx).toBeGreaterThan(SVG_W / 2);
    expect(cy).toBeLessThan(SVG_H / 2);
  });

  it("out-of-range inputs are clamped within SVG bounds", () => {
    const { cx, cy } = xy(0.0, 10000);
    expect(cx).toBeGreaterThanOrEqual(PAD_L);
    expect(cy).toBeLessThanOrEqual(SVG_H - PAD_B);
  });
});

// ── 4. buildHeatmapGrid ───────────────────────────────────────────────────────

describe("buildHeatmapGrid", () => {
  const grid = buildHeatmapGrid();

  it("produces 8 rows", () => {
    expect(grid).toHaveLength(8);
  });

  it("each row has 12 cells", () => {
    for (const row of grid) {
      expect(row).toHaveLength(12);
    }
  });

  it("all scores are in [0, 100]", () => {
    for (const row of grid) {
      for (const cell of row) {
        expect(cell.score).toBeGreaterThanOrEqual(0);
        expect(cell.score).toBeLessThanOrEqual(100);
      }
    }
  });

  it("bottom-left cell (lowest BTC, lowest hashprice) has score 0", () => {
    // grid[7] = BTC_MIN (50000), col[0] = HP_MIN (0.05)
    // marginScoreCell(0.05, 50000) = round(0*0.6 + 0*0.4) = 0
    expect(grid[7]?.[0]?.score).toBe(0);
  });

  it("top-right cell (highest BTC, highest hashprice) has score 100", () => {
    // grid[0] = BTC_MAX (75000), col[11] = HP_MAX (0.10)
    // marginScoreCell(0.10, 75000) = round(1*0.6 + 1*0.4) * 100 = 100
    const topRight = grid[0]?.[11];
    expect(topRight?.score).toBe(100);
  });
});

// ── 5. LEGEND_SWATCHES ────────────────────────────────────────────────────────

describe("LEGEND_SWATCHES", () => {
  it("has exactly 5 swatches", () => {
    expect(LEGEND_SWATCHES).toHaveLength(5);
  });

  it("all swatches have label, fill, and opacity", () => {
    for (const s of LEGEND_SWATCHES) {
      expect(typeof s.label).toBe("string");
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.fill).toContain("var(--");
      expect(s.opacity).toBeGreaterThan(0);
      expect(s.opacity).toBeLessThanOrEqual(1);
    }
  });

  it("labels cover unprofitable, <40, 40–60, 60–80, >80", () => {
    const labels = LEGEND_SWATCHES.map((s) => s.label);
    expect(labels).toContain("Unprofitable");
    expect(labels).toContain("<40");
    expect(labels).toContain("40–60");
    expect(labels).toContain("60–80");
    expect(labels).toContain(">80");
  });
});

// ── 6. clamp ─────────────────────────────────────────────────────────────────

describe("clamp", () => {
  it("returns value when within range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it("clamps to min", () => {
    expect(clamp(-3, 0, 10)).toBe(0);
  });

  it("clamps to max", () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it("returns min when value equals min", () => {
    expect(clamp(0, 0, 10)).toBe(0);
  });

  it("returns max when value equals max", () => {
    expect(clamp(10, 0, 10)).toBe(10);
  });
});
