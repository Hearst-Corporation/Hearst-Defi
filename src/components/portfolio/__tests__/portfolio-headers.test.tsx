import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PortfolioGreeting } from "@/components/portfolio/portfolio-greeting";
import { PositionHeader } from "@/components/portfolio/position-header";
import type { PositionDetail } from "@/lib/data/portfolio";

const position: PositionDetail = {
  id: "pos_1234567890abcdef",
  vaultName: "Hearst Yield Vault",
  vaultTicker: "HYV",
  softLockupDays: 60,
  status: "active",
  principalUsdc: 250000,
  accruedYieldUsdc: 12500,
  distributedUsdc: 0,
  realizedApyLow: 9.4,
  realizedApyHigh: 12.8,
  subscribedAt: new Date("2026-01-01T00:00:00.000Z"),
  maturedAt: null,
  txHashOpen: "0xabc",
  transactions: [],
  source: "live",
};

describe("portfolio headers", () => {
  it("renders the portfolio greeting with inline ticker", () => {
    const html = renderToStaticMarkup(
      <PortfolioGreeting
        name="Alice"
        ticker={{
          totalValueUsdc: 542_000,
          deployedUsdc: 500_000,
          totalYieldYtdUsdc: 12_000,
          nextDistributionAt: new Date("2026-07-01T00:00:00Z"),
          blendedLow: 9.4,
          blendedHigh: 12.8,
          hasPositions: true,
        }}
      />,
    );

    expect(html).toContain("pf-greeting");
    expect(html).toContain("pf-ticker-inline");
    expect(html).toContain("Welcome back,");
    expect(html).toContain("9.4 \u2013 12.8%");
    expect(html).toContain("+8.4% accrued"); // yield delta indicator
    expect(html).not.toContain("product-page-header");
  });

  it("renders the position header on its own chrome", () => {
    const html = renderToStaticMarkup(<PositionHeader position={position} />);

    expect(html).toContain("position-detail-header");
    expect(html).toContain("← Portfolio");
    expect(html).toContain("Hearst Yield Vault");
    expect(html).toContain("Total value");
    expect(html).toContain("Active");
    expect(html).not.toContain("product-page-header");
  });

  it("zero-state ticker uses em-dash placeholders, not $0", () => {
    const html = renderToStaticMarkup(
      <PortfolioGreeting
        name="Alice"
        ticker={{
          totalValueUsdc: 0,
          deployedUsdc: 0,
          totalYieldYtdUsdc: 0,
          nextDistributionAt: new Date("2026-07-01T00:00:00Z"),
          blendedLow: 0,
          blendedHigh: 0,
          hasPositions: false,
        }}
      />,
    );

    expect(html).toContain("YTD yield");
    expect(html).not.toContain("12M yield");
    expect(html).not.toContain("$0");
    expect(html).not.toContain("accrued"); // no delta indicator in zero-state
  });

  it("shows projected next payout when nextPayoutUsdc is provided", () => {
    const html = renderToStaticMarkup(
      <PortfolioGreeting
        name="Alice"
        ticker={{
          totalValueUsdc: 500_000,
          deployedUsdc: 480_000,
          totalYieldYtdUsdc: 12_000,
          nextDistributionAt: new Date("2026-07-01T00:00:00Z"),
          nextPayoutUsdc: 4_200,
          blendedLow: 9.4,
          blendedHigh: 12.8,
          hasPositions: true,
        }}
      />,
    );

    expect(html).toContain("$4.2K");
    expect(html).toContain("+4.2% accrued"); // (500k-480k)/480k = 4.2%
  });
});
