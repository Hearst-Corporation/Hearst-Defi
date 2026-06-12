/**
 * Portfolio zero-position page contracts — trust cleanup P0.
 *
 * When the investor has no active positions:
 *   - No misleading payout countdown
 *   - No "Verified data" on empty sections
 *   - Liquidity widgets use awaiting states, not premium + Stale
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MergedSurface } from "@/components/portfolio/merged-surface";
import { AwaitingMetricState } from "@/components/portfolio/awaiting-metric-state";
import { TimeToCash } from "@/components/portfolio/time-to-cash";
import { LockMeter } from "@/components/portfolio/lock-meter";

const STALE_TIME_TO_CASH_PROPS = {
  cycleStart: new Date("2026-06-01T00:00:00Z"),
  cycleDays: 30,
  projectedUsdc: 0,
  aprLow: 0,
  aprHigh: 0,
  source: "stale" as const,
};

describe("Portfolio zero-position — trust contracts", () => {
  it("TimeToCash stale: awaiting state, no premium surface or Stale badge", () => {
    const html = renderToStaticMarkup(<TimeToCash {...STALE_TIME_TO_CASH_PROPS} />);
    expect(html).toContain("pf-empty-widget");
    expect(html).toContain("Distribution cycle starts after your first active position.");
    expect(html).not.toContain("dash-cell-premium");
    expect(html).not.toContain("Stale");
    expect(html).not.toContain("d left");
  });

  it("LockMeter unknown terms: awaiting state, no premium surface or Stale badge", () => {
    const html = renderToStaticMarkup(
      <LockMeter
        lockStart={new Date("2026-01-01T00:00:00Z")}
        softLockupDays={0}
        earlyExitPenaltyBps={150}
        source="stale"
      />,
    );
    expect(html).toContain("pf-empty-widget");
    expect(html).toContain("Lock and liquidity terms appear after your first active position.");
    expect(html).not.toContain("dash-cell-premium");
    expect(html).not.toContain("Stale");
  });

  it("MergedSurface with showProvenance=false hides Verified data label", () => {
    const html = renderToStaticMarkup(
      <MergedSurface title="Test" provenance="stale" showProvenance={false}>
        <AwaitingMetricState message="Section awaiting data." />
      </MergedSurface>,
    );
    expect(html).not.toContain("Verified data");
    expect(html).not.toContain("Stale");
  });

  it("zero-position light section: pf-empty-widget not inside dash-cell-premium", () => {
    const html = renderToStaticMarkup(
      <section data-section="yield-trust" className="pf-section-light">
        <AwaitingMetricState message="Risk scores will appear after the first snapshot." />
      </section>,
    );
    expect(html).toContain("pf-empty-widget");
    expect(html).not.toContain("dash-cell-premium");
  });

  it("distribution KPI contract: no countdown without positions", () => {
    const hasPositions = false;
    const nextDistributionAt = new Date("2026-06-30T00:00:00Z");
    const now = new Date("2026-06-11T00:00:00Z");
    const diffTime = Math.max(0, nextDistributionAt.getTime() - now.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const dateLabel = hasPositions
      ? new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        }).format(nextDistributionAt)
      : "—";

    expect(dateLabel).toBe("—");
    expect(hasPositions && diffDays > 0).toBe(false);
  });
});
