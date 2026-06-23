import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ValueChart } from "@/components/portfolio/value-chart";

const EMPTY_POSITIONS: [] = [];

describe("ValueChart zero-state — flat skeleton baseline, unlabelled", () => {
  it("renders the chart SVG frame even with no positions (skeleton)", () => {
    const html = renderToStaticMarkup(
      <ValueChart
        positions={EMPTY_POSITIONS}
        totalValueUsdc={0}
        source="live"
        embedded
      />,
    );

    expect(html).toContain('viewBox="0 0 800 320"');
    expect(html).toContain("pf-vc-line--skeleton");
  });

  it("shows NO visible label/badge/disclaimer in zero-state", () => {
    const html = renderToStaticMarkup(
      <ValueChart
        positions={EMPTY_POSITIONS}
        totalValueUsdc={0}
        source="live"
        embedded
      />,
    );

    expect(html).not.toContain("Estimated");
    expect(html).not.toContain("illustrative");
    // No watermark / disclaimer line in skeleton mode
    expect(html).not.toContain("ct-chart-disclaimer-text");
    expect(html).not.toContain("pf-value-chart__disclaimer");
  });
});

describe("ValueChart live state (real position)", () => {
  it("renders the real curve, the value KPI and the live disclaimer", () => {
    const html = renderToStaticMarkup(
      <ValueChart
        positions={[
          {
            id: "p1",
            vaultName: "Hearst Yield",
            principalUsdc: 250_000,
            accruedYieldUsdc: 10_000,
            distributedUsdc: 0,
            valueUsdc: 260_000,
            status: "active",
            apyLow: 9.4,
            apyHigh: 12.8,
            subscribedAt: new Date("2026-01-01T00:00:00.000Z"),
          },
        ]}
        totalValueUsdc={260_000}
        source="live"
        embedded
      />,
    );

    expect(html).toContain('viewBox="0 0 800 320"');
    expect(html).not.toContain("pf-vc-line--skeleton");
    // Live disclaimer underlay present in non-skeleton mode
    expect(html).toContain("ct-chart-disclaimer-text");
  });

  it("exposes keyboard inspection affordance on the interactive chart", () => {
    const html = renderToStaticMarkup(
      <ValueChart
        positions={[
          {
            id: "p1",
            vaultName: "Hearst Yield",
            principalUsdc: 250_000,
            accruedYieldUsdc: 10_000,
            distributedUsdc: 0,
            valueUsdc: 260_000,
            status: "active",
            apyLow: 9.4,
            apyHigh: 12.8,
            subscribedAt: new Date("2026-01-01T00:00:00.000Z"),
          },
        ]}
        totalValueUsdc={260_000}
        source="live"
        embedded
      />,
    );

    expect(html).toContain('tabindex="0"');
    expect(html).toContain("Use left and right arrow keys to inspect each point.");
  });
});
