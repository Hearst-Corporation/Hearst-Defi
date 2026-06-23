import { describe, expect, it } from "vitest";

import {
  areaFromLine,
  barHeight,
  barX,
  baseline,
  project,
  smoothPath,
  type ViewBox,
} from "@/lib/portfolio/geometry";

const VC_BOX: ViewBox = { w: 200, h: 62, padY: 5 };

describe("geometry/project", () => {
  it("returns [] for an empty series", () => {
    expect(project([], VC_BOX)).toEqual([]);
  });

  it("centers a single point on the x-axis", () => {
    const [p] = project([100], VC_BOX);
    expect(p?.x).toBe(VC_BOX.w / 2);
  });

  it("spreads points edge-to-edge across the viewBox width", () => {
    const pts = project([1, 2, 3], VC_BOX);
    expect(pts[0]?.x).toBe(0);
    expect(pts[2]?.x).toBe(VC_BOX.w);
  });

  it("keeps a flat series inside the plot band (never NaN)", () => {
    const pts = project([5, 5, 5], VC_BOX);
    for (const p of pts) {
      expect(Number.isFinite(p.y)).toBe(true);
      expect(p.y).toBeGreaterThanOrEqual(VC_BOX.padY);
      expect(p.y).toBeLessThanOrEqual(VC_BOX.h - VC_BOX.padY);
    }
  });

  it("maps the max value to the top of the plot band and min to the bottom", () => {
    const pts = project([0, 100], VC_BOX);
    expect(pts[1]!.y).toBeLessThan(pts[0]!.y); // higher value → smaller y (up)
  });
});

describe("geometry/baseline", () => {
  it("pins every point to the bottom axis", () => {
    const pts = baseline(4, VC_BOX);
    for (const p of pts) expect(p.y).toBe(VC_BOX.h - VC_BOX.padY);
    expect(pts[0]?.x).toBe(0);
    expect(pts[3]?.x).toBe(VC_BOX.w);
  });
});

describe("geometry/smoothPath + areaFromLine", () => {
  it("returns empty string for fewer than 2 points", () => {
    expect(smoothPath([])).toBe("");
    expect(smoothPath([{ x: 1, y: 1 }])).toBe("");
  });

  it("starts with a moveto and uses cubic bezier segments", () => {
    const pts = project([1, 4, 2, 8], VC_BOX);
    const d = smoothPath(pts);
    expect(d.startsWith("M ")).toBe(true);
    expect(d).toContain("C ");
  });

  it("closes the area back to the bottom axis", () => {
    const pts = project([1, 4, 2], VC_BOX);
    const area = areaFromLine(smoothPath(pts), pts, VC_BOX.h);
    expect(area.endsWith("Z")).toBe(true);
    expect(area).toContain(`${VC_BOX.h}`);
  });

  it("returns empty area when the line is empty", () => {
    expect(areaFromLine("", [], VC_BOX.h)).toBe("");
  });
});

describe("geometry/bars", () => {
  const BOX_W = 560;
  const BAR_AREA_H = 132;

  it("centers bars within the box", () => {
    const x0 = barX(0, 4, 100, 4, BOX_W);
    const xLast = barX(3, 4, 100, 4, BOX_W);
    const totalUsed = 4 * 100 + 3 * 4;
    expect(x0).toBeCloseTo((BOX_W - totalUsed) / 2);
    expect(xLast + 100).toBeCloseTo(x0 + totalUsed);
  });

  it("returns 0 height for an empty series and clamps to a 4-unit minimum", () => {
    expect(barHeight(10, 0, BAR_AREA_H)).toBe(0);
    expect(barHeight(0.0001, 1000, BAR_AREA_H)).toBe(4);
  });

  it("normalises the tallest bar to the full bar area", () => {
    expect(barHeight(1000, 1000, BAR_AREA_H)).toBe(BAR_AREA_H);
  });
});
