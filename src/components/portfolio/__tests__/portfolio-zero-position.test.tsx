/**
 * Portfolio zero-position contracts — layout preview + default empty widgets.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MergedSurface } from "@/components/portfolio/merged-surface";
import { AwaitingMetricState } from "@/components/portfolio/awaiting-metric-state";
import { LayoutPreviewBanner } from "@/components/portfolio/layout-preview-banner";
import { TimeToCash } from "@/components/portfolio/time-to-cash";
import { LockMeter } from "@/components/portfolio/lock-meter";
import { ValueChart } from "@/components/portfolio/value-chart";
import { YieldStack } from "@/components/portfolio/yield-stack";
import { AllocationDonut } from "@/components/portfolio/allocation-donut";
import {
  ZERO_YIELD_STACK,
  zeroLockMeterProps,
  zeroTimeToCashProps,
} from "@/lib/portfolio/layout-preview";

const PREVIEW_AS_OF = new Date("2026-06-11T00:00:00Z");

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
    expect(html).not.toContain("dash-cell-premium");
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
    expect(html).not.toContain("dash-cell-premium");
  });

  it("MergedSurface with showProvenance=false hides Verified data label", () => {
    const html = renderToStaticMarkup(
      <MergedSurface title="Test" provenance="stale" showProvenance={false}>
        <AwaitingMetricState message="Section awaiting data." />
      </MergedSurface>,
    );
    expect(html).not.toContain("Verified data");
  });

  it("MergedSurface preview variant uses pf-section-light, not dash-cell-premium", () => {
    const html = renderToStaticMarkup(
      <MergedSurface title="Performance" variant="preview" data-section="hero-pulse">
        <AwaitingMetricState message="Awaiting first position." className="pf-zero-await" />
      </MergedSurface>,
    );
    expect(html).toContain("pf-section-light");
    expect(html).toContain("Preview");
    expect(html).not.toContain("dash-cell-premium");
    expect(html).not.toContain("Verified data");
  });
});

describe("Portfolio zero-position — layout preview (DS §9.3 tiers)", () => {
  it("banner states not guaranteed", () => {
    const html = renderToStaticMarkup(<LayoutPreviewBanner />);
    expect(html).toContain("Layout preview");
    expect(html).toContain("not guaranteed");
  });

  it("TimeToCash previewZeros: progress bar shell at zero, no awaiting surface", () => {
    const html = renderToStaticMarkup(
      <TimeToCash {...zeroTimeToCashProps(PREVIEW_AS_OF)} previewZeros embedded />,
    );
    expect(html).toContain("pf-progress-track");
    expect(html).toContain("$0 USDC projected");
    expect(html).not.toContain("ct-empty-surface--widget");
  });

  it("ValueChart previewZeros: flat $0 area chart, not empty surface", () => {
    const html = renderToStaticMarkup(
      <ValueChart
        positions={[]}
        totalValueUsdc={0}
        source="fallback"
        previewZeros
        embedded
      />,
    );
    expect(html).toContain("<svg");
    expect(html).not.toContain("ct-empty-surface--chart");
    expect(html).toContain("Layout preview at zero");
  });

  it("LockMeter previewZeros: progress bar at 0%, not awaiting surface", () => {
    const html = renderToStaticMarkup(
      <LockMeter {...zeroLockMeterProps(PREVIEW_AS_OF)} previewZeros embedded />,
    );
    expect(html).toContain("pf-progress-track");
    expect(html).not.toContain("ct-empty-surface--widget");
  });

  it("YieldStack + AllocationDonut previewZeros: widget shells with zero graphics", () => {
    const yieldHtml = renderToStaticMarkup(
      <YieldStack {...ZERO_YIELD_STACK} previewZeros />,
    );
    const donutHtml = renderToStaticMarkup(
      <AllocationDonut
        positions={[]}
        totalValueUsdc={0}
        source="fallback"
        previewZeros
      />,
    );
    expect(yieldHtml).toContain("dash-cell-premium");
    expect(yieldHtml).toContain("yield-stack-row");
    expect(donutHtml).toContain("dash-cell-premium");
    expect(donutHtml).toContain("<svg");
    expect(donutHtml).toContain("0% · $0");
  });
});
