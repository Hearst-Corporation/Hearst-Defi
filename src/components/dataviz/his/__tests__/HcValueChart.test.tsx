/**
 * Tests for HcValueChart — the hero NAV / value-over-time instrument on
 * /portfolio. Rendered with `react-dom/server` renderToStaticMarkup (the
 * project's vitest `environment: "node"`, no jsdom). Assertions run against the
 * produced SVG/HTML string.
 *
 * Contract: honesty + stability. <2 points → an explicit empty surface (never a
 * fabricated line); a real series → a FIXED-viewBox SVG (no distorting
 * `preserveAspectRatio="none"`); the y-axis baselines at 0; the path never
 * contains NaN; the endpoint is always labelled with context.
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
    expect(html).toContain("No portfolio history yet");
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
    expect(html).toContain("url(#hc-value-fill)");
    expect(html).toContain("var(--ct-chart-curve-color)");
    // Two <path> elements: area + line.
    expect(count(html, "<path")).toBe(2);
    // Final value dot.
    expect(html).toContain("<circle");
  });

  it("uses a FIXED viewBox and does NOT stretch with preserveAspectRatio=none", () => {
    const html = renderToStaticMarkup(
      <HcValueChart points={SERIES} aria-label="Portfolio value trend" />,
    );
    expect(html).toContain('viewBox="0 0 720 240"');
    expect(html).not.toContain('preserveAspectRatio="none"');
    expect(html).toContain('preserveAspectRatio="xMidYMid meet"');
  });

  it("baselines the y-axis at 0 so the curve reads as a climb from zero", () => {
    const html = renderToStaticMarkup(
      <HcValueChart points={SERIES} aria-label="Portfolio value trend" />,
    );
    expect(html).toContain("$0");
    // Three value gridlines are emitted (min / mid / max).
    expect(count(html, 'data-hc-grid="y"')).toBe(3);
  });

  it("labels the x-axis with the dates passed as ticks", () => {
    const html = renderToStaticMarkup(
      <HcValueChart
        points={SERIES}
        granularity="monthly"
        xTicks={[
          { index: 0, label: "Jan" },
          { index: 3, label: "Apr" },
        ]}
        aria-label="Portfolio value trend"
      />,
    );
    expect(html).toContain("Jan");
    expect(html).toContain("Apr");
  });

  it("renders the endpoint label + latest value callout", () => {
    const html = renderToStaticMarkup(
      <HcValueChart points={SERIES} aria-label="Portfolio value trend" />,
    );
    expect(html).toContain('data-hc-endpoint="true"');
    expect(html).toContain("Latest");
    // Latest value ($11,000 → "$11.0K") appears in the callout.
    expect(html).toContain("$11.0K");
  });

  it("never emits NaN in the path geometry", () => {
    const html = renderToStaticMarkup(
      <HcValueChart points={SERIES} aria-label="Portfolio value trend" />,
    );
    expect(html).not.toContain("NaN");
  });

  it("token-only: emits no raw hex color", () => {
    const html = renderToStaticMarkup(
      <HcValueChart points={SERIES} aria-label="Portfolio value trend" />,
    );
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

// 3 ─ Flat series stays flat and produces no NaN.
describe("HcValueChart — flat series", () => {
  it("renders a flat line without NaN", () => {
    const flat: HcValuePoint[] = [
      { at: "2026-01-15T00:00:00Z", value: 500 },
      { at: "2026-01-16T00:00:00Z", value: 500 },
      { at: "2026-01-17T00:00:00Z", value: 500 },
    ];
    const html = renderToStaticMarkup(
      <HcValueChart points={flat} aria-label="Portfolio value trend" />,
    );
    expect(html).toContain("<svg");
    expect(html).not.toContain("NaN");
  });
});

// 4 ─ A large account ($500k) scales its y-axis to the volume (no overflow/clamp).
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
    // Default formatter renders a top tick in $M / $K for a half-million NAV.
    expect(html).toMatch(/\$\d[\d.]*M|\$\d[\d.]*K/);
  });
});
