/**
 * Portfolio zero-position contracts — preview sections + empty widgets.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MergedSurface } from "@/components/portfolio/merged-surface";
import { AwaitingMetricState } from "@/components/ui/awaiting-metric-state";
import { LayoutPreviewBanner } from "@/components/portfolio/layout-preview-banner";
import { TimeToCash } from "@/components/portfolio/time-to-cash";
import { LockMeter } from "@/components/portfolio/lock-meter";
import { ValueChart } from "@/components/portfolio/value-chart";
import { YieldStack } from "@/components/portfolio/yield-stack";
import { AllocationDonut } from "@/components/portfolio/allocation-donut";
import { ZERO_YIELD_STACK } from "@/lib/portfolio/layout-preview";

const STALE_TIME_TO_CASH_PROPS = {
  cycleStart: new Date("2026-06-01T00:00:00Z"),
  cycleDays: 30,
  projectedUsdc: 0,
  aprLow: 0,
  aprHigh: 0,
  source: "stale" as const,
};

describe("Portfolio zero-position — default empty widgets", () => {
  it("TimeToCash stale: awaiting surface, no premium shell", () => {
    const html = renderToStaticMarkup(<TimeToCash {...STALE_TIME_TO_CASH_PROPS} />);
    expect(html).toContain("ct-empty-surface--widget");
    expect(html).not.toContain("glass-panel");
    expect(html).not.toContain("Stale");
  });

  it("LockMeter unknown terms: awaiting surface, no premium shell", () => {
    const html = renderToStaticMarkup(
      <LockMeter
        lockStart={new Date("2026-01-01T00:00:00Z")}
        softLockupDays={0}
        earlyExitPenaltyBps={150}
        source="stale"
      />,
    );
    expect(html).toContain("ct-empty-surface--widget");
    expect(html).not.toContain("glass-panel");
    expect(html).not.toContain("Stale");
  });

  it("MergedSurface with showProvenance=false hides Verified data label", () => {
    const html = renderToStaticMarkup(
      <MergedSurface title="Test" provenance="stale" showProvenance={false}>
        <AwaitingMetricState message="Section awaiting data." />
      </MergedSurface>,
    );
    expect(html).not.toContain("Verified data");
  });

  it("MergedSurface preview variant uses ct-section-preview, not glass-panel", () => {
    const html = renderToStaticMarkup(
      <MergedSurface title="Performance" variant="preview" data-section="hero-pulse">
        <AwaitingMetricState message="Awaiting first position." className="pf-zero-await" />
      </MergedSurface>,
    );
    expect(html).toContain("ct-section-preview");
    expect(html).toContain("Preview");
    expect(html).not.toContain("glass-panel");
    expect(html).not.toContain("Verified data");
  });
});

describe("Portfolio zero-position — no fake active widgets at zero", () => {
  it("banner states not guaranteed", () => {
    const html = renderToStaticMarkup(<LayoutPreviewBanner />);
    expect(html).toContain("Layout preview");
    expect(html).toContain("not guaranteed");
  });

  it("ValueChart empty: chart empty surface, not svg", () => {
    const html = renderToStaticMarkup(
      <ValueChart positions={[]} totalValueUsdc={0} source="fallback" />,
    );
    expect(html).toContain("ct-empty-surface--chart");
    expect(html).not.toContain("<svg");
    expect(html).not.toContain("$0");
  });

  it("TimeToCash stale: no progress bar shell", () => {
    const html = renderToStaticMarkup(<TimeToCash {...STALE_TIME_TO_CASH_PROPS} />);
    expect(html).not.toContain("pf-progress-track");
    expect(html).not.toContain("$0 USDC projected");
  });

  it("LockMeter stale: no progress bar shell", () => {
    const html = renderToStaticMarkup(
      <LockMeter
        lockStart={new Date("2026-01-01T00:00:00Z")}
        softLockupDays={0}
        earlyExitPenaltyBps={150}
        source="stale"
      />,
    );
    expect(html).not.toContain("pf-progress-track");
  });

  it("YieldStack + AllocationDonut empty: awaiting/chart surfaces, not glass-panel", () => {
    const yieldHtml = renderToStaticMarkup(<YieldStack {...ZERO_YIELD_STACK} />);
    const donutHtml = renderToStaticMarkup(
      <AllocationDonut positions={[]} totalValueUsdc={0} source="fallback" />,
    );
    expect(yieldHtml).toContain("ct-empty-surface--widget");
    expect(yieldHtml).not.toContain("glass-panel");
    expect(donutHtml).toContain("ct-empty-surface--chart");
    expect(donutHtml).not.toContain("<svg");
    expect(donutHtml).not.toContain("$0");
  });
});
