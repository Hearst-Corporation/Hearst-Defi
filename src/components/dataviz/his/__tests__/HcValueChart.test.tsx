/**
 * Tests for HcValueChart — the hero NAV / value-over-time instrument on
 * /portfolio, recoded on pure SVG (HIS geometry, no charting library). Because
 * it now renders identically on the server, we assert against the produced SVG
 * markup via `renderToStaticMarkup` (vitest `environment: "node"`, no jsdom).
 *
 * Contracts:
 *   - the y-axis DOMAIN (`valueYDomain`) frames on the data range with padding,
 *     never baselined at 0 for a real series, 0-based fallback for flat/empty;
 *   - a real series draws ONE line + one dot per sample + a faded area + axes;
 *   - <2 points → an explicit empty surface, no fabricated chart;
 *   - token-only (no raw hex); no NaN in the geometry.
 */

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import {
  HcValueChart,
  valueYDomain,
  type HcValuePoint,
} from "../HcValueChart";

const count = (haystack: string, needle: string): number =>
  haystack.split(needle).length - 1;

// A tight, high-base band — the exact shape that a 0-baseline would flatten.
const TIGHT_BAND = [500_000, 503_100, 519_600, 531_400];

// A real, evenly-sampled monthly series.
const SERIES: HcValuePoint[] = [
  { at: "2025-08-15T00:00:00Z", value: 1_000_000 },
  { at: "2025-09-15T00:00:00Z", value: 2_100_000 },
  { at: "2025-10-15T00:00:00Z", value: 3_400_000 },
  { at: "2025-11-15T00:00:00Z", value: 4_600_000 },
  { at: "2025-12-15T00:00:00Z", value: 5_555_555 },
];

// ── 1 ─ y-axis domain: framed on the data, not baselined at 0 ──────────────────
describe("valueYDomain — frames on the data range, not 0", () => {
  it("does NOT baseline a tight high-base band at 0", () => {
    const [min, max] = valueYDomain(TIGHT_BAND);
    // The floor sits just below the data min (padded), far above 0 — this is
    // what restores the curve's amplitude instead of a full slab.
    expect(min).toBeGreaterThan(490_000);
    expect(min).toBeLessThan(500_000);
    expect(max).toBeGreaterThan(531_400);
  });

  it("pads the domain by ~12% of the span on each side", () => {
    const [min, max] = valueYDomain([100, 200]);
    // span 100 → pad 12 → [88, 212]
    expect(min).toBeCloseTo(88, 5);
    expect(max).toBeCloseTo(212, 5);
  });

  it("never returns a floor below 0", () => {
    const [min] = valueYDomain([5, 100]);
    // span 95 → pad 11.4 → floor would be -6.4, clamped to 0.
    expect(min).toBe(0);
  });

  it("falls back to a padded domain for a flat series (span 0)", () => {
    const [min, max] = valueYDomain([500, 500, 500]);
    expect(min).toBeGreaterThanOrEqual(0);
    expect(max).toBeGreaterThan(500); // padded above so it isn't zero-height
  });

  it("is finite-safe for empty / non-finite input", () => {
    expect(valueYDomain([])).toEqual([0, 1]);
    const [dmin, dmax] = valueYDomain([Number.NaN, 400, Number.POSITIVE_INFINITY, 600]);
    expect(Number.isFinite(dmin)).toBe(true);
    expect(Number.isFinite(dmax)).toBe(true);
    expect(dmax).toBeGreaterThan(600);
  });
});

// ── 2 ─ real series: one line, one dot per sample, faded area, axes ────────────
describe("HcValueChart — with a real series", () => {
  it("draws an SVG with one line, one dot per sample, and a faded area", () => {
    const html = renderToStaticMarkup(
      <HcValueChart points={SERIES} aria-label="Portfolio value trend" />,
    );
    expect(html).not.toContain('data-hc-empty="true"');
    expect(html).toContain("<svg");
    // Exactly one line (polyline) …
    expect(count(html, "<polyline")).toBe(1);
    // … one dot per data point …
    expect(count(html, 'data-hc-dot="true"')).toBe(SERIES.length);
    // … and a faded area wash (gradient fill), never a flat slab.
    expect(html).toContain("url(#hc-value-area-fill)");
    expect(html).toContain("stop-opacity");
  });

  it("labels both axes (dated x + value y)", () => {
    const html = renderToStaticMarkup(
      <HcValueChart points={SERIES} aria-label="Portfolio value trend" />,
    );
    expect(count(html, 'data-hc-xlabel="true"')).toBeGreaterThanOrEqual(2);
    // Compact currency y-labels rendered by the default formatter ($K/$M).
    expect(html).toMatch(/\$\d[\d.]*[KM]/);
  });

  it("can suppress the per-sample dots", () => {
    const html = renderToStaticMarkup(
      <HcValueChart points={SERIES} showPointDots={false} aria-label="Portfolio value trend" />,
    );
    expect(count(html, 'data-hc-dot="true"')).toBe(0);
    // The line still draws.
    expect(count(html, "<polyline")).toBe(1);
  });

  it("emits no NaN in the geometry", () => {
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

// ── 3 ─ honest empty state: fewer than 2 points renders no chart ───────────────
describe("HcValueChart — honest empty surface", () => {
  it.each([
    ["empty", [] as HcValuePoint[]],
    ["single point", [{ at: "2026-01-15T00:00:00Z", value: 250_000 }] as HcValuePoint[]],
  ])("renders the explicit empty surface with %s (no fabricated chart)", (_label, points) => {
    const html = renderToStaticMarkup(
      <HcValueChart points={points} aria-label="Portfolio value trend" />,
    );
    expect(html).toContain('data-hc-empty="true"');
    expect(html).toContain("No portfolio history yet");
    expect(html).not.toContain("<polyline");
    expect(html).toContain('aria-label="Portfolio value trend"');
  });
});
