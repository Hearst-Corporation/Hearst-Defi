/**
 * Tests for HcValueChart — the hero NAV / value-over-time instrument on
 * /portfolio. Rendered with `react-dom/server` renderToStaticMarkup (the
 * project's vitest `environment: "node"`, no jsdom). Assertions run against the
 * produced SVG/HTML string.
 *
 * Contract: honesty + full-width + readability.
 *   - <2 points → an explicit empty surface (never a fabricated line);
 *   - a real series → the area/line SVG STRETCHES to fill the width
 *     (preserveAspectRatio="none") with a non-scaling stroke;
 *   - the y-axis baselines at 0;
 *   - per-day dots + an endpoint callout are rendered as crisp HTML (no shear);
 *   - the path never contains NaN.
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
    expect(html).not.toContain("<svg");
    expect(html).not.toContain("<path");
    expect(html).toContain('aria-label="Portfolio value trend"');
  });
});

// 2 ─ Real series: the area+line SVG stretches to fill the width.
describe("HcValueChart — with a real series", () => {
  it("draws the area + curve and fills the full width (preserveAspectRatio=none)", () => {
    const html = renderToStaticMarkup(
      <HcValueChart points={SERIES} aria-label="Portfolio value trend" />,
    );
    expect(html).not.toContain('data-hc-empty="true"');
    expect(html).toContain("<svg");
    expect(html).toContain('width="100%"');
    // The plot intentionally STRETCHES horizontally to use all the card width.
    expect(html).toContain('preserveAspectRatio="none"');
    // The stroke must stay crisp under the stretch.
    expect(html).toContain('vector-effect="non-scaling-stroke"');
    expect(html).toContain("url(#hc-value-fill)");
    expect(html).toContain("var(--ct-chart-curve-color)");
    // Two <path> elements: area + line.
    expect(count(html, "<path")).toBe(2);
  });

  it("baselines the y-axis at 0 so the curve reads as a climb from zero", () => {
    const html = renderToStaticMarkup(
      <HcValueChart points={SERIES} aria-label="Portfolio value trend" />,
    );
    expect(html).toContain("$0");
    expect(count(html, 'data-hc-grid="y"')).toBe(3);
  });

  it("renders one crisp dot per data point (one-per-day markers)", () => {
    const html = renderToStaticMarkup(
      <HcValueChart points={SERIES} aria-label="Portfolio value trend" />,
    );
    // One dot per point in SERIES.
    expect(count(html, 'data-hc-dot="true"')).toBe(SERIES.length);
  });

  it("renders the endpoint dot + label + latest value callout", () => {
    const html = renderToStaticMarkup(
      <HcValueChart points={SERIES} aria-label="Portfolio value trend" />,
    );
    expect(html).toContain('data-hc-endpoint-dot="true"');
    expect(html).toContain('data-hc-endpoint="true"');
    expect(html).toContain("Latest");
    expect(html).toContain("$11.0K");
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

  it("can suppress the per-day dots", () => {
    const html = renderToStaticMarkup(
      <HcValueChart points={SERIES} showPointDots={false} aria-label="Portfolio value trend" />,
    );
    expect(count(html, 'data-hc-dot="true"')).toBe(0);
    // The endpoint dot is independent of the per-day dots and stays.
    expect(html).toContain('data-hc-endpoint-dot="true"');
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
    expect(html).toMatch(/\$\d[\d.]*M|\$\d[\d.]*K/);
  });
});
