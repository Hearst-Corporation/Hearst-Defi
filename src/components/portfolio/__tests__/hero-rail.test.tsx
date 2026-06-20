import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { HeroKpiTable } from "@/components/portfolio/hero-kpi-table";
import { HeroLiquidityRail } from "@/components/portfolio/hero-liquidity-rail";
import { HeroPayoutRail } from "@/components/portfolio/hero-payout-rail";

const PREVIEW_AS_OF = new Date("2026-06-11T00:00:00Z");

// Stale/empty props — no positions, no real data yet.
const STALE_PAYOUT_PROPS = {
  cycleStart: PREVIEW_AS_OF,
  cycleDays: 30,
  projectedUsdc: 0,
  aprLow: 0,
  aprHigh: 0,
  source: "stale" as const,
  updatedAt: PREVIEW_AS_OF,
};

const STALE_LOCK_PROPS = {
  lockStart: PREVIEW_AS_OF,
  softLockupDays: 0, // no terms known
  earlyExitPenaltyBps: 0,
  source: "stale" as const,
  asOf: PREVIEW_AS_OF,
};

describe("HeroKpiTable — provenance per metric", () => {
  const baseProps = {
    totalValueUsdc: 500_000,
    totalYieldYtdUsdc: 12_000,
    nextDistributionAt: new Date("2026-07-01T00:00:00Z"),
    hasPositions: true,
    source: "live" as const,
    updatedAt: new Date(),
  };

  it("no positions: no provenance badges (no fabricated Live)", () => {
    const html = renderToStaticMarkup(
      <HeroKpiTable {...baseProps} hasPositions={false} />,
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

describe("Hero rail — stale/empty state (no positions)", () => {
  it("HeroPayoutRail stale: compact rail (no 0% bar, shows '—' and 'Cycle pending')", () => {
    const html = renderToStaticMarkup(
      <HeroPayoutRail {...STALE_PAYOUT_PROPS} />,
    );
    expect(html).toContain("pf-hero-rail-group--payout");
    expect(html).toContain("—");
    expect(html).not.toContain("$0 USDC");
    // Stale state collapses to title + value + meta — no 0% meter, no projection note.
    expect(html).not.toContain("pf-meter");
    expect(html).toContain("Cycle pending");
    expect(html).not.toContain("estimate only, not guaranteed.");
    expect(html).not.toContain("provenance-badge--strip");
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

  it("HeroLiquidityRail stale (softLockupDays=0): no bar, shows terms pending meta", () => {
    const html = renderToStaticMarkup(
      <HeroLiquidityRail {...STALE_LOCK_PROPS} />,
    );
    expect(html).toContain("pf-hero-rail-group");
    // No terms = no meter rendered.
    expect(html).not.toContain("pf-meter");
    expect(html).toContain("Terms pending");
    expect(html).not.toContain("provenance-badge--strip");
    expect(html).not.toContain("Unlock");
    expect(html).not.toContain("60d left");
    expect(html).not.toContain("Early exit penalty");
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
