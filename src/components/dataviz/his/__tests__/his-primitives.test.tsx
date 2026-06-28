/**
 * Tests for the Hearst Instrument System (HIS) P0 visual primitives.
 *
 * Rendered with `react-dom/server` renderToStaticMarkup — consistent with the
 * project's `environment: "node"` vitest config (no jsdom, no Testing Library).
 * Assertions run against the produced SVG/HTML string.
 */

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { extent, project, type PlotBox } from "../geometry";
import { HcSourceBadge } from "../HcSourceBadge";
import { HcChartCard } from "../HcChartCard";
import { HcMetricSparkline } from "../HcMetricSparkline";
import { HcFanChart, type HcFanBand } from "../HcFanChart";
import { HcWaterfall, type HcWaterfallStep } from "../HcWaterfall";
import { HcCompositionRing } from "../HcCompositionRing";
import { HcAssumptionLedger } from "../HcAssumptionLedger";
import type { HcAssumption } from "../types";

const count = (haystack: string, needle: string): number =>
  haystack.split(needle).length - 1;

// 1 ─ geometry.extent safe on empty + zero-width widening
describe("geometry.extent", () => {
  it("returns [0, 1] on an empty array", () => {
    expect(extent([])).toEqual([0, 1]);
  });
  it("widens a zero-width domain so scaling never divides by zero", () => {
    expect(extent([5, 5, 5])).toEqual([5, 6]);
  });
  it("returns true min/max otherwise", () => {
    expect(extent([3, 9, -1, 4])).toEqual([-1, 9]);
  });
});

// 2 ─ geometry.project respects box + domain (with Y flipped)
describe("geometry.project", () => {
  const box: PlotBox = { width: 100, height: 100, padX: 10, padY: 10 };
  it("maps the domain minimum to the bottom-left of the inner box", () => {
    const p = project({ x: 0, y: 0 }, [0, 10], [0, 100], box);
    expect(p.x).toBeCloseTo(10);
    expect(p.y).toBeCloseTo(90);
  });
  it("maps the domain maximum to the top-right of the inner box", () => {
    const p = project({ x: 10, y: 100 }, [0, 10], [0, 100], box);
    expect(p.x).toBeCloseTo(90);
    expect(p.y).toBeCloseTo(10);
  });
});

// 3 ─ HcSourceBadge renders verified for live
describe("HcSourceBadge — verified", () => {
  it('status="live" renders verified tone with the accent dot', () => {
    const html = renderToStaticMarkup(<HcSourceBadge status="live" />);
    expect(html).toContain('data-tone="verified"');
    expect(html).toContain("var(--ct-accent)");
    expect(html).toContain("Live");
    expect(html).toContain("Source: Live");
  });
});

// 4 ─ HcSourceBadge renders non-production for mock/demo/unaudited
describe("HcSourceBadge — non-production", () => {
  it.each(["mock", "demo", "unaudited"] as const)(
    'status="%s" renders the warning (non-production) tone, never verified',
    (status) => {
      const html = renderToStaticMarkup(<HcSourceBadge status={status} />);
      expect(html).toContain('data-tone="nonprod"');
      expect(html).toContain("var(--ct-status-warning)");
      expect(html).not.toContain('data-tone="verified"');
    },
  );
});

// 5 ─ HcChartCard empty state shows no fake chart
describe("HcChartCard — empty state", () => {
  it("does not render the chart children and shows an honest empty surface", () => {
    const html = renderToStaticMarkup(
      <HcChartCard title="NAV" state="empty" source="live" aria-label="nav card">
        <polyline data-testid="real-chart" points="0,0 1,1" />
      </HcChartCard>,
    );
    expect(html).toContain('data-hc-empty="true"');
    expect(html).not.toContain("real-chart");
    expect(html).not.toContain("<polyline");
  });
});

// 6 ─ HcChartCard fallback state shows the hatch overlay over the children
describe("HcChartCard — fallback state", () => {
  it("renders the diagonal hatch overlay so fallback data cannot read as live", () => {
    const html = renderToStaticMarkup(
      <HcChartCard title="NAV" state="fallback" source="fallback" aria-label="nav card">
        <polyline data-testid="real-chart" points="0,0 1,1" />
      </HcChartCard>,
    );
    expect(html).toContain('data-hc-fallback-veil="true"');
    expect(html).toContain("url(#hc-hatch)");
    expect(html).toContain("real-chart"); // children still present, just veiled
  });
});

// 7 ─ HcMetricSparkline renders a polyline for >=2 values
describe("HcMetricSparkline — with values", () => {
  it("renders a polyline and a final dot", () => {
    const html = renderToStaticMarkup(
      <HcMetricSparkline values={[1, 4, 2, 8, 5]} aria-label="nav spark" />,
    );
    expect(html).toContain("<polyline");
    expect(html).toContain("<circle");
  });
});

// 8 ─ HcMetricSparkline renders an empty mini surface for <2 values
describe("HcMetricSparkline — empty", () => {
  it("renders an empty mini surface (no polyline) when fewer than 2 points", () => {
    const html = renderToStaticMarkup(
      <HcMetricSparkline values={[7]} aria-label="nav spark" />,
    );
    expect(html).toContain('data-hc-empty="true"');
    expect(html).not.toContain("<polyline");
  });
});

