// Render tests for the shared investor panels (UI refonte, foundations pass).
// Pattern: renderToStaticMarkup (vitest env = node, no RTL/jsdom — cf.
// wired-chip.test.tsx / btc-page-content.render.test.tsx).

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { getFixtureInvestorUiDataSource } from "@/features/investor-ui/data-source";
import { btcPageExtraCompleteFixture } from "@/app/(product)/btc/_data/btc-page-fixtures";
import { buildAccumulationSeries } from "@/features/investor-ui/charts/accumulation-series";
import {
  ACCUMULATION_CHART_CONFIG,
  ACCUMULATION_CHART_CONFIG_ACCENT,
  ACCUMULATION_CHART_CONFIGS,
} from "@/features/investor-ui/charts/asset-chart-config";
import type { AiExpertResolvedViewModel, BtcViewModel } from "@/features/investor-ui/types";

import { AccumulationChartPanel } from "@/features/investor-ui/components/accumulation-chart-panel";
import { SourcesAccumulationPanel } from "@/features/investor-ui/components/sources-accumulation-panel";
import { StrategyCompositionPanel } from "@/features/investor-ui/components/strategy-composition-panel";
import { AnalystNotePanel } from "@/features/investor-ui/components/analyst-note-panel";
import { MiningPulsePanel } from "@/features/investor-ui/components/widgets/mining-pulse-panel";
import { ReserveHealthPanel } from "@/features/investor-ui/components/widgets/reserve-health-panel";

const FORBIDDEN_COPY = /\bapy\b|\byield\b|\bguarantee\b|\bpromise\b|\brisk-free\b|\bwill deliver\b|Just now/i;

const points = buildAccumulationSeries(btcPageExtraCompleteFixture.production.value?.monthly);

async function fixtures() {
  const ds = getFixtureInvestorUiDataSource();
  const [mining, btc, aiExperts, dashboard] = await Promise.all([
    ds.getMining(),
    ds.getBtc(),
    ds.getAiExperts(),
    ds.getDashboard(),
  ]);
  return { mining, btc, aiExperts, dashboard };
}

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

describe("MiningPulsePanel (D4)", () => {
  it("renders KPIs with the unified FIXTURE -> Simulated provenance", async () => {
    const { mining } = await fixtures();
    const html = renderToStaticMarkup(
      <MiningPulsePanel mining={mining} monthlyProduction={points} />,
    );
    expect(html).toContain("Mining pulse");
    expect(html).toContain("BTC produced (mining)");
    expect(html).toContain("412.50 TH/s");
    expect(html).toContain("0.184205 BTC");
    expect(html).toContain("Simulated");
    expect(html).not.toContain("Estimated");
    expect(html).toContain("Explore mining contribution");
  });

  it("empty production -> honest note, never the old fabricated Jan-Jun series", async () => {
    const { mining } = await fixtures();
    const html = renderToStaticMarkup(<MiningPulsePanel mining={mining} monthlyProduction={null} />);
    expect(html).toMatch(/Monthly production will appear/i);
    expect(html).not.toContain("0.012");
    expect(html).not.toContain("0.016");
  });

  it("compact density drops the chart and the mining link", async () => {
    const { mining } = await fixtures();
    const html = renderToStaticMarkup(
      <MiningPulsePanel mining={mining} monthlyProduction={points} density="compact" />,
    );
    expect(html).toContain("Mining pulse");
    expect(html).not.toContain("Explore mining contribution");
    expect(html).not.toContain("Latest month");
  });

  it("unresolved mining block -> DataUnavailable", async () => {
    const { mining } = await fixtures();
    const html = renderToStaticMarkup(
      <MiningPulsePanel mining={{ ...mining, mining: { status: "UNAVAILABLE", value: null } }} />,
    );
    expect(html).toMatch(/Mining pulse unavailable/i);
  });
});

