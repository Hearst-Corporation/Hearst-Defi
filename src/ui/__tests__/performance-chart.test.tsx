import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  buildPerformanceModel,
  PerformanceChart,
  type PerformancePoint,
} from "@/ui/chart";

/**
 * PerformanceChart contract.
 *
 * NO DOM HERE, ON PURPOSE: this repo has no jsdom/happy-dom and no
 * @testing-library (Vitest runs `environment: "node"`), and adding a dependency
 * was out of scope for this pass. So the component is asserted through
 * `renderToStaticMarkup`.
 *
 * WHAT THAT COSTS, STATED PLAINLY: Recharts 3 paints its SVG from an effect
 * (server markup stops at the `recharts-responsive-container` wrapper), so
 * `path.recharts-curve` NEVER appears in server output — asserting its absence
 * alone would be a test that cannot fail. Every such assertion below is
 * therefore paired with a structural one on markup this component itself emits
 * (`data-chart-state`, `data-chart-surface`, `data-gradient-id`) plus a
 * positive control proving the "ready" branch really does mount the chart.
 * A real browser assertion on the painted curve belongs in Storybook/Playwright.
 */

const READY_POINTS: PerformancePoint[] = [
  { at: Date.UTC(2026, 6, 20, 0), value: 11 },
  { at: Date.UTC(2026, 6, 20, 1), value: 11.2 },
  { at: Date.UTC(2026, 6, 20, 2), value: 11.05 },
];

const CHART_SURFACE = "data-chart-surface";
const RECHARTS_MOUNTED = "recharts-responsive-container";

function gradientIds(html: string): string[] {
  return [...html.matchAll(/data-gradient-id="([^"]+)"/g)].map((m) => m[1] ?? "");
}

function chartStates(html: string): string[] {
  return [...html.matchAll(/data-chart-state="([^"]+)"/g)].map((m) => m[1] ?? "");
}

describe("PerformanceChart — gradient scoping", () => {
  it("gives two instances on the same page two distinct gradient ids", () => {
    const html = renderToStaticMarkup(
      <div>
        <PerformanceChart
          state={{ kind: "ready", points: READY_POINTS }}
          provenance="attested"
          seriesLabel="Value (USDC)"
          ariaLabel="First series"
        />
        <PerformanceChart
          state={{ kind: "ready", points: READY_POINTS }}
          provenance="estimated"
          seriesLabel="Value (USDC)"
          ariaLabel="Second series"
        />
      </div>,
    );

    const ids = gradientIds(html);
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBeTruthy();
    expect(new Set(ids).size).toBe(2);
    // A static id (the retired `hc-area-fill`) is what made instance B paint
    // with instance A's gradient: SVG resolves url(#id) against the FIRST match.
    expect(html).not.toContain("hc-area-fill");
  });

  it("emits an id that is a valid SVG fragment reference", () => {
    const html = renderToStaticMarkup(
      <PerformanceChart
        state={{ kind: "ready", points: READY_POINTS }}
        provenance="attested"
        seriesLabel="Value (USDC)"
        ariaLabel="Series"
      />,
    );
    // React's useId output carries separators that are illegal in a bare
    // fragment reference — the component sanitises them.
    expect(gradientIds(html)[0]).toMatch(/^perf-area-[A-Za-z0-9]+$/);
  });
});

