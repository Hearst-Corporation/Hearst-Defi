import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { HeroKpiTable } from "@/components/portfolio/hero-kpi-table";
import { HeroLiquidityRail } from "@/components/portfolio/hero-liquidity-rail";
import { HeroPayoutRail } from "@/components/portfolio/hero-payout-rail";
import {
  zeroLockMeterProps,
  zeroTimeToCashProps,
} from "@/lib/portfolio/layout-preview";

const PREVIEW_AS_OF = new Date("2026-06-11T00:00:00Z");

describe("HeroKpiTable — provenance per metric", () => {
  const baseProps = {
    totalValueUsdc: 500_000,
    totalYieldYtdUsdc: 12_000,
    nextDistributionAt: new Date("2026-07-01T00:00:00Z"),
    hasPositions: true,
    source: "live" as const,
    updatedAt: new Date(),
  };

  it("previewZeros: no provenance badges (no fabricated Live)", () => {
    const html = renderToStaticMarkup(
      <HeroKpiTable {...baseProps} previewZeros hasPositions={false} />,
    );
    expect(html).not.toContain("provenance-badge--strip");
    expect(html).not.toContain('aria-label="Data provenance: Live"');
    expect(html).not.toContain('aria-label="Data provenance: Estimated"');
  });

  it("live data: strip badges on value (Live) and yield/dist (Estimated)", () => {
    const html = renderToStaticMarkup(<HeroKpiTable {...baseProps} />);
    expect(html).toContain("Position value");
    expect(html).toContain("Yield YTD");
    expect(html).toContain("Next distribution");
    expect(html.match(/provenance-badge--strip/g)?.length).toBe(3);
    expect(html.match(/aria-label="Data provenance: Live"/g)?.length).toBe(1);
    expect(html.match(/aria-label="Data provenance: Estimated"/g)?.length).toBe(2);
  });
});

describe("Hero rail — native layout at zero", () => {
  it("HeroPayoutRail zero via mode: compact rail (no 0% bar)", () => {
    const html = renderToStaticMarkup(
      <HeroPayoutRail {...zeroTimeToCashProps(PREVIEW_AS_OF)} mode="zero" />,
    );
    expect(html).not.toContain("pf-meter");
    expect(html).toContain("Cycle pending");
  });

  it("HeroPayoutRail zero: compact rail (no 0% bar, no note)", () => {
    const html = renderToStaticMarkup(
      <HeroPayoutRail {...zeroTimeToCashProps(PREVIEW_AS_OF)} previewZeros />,
    );
    expect(html).toContain("pf-hero-rail-group--payout");
    expect(html).toContain("—");
    expect(html).not.toContain("$0 USDC");
    // Zero-state collapses to title + value + meta — no 0% meter, no projection note.
    expect(html).not.toContain("pf-meter");
    expect(html).toContain("Cycle pending");
    expect(html).not.toContain("Projection unlocks after the first active yield snapshot");
    expect(html).not.toContain("provenance-badge--strip");
    expect(html).not.toContain("ModuleChrome");
    expect(html).not.toContain("Next distribution");
    expect(html).not.toContain("flex h-full");
  });

  it("HeroPayoutRail live: provenance strip + not guaranteed disclaimer", () => {
    const html = renderToStaticMarkup(
      <HeroPayoutRail
        cycleStart={new Date("2026-06-01T00:00:00Z")}
        cycleDays={30}
        projectedUsdc={12_500}
        aprLow={9.4}
        aprHigh={12.8}
        source="live"
        updatedAt={new Date()}
      />,
    );
    expect(html).toContain("provenance-badge--strip");
    expect(html).toContain("estimate only, not guaranteed.");
    expect(html).toContain('aria-label="APY range 9.4 to 12.8 %"');
  });

  it("HeroLiquidityRail zero: compact rail (no 0% bar)", () => {
    const html = renderToStaticMarkup(
      <HeroLiquidityRail {...zeroLockMeterProps(PREVIEW_AS_OF)} previewZeros />,
    );
    expect(html).toContain("pf-hero-rail-group");
    // Zero-state drops the 0% meter — only the terms meta line shows.
    expect(html).not.toContain("pf-meter");
    expect(html).toContain("60-day soft lock shown after deposit");
    expect(html).not.toContain("provenance-badge--strip");
    expect(html).not.toContain("Unlock");
    expect(html).not.toContain("60d left");
    expect(html).not.toContain("Early exit penalty");
    expect(html).not.toContain("flex h-full");
    expect(html).not.toContain("mt-auto");
  });

  it("HeroLiquidityRail live: live provenance strip", () => {
    const html = renderToStaticMarkup(
      <HeroLiquidityRail
        lockStart={new Date("2026-04-01T00:00:00Z")}
        softLockupDays={60}
        earlyExitPenaltyBps={150}
        source="live"
        updatedAt={new Date()}
        asOf={new Date("2026-05-01T00:00:00Z")}
      />,
    );
    expect(html).toContain('aria-label="Data provenance: Live"');
  });
});
