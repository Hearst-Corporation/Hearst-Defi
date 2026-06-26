import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ValueChart } from "@/components/portfolio/value-chart";

const EMPTY_POSITIONS: [] = [];

describe("ValueChart", () => {
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
    expect(html).not.toContain("pf-vc-apy");
    expect(html).toContain("24H");
    expect(html).toContain("ALL");
  });

  it("renders provenance and series note without repeating hero chips", () => {
    const html = renderToStaticMarkup(
      <ValueChart
        positions={[
          {
            id: "p1",
            vaultName: "Hearst Yield",
            principalUsdc: 11,
            accruedYieldUsdc: 0,
            distributedUsdc: 0,
            valueUsdc: 11,
            status: "active",
            apyLow: 8,
            apyHigh: 15,
            subscribedAt: new Date("2026-01-01T00:00:00.000Z"),
          },
        ]}
        totalValueUsdc={11}
        source="live"
        embedded
        updatedAt={new Date("2026-06-25T12:00:00Z")}
        valueChartTransactions={[
          { type: "deposit", amountUsdc: 11, occurredAt: new Date("2026-06-01") },
        ]}
      />,
    );

    expect(html).toContain("Estimated NAV");
    expect(html).toContain("Ledger-based");
    expect(html).not.toContain("Target APY");
    expect(html).not.toContain("Positions");
  });

  it("renders the SVG chart when ledger data is present", () => {
    const html = renderToStaticMarkup(
      <ValueChart
        positions={[
          {
            id: "p1",
            vaultName: "Hearst Yield",
            principalUsdc: 11,
            accruedYieldUsdc: 0,
            distributedUsdc: 0,
            valueUsdc: 11,
            status: "active",
            apyLow: 8,
            apyHigh: 15,
            subscribedAt: new Date("2026-01-01T00:00:00.000Z"),
          },
        ]}
        totalValueUsdc={11}
        source="live"
        embedded
        updatedAt={new Date("2026-06-25T12:00:00Z")}
        valueChartTransactions={[
          { type: "deposit", amountUsdc: 11, occurredAt: new Date("2026-06-01") },
        ]}
      />,
    );

    expect(html).toContain("<svg");
    expect(html).toContain("Ledger-based");
  });

  it("renders hourly mode note when snapshots supplied", () => {
    const now = new Date("2026-06-25T12:00:00Z");
    const hourly = Array.from({ length: 12 }, (_, i) => ({
      at: new Date(now.getTime() - (11 - i) * 60 * 60 * 1000),
      valueUsdc: 11 + i * 0.01,
    }));

    const html = renderToStaticMarkup(
      <ValueChart
        positions={[
          {
            id: "p1",
            vaultName: "Hearst Yield",
            principalUsdc: 11,
            accruedYieldUsdc: 0.12,
            distributedUsdc: 0,
            valueUsdc: 11.12,
            status: "active",
            apyLow: 8,
            apyHigh: 15,
            subscribedAt: new Date("2026-06-01T00:00:00.000Z"),
          },
        ]}
        totalValueUsdc={11.12}
        source="live"
        embedded
        updatedAt={now}
        hourlySnapshots={hourly}
      />,
    );

    expect(html).toContain("Hourly NAV prints");
    expect(html).toContain("<path");
    expect(html).not.toContain("Ledger-based");
  });

  it("passes hourlySnapshots prop into series builder wiring", () => {
    const now = new Date("2026-06-25T12:00:00Z");
    const hourly = [
      { at: new Date(now.getTime() - 2 * 60 * 60 * 1000), valueUsdc: 11 },
      { at: new Date(now.getTime() - 1 * 60 * 60 * 1000), valueUsdc: 11.01 },
    ];

    const html = renderToStaticMarkup(
      <ValueChart
        positions={[
          {
            id: "p1",
            vaultName: "Hearst Yield",
            principalUsdc: 11,
            accruedYieldUsdc: 0,
            distributedUsdc: 0,
            valueUsdc: 11,
            status: "active",
            apyLow: 8,
            apyHigh: 15,
            subscribedAt: new Date("2026-06-01T00:00:00.000Z"),
          },
        ]}
        totalValueUsdc={11}
        source="live"
        embedded
        updatedAt={now}
        hourlySnapshots={hourly}
        valueChartTransactions={[
          { type: "deposit", amountUsdc: 11, occurredAt: new Date("2026-06-01") },
        ]}
      />,
    );

    expect(html).toContain("Hourly NAV prints");
  });
});
