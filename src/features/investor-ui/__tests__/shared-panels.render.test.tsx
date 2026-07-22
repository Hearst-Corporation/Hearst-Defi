// Render tests for the shared investor panels that a route ACTUALLY renders
// (via the admin analytics gallery): AccumulationChartPanel,
// SourcesAccumulationPanel, StrategyCompositionPanel.
//
// Rewritten 2026-07-22 with the fixture purge: this file used to pull its
// data from FixtureInvestorUiDataSource and also tested MiningPulsePanel /
// ReserveHealthPanel / AnalystNotePanel — components no route ever mounted,
// removed with their fixtures. Chart points are now inline TEST-ONLY values,
// visibly arbitrary, never routed through a data source that could be
// mistaken for a real one.
//
// Pattern: renderToStaticMarkup (vitest env = node, no RTL/jsdom).

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { AccumulationPoint } from "@/features/investor-ui/charts/accumulation-series";
import { AccumulationChartPanel } from "@/features/investor-ui/components/accumulation-chart-panel";
import {
  ACCUMULATION_CHART_CONFIG,
  ACCUMULATION_CHART_CONFIG_ACCENT,
  ACCUMULATION_CHART_CONFIGS,
} from "@/features/investor-ui/charts/asset-chart-config";
import { SourcesAccumulationPanel } from "@/features/investor-ui/components/sources-accumulation-panel";
import { StrategyCompositionPanel } from "@/features/investor-ui/components/strategy-composition-panel";

const FORBIDDEN_COPY = /\bapy\b|\byield\b|\bguarantee\b|\bpromise\b|\brisk-free\b|\bwill deliver\b|Just now/i;

// TEST-ONLY chart points — two arbitrary months, no strategic inflation
// (the retired buildAccumulationSeries used to add +15% on top of mining).
const points: AccumulationPoint[] = [
  { period: "2026-01", cumulativeBtc: 0.04, miningBtc: 0.04 },
  { period: "2026-02", cumulativeBtc: 0.09, miningBtc: 0.09 },
];

// TEST-ONLY pockets — a measured allocation shape (actualBps present) so the
// delta labels render; values deliberately off-target to exercise the "pp vs
// target" copy.
const MEASURED_POCKETS = [
  { pocket: "B1" as const, label: "Mining Power", targetBps: 4000, actualBps: 3960 },
  { pocket: "B2" as const, label: "BTC Pouch", targetBps: 2700, actualBps: 2740 },
  { pocket: "B3" as const, label: "Reserve USDC", targetBps: 3300, actualBps: 3300 },
];

describe("AccumulationChartPanel (D2)", () => {
  it("keeps the historical default action (View Bitcoin) and btc tone", () => {
    const html = renderToStaticMarkup(
      <AccumulationChartPanel points={points} currentMonth={6} totalMonths={24} provenance="simulated" />,
    );
    expect(html).toContain("BTC accumulation");
    expect(html).toContain("View Bitcoin");
    expect(html).toContain("Month 6 of 24");
    expect(html).toContain("Historical accumulation only");
  });

  it("action=null renders no link (no self-link on /btc)", () => {
    const html = renderToStaticMarkup(
      <AccumulationChartPanel
        points={points}
        currentMonth={6}
        totalMonths={24}
        provenance="simulated"
        action={null}
      />,
    );
    expect(html).not.toContain("View Bitcoin");
  });

  it("accepts a custom action", () => {
    const html = renderToStaticMarkup(
      <AccumulationChartPanel
        points={points}
        currentMonth={null}
        totalMonths={null}
        provenance="simulated"
        action={{ label: "View accumulation →", href: "/btc" }}
      />,
    );
    expect(html).toContain("View accumulation");
    expect(html).not.toContain("View Bitcoin");
  });

  it("tone configs: accent = product green, btc = asset orange, same labels", () => {
    expect(ACCUMULATION_CHART_CONFIG_ACCENT.actual.color).toBe("var(--ct-accent)");
    expect(ACCUMULATION_CHART_CONFIG_ACCENT.mining.color).toBe("var(--ct-chart-series-2)");
    expect(ACCUMULATION_CHART_CONFIG_ACCENT.reference.color).toBe("var(--ct-chart-neutral)");
    expect(ACCUMULATION_CHART_CONFIG.actual.color).toBe("var(--ct-asset-btc)");
    expect(ACCUMULATION_CHART_CONFIGS.accent.actual?.label).toBe(
      ACCUMULATION_CHART_CONFIGS.btc.actual?.label,
    );
  });

  it("renders the honest empty state below 2 points", () => {
    const html = renderToStaticMarkup(
      <AccumulationChartPanel points={[]} currentMonth={null} totalMonths={null} provenance="simulated" />,
    );
    expect(html).toMatch(/Accumulation history will appear/i);
  });
});

describe("SourcesAccumulationPanel — honest monthly labelling", () => {
  it("labels the series as monthly accumulation and carries a provenance badge", () => {
    const cumulative = points.map((p) => ({
      period: p.period,
      mining: p.miningBtc,
      strategic: Math.max(0, p.cumulativeBtc - p.miningBtc),
    }));
    const html = renderToStaticMarkup(<SourcesAccumulationPanel monthlyProduction={cumulative} />);
    expect(html).toContain("Sources of accumulation");
    expect(html).toContain("Monthly accumulation by source");
    expect(html).toContain("Simulated");
  });

  it("renders nothing for an empty series (no fabricated months)", () => {
    expect(renderToStaticMarkup(<SourcesAccumulationPanel monthlyProduction={[]} />)).toBe("");
  });
});

describe("StrategyCompositionPanel (D3)", () => {
  it("shows actual vs target with discreet pp deltas when actualBps is indexed", () => {
    const html = renderToStaticMarkup(<StrategyCompositionPanel pockets={MEASURED_POCKETS} />);
    expect(html).toContain("Strategy composition");
    expect(html).toContain("Capital → BTC accumulation");
    expect(html).toContain("39.6%"); // actual, not the 40% target fallback
    expect(html).toContain("27.4%");
    expect(html).toContain("pp vs target");
    expect(html).toContain("on target");
    expect(html).toContain("Mining Power");
    expect(html).toContain("Bitcoin accumulation");
  });

  it("absent pockets -> honest DataUnavailable, no hard-coded 40/27/33 fallback", () => {
    const html = renderToStaticMarkup(<StrategyCompositionPanel pockets={null} />);
    expect(html).toMatch(/Strategy composition unavailable/i);
    expect(html).not.toContain("Mining Power");
    expect(html).not.toContain("40%");
  });
});

describe("compliance — shared panels never speak yield/APY/promises", () => {
  it("full render sweep stays clean", () => {
    const html = renderToStaticMarkup(
      <>
        <AccumulationChartPanel points={points} currentMonth={6} totalMonths={24} provenance="simulated" />
        <SourcesAccumulationPanel
          monthlyProduction={points.map((p) => ({
            period: p.period,
            mining: p.miningBtc,
            strategic: Math.max(0, p.cumulativeBtc - p.miningBtc),
          }))}
        />
        <StrategyCompositionPanel pockets={MEASURED_POCKETS} />
      </>,
    );
    expect(html).not.toMatch(FORBIDDEN_COPY);
  });
});
