import { describe, expect, it } from "vitest";

import {
  computeNavBarHeights,
  navBarChartAriaLabel,
  resolveNavMonthLabels,
} from "@/lib/admin/nav-bar-chart";
import type { NavPoint } from "@/lib/data/dashboard";

function pts(entries: [string, number][]): NavPoint[] {
  return entries.map(([date, aum_usdc]) => ({ date, aum_usdc }));
}

describe("computeNavBarHeights", () => {
  it("returns an empty array for no points", () => {
    expect(computeNavBarHeights([])).toEqual([]);
  });

  it("uses a neutral mid height for a flat series", () => {
    const heights = computeNavBarHeights(pts([
      ["2026-05-01", 500_000],
      ["2026-05-15", 500_000],
    ]));
    expect(heights.every((slice) => slice.heightPct === 50)).toBe(true);
  });

  it("anchors the period start at the low end when NAV only rises", () => {
    const heights = computeNavBarHeights(pts([
      ["2026-05-01", 400_000],
      ["2026-05-15", 500_000],
    ]));
    expect(heights[0]?.heightPct).toBe(0);
    expect(heights[1]?.heightPct).toBe(100);
  });

  it("anchors the period start at the high end when NAV only falls", () => {
    const heights = computeNavBarHeights(pts([
      ["2026-05-01", 500_000],
      ["2026-05-15", 400_000],
    ]));
    expect(heights[0]?.heightPct).toBe(100);
    expect(heights[1]?.heightPct).toBe(0);
  });

  it("does not inflate small moves with an artificial floor", () => {
    const heights = computeNavBarHeights(pts([
      ["2026-05-01", 500_000],
      ["2026-05-02", 501_000],
    ]));
    expect(heights[0]?.heightPct).toBe(0);
    expect(heights[1]?.heightPct).toBe(100);
    expect(heights.some((slice) => slice.heightPct === 10)).toBe(false);
  });

  it("shows oscillation around the period start", () => {
    const heights = computeNavBarHeights(pts([
      ["2026-05-01", 500_000],
      ["2026-05-08", 520_000],
      ["2026-05-15", 500_000],
      ["2026-05-22", 520_000],
    ]));
    expect(heights.map((slice) => slice.heightPct)).toEqual([0, 100, 0, 100]);
  });

  it("falls back to min-max when the period start is zero", () => {
    const heights = computeNavBarHeights(pts([
      ["2026-05-01", 0],
      ["2026-05-15", 100_000],
    ]));
    expect(heights[0]?.heightPct).toBe(0);
    expect(heights[1]?.heightPct).toBe(100);
  });
});

describe("navBarChartAriaLabel", () => {
  it("describes empty, single-day, and multi-day windows", () => {
    expect(navBarChartAriaLabel([])).toBe("NAV trend — no data");
    expect(navBarChartAriaLabel(pts([["2026-05-01", 1]]))).toBe(
      "NAV trend, 1 day (2026-05-01)",
    );
    expect(
      navBarChartAriaLabel(pts([
        ["2026-05-01", 400_000],
        ["2026-05-15", 500_000],
      ])),
    ).toBe("NAV trend, 2 days from 2026-05-01 to 2026-05-15");
  });
});

describe("resolveNavMonthLabels", () => {
  it("derives axis labels from the actual point dates", () => {
    expect(
      resolveNavMonthLabels(pts([
        ["2026-02-01", 100],
        ["2026-03-01", 110],
        ["2026-04-01", 120],
        ["2026-05-01", 130],
        ["2026-06-01", 140],
        ["2026-07-01", 150],
      ])),
    ).toEqual(["Feb", "Mar", "Apr", "May", "Jun", "Jul"]);
  });

  it("returns null when there are not enough points for an axis", () => {
    expect(resolveNavMonthLabels(pts([["2026-05-01", 1]]))).toBeNull();
  });
});
