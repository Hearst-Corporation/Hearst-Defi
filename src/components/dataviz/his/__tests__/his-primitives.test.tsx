/**
 * Tests for the Hearst Instrument System (HIS) P0 visual primitives.
 *
 * Rendered with `react-dom/server` renderToStaticMarkup — consistent with the
 * project's `environment: "node"` vitest config (no jsdom, no Testing Library).
 * Assertions run against the produced SVG/HTML string.
 */

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { extent, niceCeil, project, type PlotBox } from "../geometry";
import { HcSourceBadge } from "../HcSourceBadge";
import { HcChartCard } from "../HcChartCard";
import { HcMetricSparkline } from "../HcMetricSparkline";
import { HcFanChart, type HcFanBand } from "../HcFanChart";
import { HcWaterfall, type HcWaterfallStep } from "../HcWaterfall";
import { HcCompositionRing } from "../HcCompositionRing";
import { HcBarChart, type HcBar } from "../HcBarChart";
import { HcStackedBar } from "../HcStackedBar";
import { HcAssumptionLedger } from "../HcAssumptionLedger";
import { HcHeatmap, type HcHeatCell } from "../HcHeatmap";
import { HcPlotEmpty, HC_PLOT_EMPTY_MAX_HEIGHT } from "../HcPlotEmpty";
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
    expect(html).toContain("ct-empty-surface--chart");
    expect(html).toContain("No data yet");
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
  it("renders an honest empty surface with message when fewer than 2 bands", () => {
    const html = renderToStaticMarkup(
      <HcFanChart bands={[]} aria-label="apy fan" emptyMessage="No projection data yet" />,
    );
    expect(html).toContain('data-hc-empty="true"');
    expect(html).toContain("ct-empty-surface--chart");
    expect(html).toContain("No projection data yet");
    expect(html).not.toContain('data-hc-line="p50"');
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
  it("keeps long labels readable with wrapped tspans and intrinsic sizing", () => {
    const longLabel: HcWaterfallStep[] = [
      { label: "Start equity", value: 100, kind: "total" },
      { label: "Borrow interest drag", value: -20, kind: "delta" },
    ];
    const html = renderToStaticMarkup(
      <HcWaterfall steps={longLabel} aria-label="long waterfall" />,
    );
    expect(html).toContain("preserveAspectRatio=\"xMidYMid meet\"");
    expect(html).toContain("min-width:560px");
    expect(html).toContain("<tspan");
  });
  it("renders an honest empty surface when there are no steps", () => {
    const html = renderToStaticMarkup(
      <HcWaterfall steps={[]} aria-label="empty bridge" emptyMessage="No steps yet" />,
    );
    expect(html).toContain('data-hc-empty="true"');
    expect(html).toContain("ct-empty-surface--chart");
    expect(html).toContain("No steps yet");
    expect(html).not.toContain("<rect");
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

// 11c ─ HcCompositionRing custom segment colours + segmentGap + HTML center
describe("HcCompositionRing — custom segments", () => {
  it("uses per-segment colour, segmentGap butt caps, and HTML center overlay", () => {
    const html = renderToStaticMarkup(
      <HcCompositionRing
        segments={[
          { label: "Mining", value: 50, color: "var(--ct-cat-mining)" },
          { label: "BTC", value: 50, color: "var(--ct-cat-btc)" },
        ]}
        segmentGap={6}
        centerHtml
        responsive
        showLegend={false}
        centerLabel="Deployed"
        centerValue="$1.2M"
        size={156}
        thickness={20}
        aria-label="pocket ring"
      />,
    );
    expect(html).toContain("var(--ct-cat-mining)");
    expect(html).toContain("var(--ct-cat-btc)");
    expect(html).toContain('stroke-linecap="butt"');
    expect(html).toContain("ct-metric-value");
    expect(html).toContain("$1.2M");
    expect(html).not.toContain("<text");
  });
});

// 11b ─ HcCompositionRing categorical palette swaps to per-class hues
describe("HcCompositionRing — categorical palette", () => {
  it("colours segments with --ct-cat-* tokens instead of the green ramp", () => {
    const html = renderToStaticMarkup(
      <HcCompositionRing
        palette="categorical"
        segments={[
          { label: "RWA Mining", value: 40 },
          { label: "USDC Yield", value: 30 },
          { label: "BTC Hedged", value: 30 },
        ]}
        aria-label="strategy pockets"
      />,
    );
    expect(html).toContain("var(--ct-cat-mining)");
    expect(html).toContain("var(--ct-cat-usdc)");
    expect(html).toContain("var(--ct-cat-btc)");
  });
});

// 13 ─ geometry.niceCeil picks nice axis ceilings and is safe on bad input
describe("geometry.niceCeil", () => {
  it("rounds up to a nice ceiling", () => {
    expect(niceCeil(2100)).toBe(3000);
    expect(niceCeil(2480)).toBe(3000);
    expect(niceCeil(950)).toBe(1000);
  });
  it("returns 1 for non-positive / non-finite input", () => {
    expect(niceCeil(0)).toBe(1);
    expect(niceCeil(-5)).toBe(1);
    expect(niceCeil(Number.NaN)).toBe(1);
  });
});

// 14 ─ HcBarChart honest empty vs populated
describe("HcBarChart", () => {
  const bars: HcBar[] = [
    { label: "M1", value: 2100 },
    { label: "M2", value: 2200 },
    { label: "M3", value: 2480 },
  ];
  it("renders a bar per datum with an accessible <title> tooltip", () => {
    const html = renderToStaticMarkup(
      <HcBarChart bars={bars} aria-label="yield paid" />,
    );
    expect(count(html, "<rect")).toBe(bars.length);
    expect(html).toContain("<title>M3:");
    expect(html).not.toContain('data-hc-empty="true"');
  });
  it("brightens the last bar when highlightLast is set", () => {
    const html = renderToStaticMarkup(
      <HcBarChart bars={bars} highlightLast aria-label="yield paid" />,
    );
    expect(html).toContain('data-hc-bar="latest"');
    expect(html).toContain("var(--ct-accent-light)");
  });
  it("renders an honest empty state (no bars) when the series is empty or all zero", () => {
    const empty = renderToStaticMarkup(<HcBarChart bars={[]} aria-label="yp" />);
    expect(empty).toContain('data-hc-empty="true"');
    expect(empty).toContain("ct-empty-surface--chart");
    expect(empty).toContain("No data yet");
    expect(empty).not.toContain("<rect");

    const zero = renderToStaticMarkup(
      <HcBarChart bars={[{ label: "M1", value: 0 }]} aria-label="yp" />,
    );
    expect(zero).toContain('data-hc-empty="true"');
  });
});

// 15 ─ HcStackedBar proportion + categorical palette + honest empty
describe("HcStackedBar", () => {
  const segments = [
    { label: "RWA Mining", value: 40 },
    { label: "USDC Yield", value: 30 },
    { label: "BTC Hedged", value: 30 },
  ];
  it("renders one segment span per non-zero value with categorical hues", () => {
    const html = renderToStaticMarkup(
      <HcStackedBar segments={segments} palette="categorical" aria-label="regime" />,
    );
    expect(count(html, 'data-hc-bar="segment"')).toBe(3);
    expect(html).toContain("var(--ct-cat-mining)");
    expect(html).toContain("var(--ct-cat-usdc)");
    expect(html).toContain("40%"); // legend off → title only; width uses %
  });
  it("renders only the neutral track (no fill) when total is zero", () => {
    const html = renderToStaticMarkup(
      <HcStackedBar segments={[{ label: "x", value: 0 }]} aria-label="empty" />,
    );
    expect(count(html, 'data-hc-bar="segment"')).toBe(0);
  });
});

// 16 ─ HcAssumptionLedger shows a configured badge and never renders live
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

// 17 ─ HcHeatmap — luminance grid, honest idle, empty state
describe("HcHeatmap", () => {
  const cells: HcHeatCell[] = [
    { col: 0, row: 0, value: 100, label: "Mon" },
    { col: 1, row: 0, value: 50, label: "Tue" },
    { col: 2, row: 0, value: 0, label: "Wed" }, // idle
  ];

  it("renders active cells on the accent ramp and idle cells on the neutral inset", () => {
    const html = renderToStaticMarkup(
      <HcHeatmap cells={cells} rows={1} cols={3} aria-label="activity" />,
    );
    // full-intensity cell hits series-1 (= accent), a mid cell a fainter stop
    expect(html).toContain("var(--ct-chart-series-1)");
    // idle (value 0) is the neutral surface, NEVER the faintest green
    expect(count(html, 'data-hc-cell="idle"')).toBe(1);
    expect(count(html, 'data-hc-cell="active"')).toBe(2);
    expect(html).toContain("var(--ct-surface-inset)");
  });

  it("carries a native <title> per cell for zero-JS hover", () => {
    const html = renderToStaticMarkup(
      <HcHeatmap cells={cells} rows={1} cols={3} aria-label="activity" />,
    );
    expect(html).toContain("Mon:");
  });

  it("renders an honest empty state when every cell is idle", () => {
    const allIdle: HcHeatCell[] = [
      { col: 0, row: 0, value: 0 },
      { col: 1, row: 0, value: 0 },
    ];
    const html = renderToStaticMarkup(
      <HcHeatmap cells={allIdle} aria-label="empty" emptyMessage="No activity yet" />,
    );
    expect(html).toContain('data-hc-empty="true"');
    expect(html).toContain("No activity yet");
    // no active cells painted
    expect(count(html, 'data-hc-cell="active"')).toBe(0);
  });

  it("uses no hardcoded hex — colours come from tokens only", () => {
    const html = renderToStaticMarkup(
      <HcHeatmap cells={cells} rows={1} cols={3} aria-label="activity" />,
    );
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });
});

// 18 ─ HcPlotEmpty — canonical chart empty wrapper
describe("HcPlotEmpty", () => {
  it("wraps EmptySurface chart variant with data-hc-empty and caps height", () => {
    const html = renderToStaticMarkup(
      <HcPlotEmpty message="Nothing here" height={400} aria-label="plot slot" />,
    );
    expect(html).toContain('data-hc-empty="true"');
    expect(html).toContain("ct-empty-surface--chart");
    expect(html).toContain("Nothing here");
    expect(html).toContain(`height:${HC_PLOT_EMPTY_MAX_HEIGHT}`);
    expect(html).toContain('aria-label="plot slot"');
  });

  it("fills the parent slot when fill is set", () => {
    const html = renderToStaticMarkup(<HcPlotEmpty message="No data yet" fill />);
    expect(html).toContain('data-hc-empty="true"');
    expect(html).toContain("h-full w-full");
    expect(html).not.toContain("height:");
  });
});
