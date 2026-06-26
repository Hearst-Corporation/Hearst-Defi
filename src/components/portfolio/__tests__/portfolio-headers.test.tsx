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
  it("renders the portfolio greeting", () => {
    const html = renderToStaticMarkup(<PortfolioGreeting />);

    expect(html).toContain("pf-greeting");
    expect(html).toContain("PORTFOLIO");
    expect(html).toContain("Institutional cockpit");
    expect(html).toContain("Verified data feeds");
    expect(html).not.toContain("Welcome back");
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
});
