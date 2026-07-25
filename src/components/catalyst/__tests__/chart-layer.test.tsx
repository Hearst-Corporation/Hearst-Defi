/**
 * Canonical chart-layer contract (HC-CHART-001).
 *
 * Re-expresses the honesty + framing invariants that the retired HIS unit tests
 * (his-primitives.test / HcValueChart.test) guarded, now against the Recharts
 * Catalyst layer. Vitest env is `node`; components are rendered with
 * `renderToStaticMarkup` and asserted on the chrome they own (empty states,
 * provenance tones, framing maths) — never on Recharts marks (which need layout).
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";

import { extent, niceCeil, valueYDomain } from "@/components/catalyst/chart-scale";
import { ChartCard } from "@/components/catalyst/chart-card";
import { ChartDonut } from "@/components/catalyst/chart-donut";
import { ChartProportionBar } from "@/components/catalyst/chart-proportion-bar";
import { ChartSourceBadge } from "@/components/catalyst/chart-source-badge";
import { ChartValue } from "@/components/catalyst/chart-value";

describe("chart-scale framing", () => {
  it("valueYDomain frames on the data range, never baselined at 0 (anti-flat-slab)", () => {
    const [lo, hi] = valueYDomain([500_000, 512_000, 531_000]);
    expect(lo).toBeGreaterThan(0); // NOT zero-baselined
    expect(lo).toBeLessThan(500_000);
    expect(hi).toBeGreaterThan(531_000);
  });

  it("valueYDomain returns [0,1] for empty and pads a flat series", () => {
    expect(valueYDomain([])).toEqual([0, 1]);
    const [lo, hi] = valueYDomain([100, 100]);
    expect(lo).toBeLessThan(100);
    expect(hi).toBeGreaterThan(100);
  });

  it("niceCeil rounds up to a nice axis max; non-positive -> 1", () => {
    expect(niceCeil(0)).toBe(1);
    expect(niceCeil(-5)).toBe(1);
    expect(niceCeil(42)).toBe(50);
    expect(niceCeil(7)).toBe(8);
  });

  it("extent widens a zero-width domain and defaults empty", () => {
    expect(extent([])).toEqual([0, 1]);
    expect(extent([5, 5])).toEqual([5, 6]);
  });
});

describe("honest empty states — no fabricated chart when data is absent", () => {
  it("ChartValue with < 2 points renders an honest empty surface, no chart", () => {
    const html = renderToStaticMarkup(
      <ChartValue points={[{ at: 0, value: 1 }]} aria-label="nav" emptyMessage="No history yet" />,
    );
    expect(html).toContain('data-chart-empty="true"');
    expect(html).toContain("No history yet");
    expect(html.toLowerCase()).not.toContain("recharts"); // no chart at all
  });

  it("ChartProportionBar with an all-zero total renders a neutral track, not a fabricated fill", () => {
    const html = renderToStaticMarkup(
      <ChartProportionBar
        segments={[
          { label: "A", value: 0 },
          { label: "B", value: 0 },
        ]}
        aria-label="allocation"
      />,
    );
    expect(html).toContain('data-chart-empty="true"');
  });
});

describe("ChartCard honest states", () => {
  const child = <div>PLOTBODY</div>;

  it("empty / error / unavailable render a message, not the chart child", () => {
    const empty = renderToStaticMarkup(
      <ChartCard title="T" state="empty" aria-label="c">
        {child}
      </ChartCard>,
    );
    expect(empty).toContain("No data yet");
    expect(empty).not.toContain("PLOTBODY");

    const err = renderToStaticMarkup(
      <ChartCard title="T" state="error" aria-label="c">
        {child}
      </ChartCard>,
    );
    expect(err).toContain("reach the data");
    expect(err).not.toContain("PLOTBODY");
  });

  it("fallback veils the child with a hatch so mock data cannot read as live", () => {
    const html = renderToStaticMarkup(
      <ChartCard title="T" state="fallback" aria-label="c">
        {child}
      </ChartCard>,
    );
    expect(html).toContain('data-chart-fallback-veil="true"');
    expect(html).toContain("PLOTBODY"); // child still rendered, under the veil
  });

  it("ready renders the chart child", () => {
    const html = renderToStaticMarkup(
      <ChartCard title="T" state="ready" aria-label="c">
        {child}
      </ChartCard>,
    );
    expect(html).toContain("PLOTBODY");
  });
});

describe("ChartSourceBadge honesty tri-tone", () => {
  it("verified sources are accent-toned; non-production sources warning-toned; rest neutral", () => {
    expect(renderToStaticMarkup(<ChartSourceBadge status="live" />)).toContain('data-tone="verified"');
    expect(renderToStaticMarkup(<ChartSourceBadge status="mock" />)).toContain('data-tone="nonprod"');
    expect(renderToStaticMarkup(<ChartSourceBadge status="estimated" />)).toContain('data-tone="neutral"');
  });

  it("labels the status", () => {
    expect(renderToStaticMarkup(<ChartSourceBadge status="attested" />)).toContain("Attested");
  });
});

describe("ChartDonut", () => {
  it("renders its aria-label and one legend row per segment", () => {
    const html = renderToStaticMarkup(
      <ChartDonut
        segments={[
          { label: "Mining", value: 40 },
          { label: "BTC", value: 27 },
          { label: "USDC", value: 33 },
        ]}
        palette="categorical"
        aria-label="allocation donut"
      />,
    );
    expect(html).toContain("allocation donut");
    expect(html).toContain("Mining");
    expect(html).toContain("BTC");
    expect(html).toContain("USDC");
  });
});
