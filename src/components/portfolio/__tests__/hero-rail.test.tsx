import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { HeroLiquidityRail } from "@/components/portfolio/hero-liquidity-rail";
import { HeroPayoutRail } from "@/components/portfolio/hero-payout-rail";
import {
  zeroLockMeterProps,
  zeroTimeToCashProps,
} from "@/lib/portfolio/layout-preview";

const PREVIEW_AS_OF = new Date("2026-06-11T00:00:00Z");

describe("Hero rail — native layout at zero", () => {
  it("HeroPayoutRail renders compact rail DOM with progress bar", () => {
    const html = renderToStaticMarkup(
      <HeroPayoutRail {...zeroTimeToCashProps(PREVIEW_AS_OF)} previewZeros />,
    );
    expect(html).toContain("pf-hero-rail-group--payout");
    expect(html).toContain("$0 USDC");
    expect(html).toContain("pf-progress-track");
    expect(html).toContain("Cycle pending · Pending");
    expect(html).toContain("After first active position.");
    expect(html).not.toContain("ModuleChrome");
    expect(html).not.toContain("Next distribution");
    expect(html).not.toContain("Projection pending");
    expect(html).not.toContain("flex h-full");
  });

  it("HeroLiquidityRail renders compact rail DOM with progress bar", () => {
    const html = renderToStaticMarkup(
      <HeroLiquidityRail {...zeroLockMeterProps(PREVIEW_AS_OF)} previewZeros />,
    );
    expect(html).toContain("pf-hero-rail-group");
    expect(html).toContain("pf-progress-track");
    expect(html).toContain("60d left");
    expect(html).not.toContain("Early exit penalty");
    expect(html).not.toContain("flex h-full");
    expect(html).not.toContain("mt-auto");
  });
});