describe("PerformanceChart — empty is not unavailable", () => {
  it("mounts the chart surface for a real series (positive control)", () => {
    const html = renderToStaticMarkup(
      <PerformanceChart
        state={{ kind: "ready", points: READY_POINTS }}
        provenance="attested"
        seriesLabel="Value (USDC)"
        ariaLabel="Series"
      />,
    );
    expect(chartStates(html)).toEqual(["ready"]);
    expect(html).toContain(CHART_SURFACE);
    expect(html).toContain(RECHARTS_MOUNTED);
  });

  it("renders NO curve and states the reason when the source is unavailable", () => {
    const html = renderToStaticMarkup(
      <PerformanceChart
        state={{ kind: "unavailable", reason: "rpc_error on the value feed" }}
        provenance="stale"
        seriesLabel="Value (USDC)"
        ariaLabel="Series"
      />,
    );
    expect(chartStates(html)).toEqual(["unavailable"]);
    // No curve — and, meaningfully, no chart mounted at all.
    expect(html).not.toContain("recharts-curve");
    expect(html).not.toContain(CHART_SURFACE);
    expect(html).not.toContain(RECHARTS_MOUNTED);
    // The source's own words survive to the reader.
    expect(html).toContain("rpc_error on the value feed");
  });

  it("says something different for empty than for unavailable", () => {
    const emptyHtml = renderToStaticMarkup(
      <PerformanceChart
        state={{ kind: "empty" }}
        provenance="stale"
        seriesLabel="Value (USDC)"
        ariaLabel="Series"
      />,
    );
    const unavailableHtml = renderToStaticMarkup(
      <PerformanceChart
        state={{ kind: "unavailable", reason: "rpc_error on the value feed" }}
        provenance="stale"
        seriesLabel="Value (USDC)"
        ariaLabel="Series"
      />,
    );

    expect(chartStates(emptyHtml)).toEqual(["empty"]);
    expect(chartStates(unavailableHtml)).toEqual(["unavailable"]);

    const emptyText = textOf(emptyHtml);
    const unavailableText = textOf(unavailableHtml);
    expect(emptyText).not.toBe(unavailableText);
    // "nothing was recorded" must never be phrased as "the read failed".
    expect(unavailableText).toContain("unavailable");
    expect(emptyText).not.toContain("unavailable");
  });

  it("treats a single point as empty — one point is not a trend", () => {
    const html = renderToStaticMarkup(
      <PerformanceChart
        state={{ kind: "ready", points: [{ at: Date.UTC(2026, 6, 20), value: 11 }] }}
        provenance="attested"
        seriesLabel="Value (USDC)"
        ariaLabel="Series"
      />,
    );
    expect(chartStates(html)).toEqual(["empty"]);
    expect(html).not.toContain(RECHARTS_MOUNTED);
    // And it says WHY, instead of silently drawing a segment out of one dot.
    expect(textOf(html)).toContain("at least two");
  });

  it("renders a loading state that is neither empty nor unavailable", () => {
    const html = renderToStaticMarkup(
      <PerformanceChart
        state={{ kind: "loading" }}
        provenance="stale"
        seriesLabel="Value (USDC)"
        ariaLabel="Series"
      />,
    );
    expect(chartStates(html)).toEqual(["loading"]);
    expect(html).not.toContain(RECHARTS_MOUNTED);
  });
});

describe("PerformanceChart — accessible name", () => {
  it('sets role="img" with the label when one is given', () => {
    const html = renderToStaticMarkup(
      <PerformanceChart
        state={{ kind: "ready", points: READY_POINTS }}
        provenance="attested"
        seriesLabel="Value (USDC)"
        ariaLabel="Position value over time"
      />,
    );
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Position value over time"');
  });

  it('omits role="img" entirely when the label is blank', () => {
    const html = renderToStaticMarkup(
      <PerformanceChart
        state={{ kind: "ready", points: READY_POINTS }}
        provenance="attested"
        seriesLabel="Value (USDC)"
        ariaLabel="   "
      />,
    );
    // An unlabelled role="img" is an a11y failure (axe: "role=img must have an
    // accessible name") — better an anonymous div than a lying landmark.
    expect(html).not.toContain('role="img"');
    expect(html).toContain(CHART_SURFACE);
  });
});

describe("buildPerformanceModel", () => {
  it("returns null below two usable points", () => {
    expect(buildPerformanceModel([])).toBeNull();
    expect(buildPerformanceModel([{ at: 0, value: 1 }])).toBeNull();
    // An unparseable date is dropped, not coerced to epoch 0.
    expect(
      buildPerformanceModel([
        { at: "not-a-date", value: 1 },
        { at: 1_000, value: 2 },
      ]),
    ).toBeNull();
  });

  it("sorts by time and frames the x domain on the real bounds", () => {
    const model = buildPerformanceModel([
      { at: 3_000, value: 3 },
      { at: 1_000, value: 1 },
      { at: 2_000, value: 2 },
    ]);
    expect(model?.rows.map((r) => r.t)).toEqual([1_000, 2_000, 3_000]);
    expect(model?.xDomain).toEqual([1_000, 3_000]);
  });

  it("never baselines the y domain at 0", () => {
    const model = buildPerformanceModel([
      { at: 1_000, value: 11 },
      { at: 2_000, value: 11.4 },
    ]);
    expect(model?.yDomain[0]).toBeGreaterThan(0);
    expect(model?.yDomain[0]).toBeLessThan(11);
    expect(model?.yDomain[1]).toBeGreaterThan(11.4);
  });

  it("gives a flat series a window instead of a zero-height domain", () => {
    const model = buildPerformanceModel([
      { at: 1_000, value: 11 },
      { at: 2_000, value: 11 },
    ]);
    expect(model?.yDomain[1]).toBeGreaterThan(model?.yDomain[0] ?? 0);
  });
});

/** Text content of a fragment of markup, tags stripped. */
function textOf(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
