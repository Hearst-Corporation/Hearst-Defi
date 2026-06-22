import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  PortfolioStatusPanel,
  underlyingProofLabel,
} from "@/components/portfolio/portfolio-status-panel";

describe("underlyingProofLabel", () => {
  it("returns Unverified when proof is missing", () => {
    expect(underlyingProofLabel(undefined)).toEqual({
      value: "Unverified",
      accent: false,
    });
  });

  it("returns Attested when loader marks attested", () => {
    expect(
      underlyingProofLabel({
        statedTvlUsdc: 1_000_000,
        onChainTvlUsdc: 0,
        source: "attested",
      }),
    ).toEqual({ value: "Attested", accent: true });
  });

  it("returns Pending when on-chain TVL is not yet populated", () => {
    expect(
      underlyingProofLabel({
        statedTvlUsdc: 1_000_000,
        onChainTvlUsdc: 0,
        source: "stale",
      }),
    ).toEqual({ value: "Pending", accent: false });
  });
});

describe("PortfolioStatusPanel", () => {
  it("does not show a misleading deployment percentage", () => {
    const html = renderToStaticMarkup(
      <PortfolioStatusPanel
        hasPositions
        positionsCount={1}
        deployedUsdc={11}
        totalValueUsdc={11}
        accruedYieldUsdc={0}
        source="live"
        updatedAt={new Date("2026-06-22T00:00:00.000Z")}
      />,
    );

    expect(html).toContain("Capital deployed");
    expect(html).toContain("$11");
    expect(html).toContain("Total value");
    expect(html).not.toContain("100.0%");
    expect(html).not.toContain("Net deposits");
    expect(html).toContain("Unverified");
    expect(html).not.toMatch(/pf-status-row__value[^>]*>Live</);
  });

  it("shows yield split on total value when accrued yield exists", () => {
    const html = renderToStaticMarkup(
      <PortfolioStatusPanel
        hasPositions
        positionsCount={1}
        deployedUsdc={500_000}
        totalValueUsdc={542_000}
        accruedYieldUsdc={42_000}
        source="live"
      />,
    );

    expect(html).toContain("Incl. $42K yield");
  });
});
