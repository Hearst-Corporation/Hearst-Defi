import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ValueChart } from "@/components/portfolio/value-chart";

const EMPTY_POSITIONS: [] = [];

describe("ValueChart Cleanup — Header only", () => {
  it("renders the Portfolio Value title", () => {
    const html = renderToStaticMarkup(
      <ValueChart
        positions={EMPTY_POSITIONS}
        totalValueUsdc={0}
        source="live"
        embedded
      />,
    );

    expect(html).toContain("Portfolio Value");
  });

  it("renders the balance when not empty", () => {
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

    expect(html).toContain("260,000");
    expect(html).toContain("USDC");
  });

  it("renders the SVG chart when data is present", () => {
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
        valueChartTransactions={[
          { type: "deposit", amountUsdc: 250_000, occurredAt: new Date("2026-01-01") }
        ]}
      />,
    );

    expect(html).toContain("<svg");
    expect(html).toContain("<path"); // Area or Line
  });
});