// 9 ─ HcFanChart renders p5/p50/p95 + a "not guaranteed" note
describe("HcFanChart", () => {
  const bands: HcFanBand[] = [
    { m: 0, p5: 6, p50: 9, p95: 12 },
    { m: 6, p5: 7, p50: 11, p95: 15 },
    { m: 12, p5: 8, p50: 12, p95: 18 },
  ];
  it("renders the p5/p50/p95 lines, the band, and a not-guaranteed note", () => {
    const html = renderToStaticMarkup(
      <HcFanChart bands={bands} seedLabel="preview-hyv-v2" aria-label="apy fan" />,
    );
    expect(html).toContain('data-hc-line="p5"');
    expect(html).toContain('data-hc-line="p50"');
    expect(html).toContain('data-hc-line="p95"');
    expect(html).toContain('data-hc-band="p5-p95"');
    expect(html).toContain("not guaranteed");
    expect(html).toContain("seed: preview-hyv-v2");
    // p50 uses the accent curve color; the band never does.
    expect(html).toContain("var(--ct-chart-curve-color)");
    expect(html).toContain("var(--ct-chart-band-fill)");
  });
  it("never emits forbidden 'guarantee' wording", () => {
    const html = renderToStaticMarkup(<HcFanChart bands={bands} aria-label="apy fan" />);
    expect(html.toLowerCase()).not.toContain("guaranteed return");
    expect(html).toContain("not guaranteed");
  });
});

// 10 ─ HcWaterfall renders positive / negative / total steps
describe("HcWaterfall", () => {
  const steps: HcWaterfallStep[] = [
    { label: "Gross", value: 1000, kind: "total" },
    { label: "Mgmt fee", value: -120, kind: "delta" },
    { label: "Perf fee", value: -80, kind: "delta" },
    { label: "Net", value: 800, kind: "total" },
  ];
  it("colors positive=success, negative=danger, total=neutral", () => {
    const html = renderToStaticMarkup(<HcWaterfall steps={steps} aria-label="fee bridge" />);
    expect(html).toContain("var(--ct-status-danger)"); // negative deltas
    expect(html).toContain("var(--ct-chart-neutral)"); // total anchors
    expect(count(html, 'data-hc-step="total"')).toBe(2);
    expect(count(html, 'data-hc-step="delta"')).toBe(2);
  });
  it("renders a positive delta in success tone when present", () => {
    const withGain: HcWaterfallStep[] = [
      { label: "Base", value: 100, kind: "total" },
      { label: "Yield", value: 40, kind: "delta" },
    ];
    const html = renderToStaticMarkup(<HcWaterfall steps={withGain} aria-label="pnl" />);
    expect(html).toContain("var(--ct-status-success)");
    expect(html).toContain("+40");
  });
});

// 11 ─ HcCompositionRing uses multiple <circle> segments
describe("HcCompositionRing", () => {
  it("renders a track plus one rotated circle per segment", () => {
    const html = renderToStaticMarkup(
      <HcCompositionRing
        segments={[
          { label: "Mining", value: 70 },
          { label: "USDC", value: 30 },
        ]}
        aria-label="allocation"
      />,
    );
    // 1 track + 2 segment circles = 3
    expect(count(html, "<circle")).toBeGreaterThanOrEqual(3);
    expect(count(html, 'data-hc-ring="segment"')).toBe(2);
    expect(html).toContain('data-hc-ring="track"');
    expect(html).toContain("70%");
    expect(html).toContain("30%");
  });
  it("renders only the track (no segments) when the total is zero", () => {
    const html = renderToStaticMarkup(
      <HcCompositionRing segments={[{ label: "Empty", value: 0 }]} aria-label="empty alloc" />,
    );
    expect(html).toContain('data-hc-ring="track"');
    expect(count(html, 'data-hc-ring="segment"')).toBe(0);
  });
});

// 12 ─ HcAssumptionLedger shows a configured badge and never renders live
describe("HcAssumptionLedger", () => {
  const assumptions: HcAssumption[] = [
    { key: "Energy cost", value: "$0.05 / kWh", source: "configured", displayRule: "configured baseline, not audited" },
    { key: "Stable APY", value: "4.5%", source: "estimated" },
  ];
  it("renders the configured status header and a Configured badge, never Live", () => {
    const html = renderToStaticMarkup(
      <HcAssumptionLedger
        assumptions={assumptions}
        configStatus="CONFIGURED — code defaults, not audited"
        aria-label="assumptions"
      />,
    );
    expect(html).toContain('data-hc-config-status="true"');
    expect(html).toContain("CONFIGURED");
    expect(html).toContain("Configured");
    expect(html).toContain("$0.05 / kWh");
    expect(html).toContain("configured baseline, not audited");
    // Honesty invariant: no configured assumption is dressed up as live.
    expect(html).not.toContain(">Live<");
    expect(html).not.toContain("Source: Live");
  });
});
