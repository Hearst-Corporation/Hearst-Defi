import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PositionCapitalProtection } from "@/components/portfolio/position-capital-protection";
import { scanSeries1Wording } from "@/lib/guards/wording-series1";

describe("PositionCapitalProtection Series 1 wording", () => {
  it("renders the three-pocket policy without banned financing vocabulary", () => {
    const html = renderToStaticMarkup(
      <PositionCapitalProtection
        principalUsdc={250_000}
        accruedYieldUsdc={12_500}
        distributedUsdc={0}
        status="active"
        softLockupDays={60}
      />,
    );

    expect(html).toContain("Three-pocket reserve");
    expect(html).toContain("Mining Power, BTC Pouch and Reserve USDC");
    expect(scanSeries1Wording(html)).toEqual({ ok: true, hits: [] });
  });
});
