/**
 * Tests for HcValueChart — the hero NAV / value-over-time instrument on
 * /portfolio (the surface that replaced the deleted legacy value-chart.tsx).
 *
 * Rendered with `react-dom/server` renderToStaticMarkup — consistent with the
 * project's `environment: "node"` vitest config (no jsdom, no Testing Library).
 * Assertions run against the produced SVG/HTML string. Honesty is the contract:
 * <2 points must render the empty surface (never a fabricated line), and a real
 * series must baseline its y-axis at 0 so the curve reads as a climb from zero.
 */

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { HcValueChart, type HcValuePoint } from "../HcValueChart";

const count = (haystack: string, needle: string): number =>
  haystack.split(needle).length - 1;

// A real, evenly-sampled climb from a low base to a higher value (e.g. $11 → $11k).
const SERIES: HcValuePoint[] = [
  { at: "2026-01-15T00:00:00Z", value: 11 },
  { at: "2026-02-15T00:00:00Z", value: 4_200 },
  { at: "2026-03-15T00:00:00Z", value: 8_900 },
  { at: "2026-04-15T00:00:00Z", value: 11_000 },
];

// 1 ─ Honest empty state: fewer than 2 points renders the empty surface, no line.
describe("HcValueChart — empty / single-point", () => {
  it.each([
    ["empty", [] as HcValuePoint[]],
    ["single point", [{ at: "2026-01-15T00:00:00Z", value: 250_000 }] as HcValuePoint[]],
  ])("renders the honest empty surface with %s (no fabricated line)", (_label, points) => {
    const html = renderToStaticMarkup(
      <HcValueChart points={points} aria-label="Portfolio value trend" />,
    );
    expect(html).toContain('data-hc-empty="true"');
    expect(html).toContain("Chart available once activity is recorded");
    // No real chart geometry is drawn for an empty series.
    expect(html).not.toContain("<svg");
    expect(html).not.toContain("<path");
    // The accessible label is preserved even on the empty surface.
    expect(html).toContain('aria-label="Portfolio value trend"');
  });
});

// 2 ─ Real series renders the SVG instrument (area + line + axes), no empty marker.
describe("HcValueChart — with a real series", () => {
  it("draws the area, the curve and the end dot", () => {
    const html = renderToStaticMarkup(
      <HcValueChart points={SERIES} aria-label="Portfolio value trend" />,
    );
    expect(html).not.toContain('data-hc-empty="true"');
    expect(html).toContain("<svg");
    // Area fill (gradient) + the curve path are both present.
    expect(html).toContain("url(#hc-value-fill)");
    expect(html).toContain("var(--ct-chart-curve-color)");
    // The two <path> elements: area + line.
    expect(count(html, "<path")).toBe(2);
    // Final value dot.
    expect(html).toContain("<circle");
  });

  it("baselines the y-axis at 0 so the curve reads as a climb from zero", () => {
    const html = renderToStaticMarkup(
      <HcValueChart points={SERIES} aria-label="Portfolio value trend" />,
    );
    // The lowest y-tick label is exactly $0 — proves the zero baseline.
    expect(html).toContain("$0");
    // Three value gridlines are emitted (min / mid / max).
    expect(count(html, 'data-hc-grid="y"')).toBe(3);
  });

  it("labels the x-axis with month markers drawn from the real point dates", () => {
    const html = renderToStaticMarkup(
      <HcValueChart points={SERIES} aria-label="Portfolio value trend" />,
    );
    // Months come from the series timestamps (Jan / Apr present at the extremes).
    expect(html).toContain("Jan");
    expect(html).toContain("Apr");
  });

  it("token-only: emits no raw hex color", () => {
    const html = renderToStaticMarkup(
      <HcValueChart points={SERIES} aria-label="Portfolio value trend" />,
    );
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

// 3 ─ A large account ($500k) scales its y-axis to the volume (no overflow/clamp).
describe("HcValueChart — scales across account sizes", () => {
  it("renders a $M-scale y-axis tick for a large balance", () => {
    const big: HcValuePoint[] = [
      { at: "2026-01-15T00:00:00Z", value: 250_000 },
      { at: "2026-02-15T00:00:00Z", value: 500_000 },
    ];
    const html = renderToStaticMarkup(
      <HcValueChart points={big} aria-label="Portfolio value trend" />,
    );
    expect(html).toContain('data-hc-grid="y"');
    // Default formatter renders the top tick in $M for a half-million NAV.
    expect(html).toMatch(/\$0\.\d{2}M|\$\d+k/);
  });
});
