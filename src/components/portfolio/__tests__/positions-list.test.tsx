import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PositionsList } from "@/components/portfolio/positions-list";

const POSITIONS = [
  {
    id: "p1",
    vaultName: "Hearst Yield Vault",
    principalUsdc: 250_000,
    accruedYieldUsdc: 10_000,
    distributedUsdc: 0,
    valueUsdc: 260_000,
    status: "active" as const,
    apyLow: 9.4,
    apyHigh: 12.8,
    subscribedAt: new Date("2026-01-01T00:00:00.000Z"),
  },
];

describe("PositionsList", () => {
  it("renders the table ledger (the single layout, hub + leaf)", () => {
    const html = renderToStaticMarkup(
      <PositionsList
        positions={POSITIONS}
        source="live"
      />,
    );

    expect(html).toContain("pf-positions__row--head");
    expect(html).toContain(">Vault</span>");
    // The dead editorial-card branch is gone — no summary markup remains.
    expect(html).not.toContain("pf-positions-summary");
  });

  it("renders the same table ledger in embedded mode (chrome differs only)", () => {
    const html = renderToStaticMarkup(
      <PositionsList
        positions={POSITIONS}
        source="live"
        embedded
        leafHref="/portfolio/positions"
      />,
    );

    expect(html).toContain("pf-positions__row--head");
    expect(html).not.toContain("pf-positions-summary");
  });
});