describe("ReserveHealthPanel (D4)", () => {
  it("renders reserve KPIs, runway, and BTC in reserve from view-model fields", async () => {
    const { btc } = await fixtures();
    const html = renderToStaticMarkup(<ReserveHealthPanel btc={btc} />);
    expect(html).toContain("Reserve health");
    expect(html).toContain("$2,779,000");
    expect(html).toContain("14 months covered");
    expect(html).toContain("6.12 BTC");
    expect(html).toContain("Simulated");
    expect(html).toContain("Healthy");
  });

  it("compact density keeps reserve + runway + BTC row", async () => {
    const { btc } = await fixtures();
    const html = renderToStaticMarkup(<ReserveHealthPanel btc={btc} density="compact" />);
    expect(html).toContain("$2,779,000");
    expect(html).toContain("6.12 BTC");
    expect(html).not.toContain("Healthy");
  });

  it("unresolved reserve block -> DataUnavailable", async () => {
    const { btc } = await fixtures();
    const unresolved: BtcViewModel = { ...btc, reserve: { status: "UNAVAILABLE", value: null } };
    const html = renderToStaticMarkup(<ReserveHealthPanel btc={unresolved} />);
    expect(html).toMatch(/Reserve health unavailable/i);
  });
});

describe("StrategyCompositionPanel (D3)", () => {
  it("shows actual vs target with discreet pp deltas when actualBps is indexed", async () => {
    const { dashboard } = await fixtures();
    const html = renderToStaticMarkup(
      <StrategyCompositionPanel pockets={dashboard.allocation.value?.pockets ?? null} />,
    );
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

describe("AnalystNotePanel (D6)", () => {
  it("wires the view model: summary quote, real timestamp, active experts — no 'Just now'", async () => {
    const { aiExperts } = await fixtures();
    const html = renderToStaticMarkup(<AnalystNotePanel aiExperts={aiExperts} />);
    expect(html).toContain("Portfolio insight");
    expect(html).toContain("take-profit band"); // lastSignalSummary from the view model
    expect(html).toContain("Jul 16, 2026"); // lastSignalAt, formatted — not fabricated
    expect(html).toContain("4 experts active");
    expect(html).toContain("Ask the strategist");
    // CTA opens the chat rail via the shell's own store — no more dead
    // `?chat=open` query param link (nothing ever consumed it).
    expect(html).not.toContain("chat=open");
    expect(html).toContain("<button");
    expect(html).not.toContain("Just now");
    expect(html).toContain("Simulated");
  });

  it("bitcoin variant titles the BTC analyst", async () => {
    const { aiExperts } = await fixtures();
    const html = renderToStaticMarkup(<AnalystNotePanel aiExperts={aiExperts} variant="bitcoin" />);
    expect(html).toContain("Bitcoin Reserve Analyst");
  });

  it("view model without summary -> role fixture fallback WITHOUT a fabricated timestamp", () => {
    const vm: AiExpertResolvedViewModel = {
      status: "FIXTURE",
      value: { activeExperts: null, lastSignalAt: null, lastSignalSummary: null },
    };
    const html = renderToStaticMarkup(<AnalystNotePanel aiExperts={vm} />);
    expect(html).toContain("Allocation sits within 1pp of target"); // portfolio-strategist insight
    expect(html).not.toContain("Signal ");
    expect(html).not.toContain("Just now");
  });

  it("unavailable -> DataUnavailable", () => {
    const vm: AiExpertResolvedViewModel = { status: "UNAVAILABLE", value: null };
    const html = renderToStaticMarkup(<AnalystNotePanel aiExperts={vm} />);
    expect(html).toMatch(/Portfolio insight unavailable/i);
  });
});

describe("compliance — shared panels never speak yield/APY/promises", () => {
  it("full render sweep stays clean", async () => {
    const { mining, btc, aiExperts, dashboard } = await fixtures();
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
        <MiningPulsePanel mining={mining} monthlyProduction={points} />
        <ReserveHealthPanel btc={btc} />
        <StrategyCompositionPanel pockets={dashboard.allocation.value?.pockets ?? null} />
        <AnalystNotePanel aiExperts={aiExperts} variant="bitcoin" />
      </>,
    );
    expect(html).not.toMatch(FORBIDDEN_COPY);
  });
});
