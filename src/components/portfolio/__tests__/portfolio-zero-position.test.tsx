/**
 * Portfolio zero-position contracts — layout preview + default empty widgets.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ProductSection } from "@/components/ui/product-section";
import { AwaitingMetricState } from "@/components/ui/awaiting-metric-state";
import { SectionEmbedProvider } from "@/components/ui/section-embed";
import { TimeToCash } from "@/components/portfolio/time-to-cash";
import { LockMeter } from "@/components/portfolio/lock-meter";
import { ValueChart } from "@/components/portfolio/value-chart";
import { YieldStack } from "@/components/portfolio/yield-stack";
import { AllocationDonut } from "@/components/portfolio/allocation-donut";
import { PositionsList } from "@/components/portfolio/positions-list";
import { RiskPulse } from "@/components/portfolio/risk-pulse";
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

describe("Portfolio zero-position — cockpit shell always visible", () => {
  it("TimeToCash stale: progress shell at zero, not empty surface", () => {
    const html = renderToStaticMarkup(<TimeToCash {...STALE_TIME_TO_CASH_PROPS} />);
    expect(html).toContain("pf-progress-track");
    expect(html).toContain("Preview mode");
    expect(html).not.toContain("ct-empty-surface--widget");
  });

  it("LockMeter unknown terms: progress shell, not empty surface", () => {
    const html = renderToStaticMarkup(
      <LockMeter
        lockStart={new Date("2026-01-01T00:00:00Z")}
        softLockupDays={0}
        earlyExitPenaltyBps={150}
        source="stale"
      />,
    );
    expect(html).toContain("pf-progress-track");
    expect(html).toContain("Preview mode");
    expect(html).not.toContain("ct-empty-surface--widget");
  });

  it("ProductSection with showProvenance=false hides Verified data label", () => {
    const html = renderToStaticMarkup(
      <ProductSection title="Test" provenance="stale" showProvenance={false}>
        <AwaitingMetricState message="Section awaiting data." />
      </ProductSection>,
    );
    expect(html).not.toContain("Verified data");
  });

  it("ProductSection preview variant uses ct-section-preview, not glass-panel", () => {
    const html = renderToStaticMarkup(
      <ProductSection title="Performance" variant="preview" data-section="hero-pulse">
        <AwaitingMetricState message="Awaiting first position." className="pf-zero-await" />
      </ProductSection>,
    );
    expect(html).toContain("ct-section-preview");
    expect(html).toContain("Preview");
    expect(html).not.toContain("Verified data");
  });
});

describe("Portfolio zero-position — layout preview (DS §9.3 tiers)", () => {
  it("TimeToCash previewZeros: progress bar shell at zero, no awaiting surface", () => {
    const html = renderToStaticMarkup(
      <SectionEmbedProvider>
        <TimeToCash {...zeroTimeToCashProps(PREVIEW_AS_OF)} previewZeros />
      </SectionEmbedProvider>,
    );
    expect(html).toContain("pf-progress-track");
    expect(html).toContain("$0 USDC projected");
    expect(html).not.toContain("ct-empty-surface--widget");
  });

  it("ValueChart previewZeros: no green preview chart line", () => {
    const html = renderToStaticMarkup(
      <SectionEmbedProvider>
        <ValueChart
          positions={[]}
          totalValueUsdc={0}
          source="fallback"
          previewZeros
        />
      </SectionEmbedProvider>,
    );
    expect(html).not.toContain("<svg");
    expect(html).toContain("No portfolio value recorded yet");
    expect(html).toContain("Indicative 12-month path");
  });

  it("ValueChart previewZeros + nextAction: embeds get-started CTA inside chart panel", () => {
    const html = renderToStaticMarkup(
      <SectionEmbedProvider>
        <ValueChart
          positions={[]}
          totalValueUsdc={0}
          source="fallback"
          previewZeros
          nextAction={{
            kycStatus: "pending",
            accreditationAttested: false,
            hasWallet: false,
            positionCount: 0,
          }}
        />
      </SectionEmbedProvider>,
    );
    expect(html).toContain("Get started");
    expect(html).toContain("Confirm your eligibility");
    expect(html).toContain("Start onboarding");
    expect(html).toContain("/onboarding/accreditation");
    expect(html).not.toMatch(/<h3[^>]*>Portfolio value<\/h3>/);
    expect(html).not.toContain("No portfolio value recorded yet");
    expect(html).not.toContain("<svg");
  });

  it("LockMeter previewZeros: progress bar at 0%, not awaiting surface", () => {
    const html = renderToStaticMarkup(
      <SectionEmbedProvider>
        <LockMeter {...zeroLockMeterProps(PREVIEW_AS_OF)} previewZeros />
      </SectionEmbedProvider>,
    );
    expect(html).toContain("pf-progress-track");
    expect(html).not.toContain("ct-empty-surface--widget");
  });

  it("RiskPulse previewZeros: pending dimensions, light composite row, no fake score", () => {
    const html = renderToStaticMarkup(
      <RiskPulse
        scores={[
          { dimension: "market", score: 0, delta30d: 0 },
          { dimension: "mining", score: 0, delta30d: 0 },
          { dimension: "liquidity", score: 0, delta30d: 0 },
          { dimension: "smart_contract", score: 0, delta30d: 0 },
          { dimension: "counterparty", score: 0, delta30d: 0 },
        ]}
        composite={0}
        compositeLabel={undefined}
        composite30dTrend="stable"
        previewZeros
      />,
    );
    expect(html).toContain("Snapshot pending");
    expect(html).toContain("ct-panel-status");
    expect(html).toContain("Pending");
    expect(html).toContain("pf-risk-composite-pending");
    expect(html).toContain("pf-risk-composite-value");
    expect(html).not.toContain("pf-hero-kpi-value");
    expect(html).not.toContain("Awaiting snapshot");
    expect(html).not.toContain(">N/A<");
    expect(html).not.toContain(">42<");
    expect(html).not.toContain("ct-nested-panel pf-risk-composite");
  });

  it("PositionsList previewZeros: table header + clear empty row, no ghost dashes", () => {
    const html = renderToStaticMarkup(
      <PositionsList positions={[]} source="fallback" previewZeros />,
    );
    expect(html).toContain("Principal");
    expect(html).toContain("APY range");
    expect(html).toContain('role="status"');
    expect(html).toContain("No open positions yet");
    expect(html).toContain("Your first confirmed deposit will appear here.");
    expect(html).toContain("pf-positions-empty-row");
    expect(html).not.toContain("pf-status-dot");
    expect(html).not.toContain('aria-hidden="true"');
  });

  it("YieldStack previewZeros: bar shell without fake APY strings", () => {
    const yieldHtml = renderToStaticMarkup(
      <YieldStack {...ZERO_YIELD_STACK} previewZeros />,
    );
    expect(yieldHtml).toContain("pf-cockpit-panel");
    expect(yieldHtml).toContain("yield-stack-row");
    expect(yieldHtml).toContain("Mining cashflow");
    expect(yieldHtml).toContain("USDC base yield");
    expect(yieldHtml).toContain("BTC tactical");
    expect(yieldHtml).toContain("Stable reserve");
    expect(yieldHtml).not.toContain("0.0–0.0%");
    expect(yieldHtml).not.toContain("+0.0%");
    expect(yieldHtml).not.toContain("±0.0%");
    expect(yieldHtml).not.toMatch(
      /<div class="flex flex-col gap-2"[^>]*aria-hidden/,
    );
    expect(yieldHtml).not.toContain("not guaranteed");
  });

  it("YieldStack + AllocationDonut previewZeros: widget shells with zero graphics", () => {
    const yieldHtml = renderToStaticMarkup(
      <YieldStack {...ZERO_YIELD_STACK} previewZeros />,
    );
    const donutHtml = renderToStaticMarkup(
      <AllocationDonut
        buckets={[]}
        totalValueUsdc={0}
        source="stale"
        previewZeros
      />,
    );
    expect(yieldHtml).toContain("pf-cockpit-panel");
    expect(yieldHtml).toContain("yield-stack-row");
    expect(yieldHtml).not.toContain("card-premium");
    expect(donutHtml).toContain("pf-cockpit-panel");
    expect(donutHtml).not.toContain("card-premium");
    expect(donutHtml).toContain("<svg");
    expect(donutHtml).toContain("—");
    expect(donutHtml).not.toContain("$0");
    expect(donutHtml).not.toContain("dash-legend-row");
    expect(donutHtml).toContain("no positions");
  });
});
