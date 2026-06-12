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
import { zeroLockMeterProps, zeroTimeToCashProps } from "@/lib/portfolio/layout-preview";

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
  it("TimeToCash stale: awaiting state, no premium surface", () => {
    const html = renderToStaticMarkup(<TimeToCash {...STALE_TIME_TO_CASH_PROPS} />);
    expect(html).toContain("pf-empty-widget");
    expect(html).not.toContain("dash-cell-premium");
  });

  it("LockMeter unknown terms: awaiting state, no premium surface", () => {
    const html = renderToStaticMarkup(
      <LockMeter
        lockStart={new Date("2026-01-01T00:00:00Z")}
        softLockupDays={0}
        earlyExitPenaltyBps={150}
        source="stale"
      />,
    );
    expect(html).toContain("pf-empty-widget");
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
});

describe("Portfolio zero-position — layout preview", () => {
  it("banner states not guaranteed", () => {
    const html = renderToStaticMarkup(<LayoutPreviewBanner />);
    expect(html).toContain("Layout preview");
    expect(html).toContain("not guaranteed");
  });

  it("TimeToCash previewZeros: premium shell with Stale badge, no countdown", () => {
    const html = renderToStaticMarkup(
      <TimeToCash {...zeroTimeToCashProps(PREVIEW_AS_OF)} previewZeros />,
    );
    expect(html).toContain("dash-cell-premium");
    expect(html).toContain("Stale");
    expect(html).toContain("$0 USDC projected");
    expect(html).not.toContain("d left");
  });

  it("ValueChart previewZeros: renders svg without disclaimer watermark", () => {
    const html = renderToStaticMarkup(
      <ValueChart
        positions={[]}
        totalValueUsdc={0}
        source="fallback"
        previewZeros
      />,
    );
    expect(html).toContain("dash-cell-premium");
    expect(html).toContain("<svg");
    expect(html).toContain("min-h-32");
    expect(html).not.toContain("methodology v1.0");
    expect(html).toContain("Layout preview at zero");
  });

  it("LockMeter previewZeros: premium shell at 0% with Stale badge", () => {
    const html = renderToStaticMarkup(
      <LockMeter {...zeroLockMeterProps(PREVIEW_AS_OF)} previewZeros />,
    );
    expect(html).toContain("dash-cell-premium");
    expect(html).toContain("Stale");
    expect(html).toContain("0%");
    expect(html).not.toContain("pf-empty-widget");
  });
});
