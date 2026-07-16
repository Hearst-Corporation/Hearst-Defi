// Render smoke test for PROMPT 227 /btc page widgets.

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { getBtcPageData } from "../_data/get-btc-page-data";
import { HeroPanel } from "@/features/investor-ui/components/widgets/hero-panel";
import { AccumulationChartPanel } from "@/features/investor-ui/components/accumulation-chart-panel";
import { DashboardStrategyPanel } from "../../dashboard/_components/dashboard-strategy-panel";
import { DashboardHealthPanel } from "../../dashboard/_components/dashboard-health-panel";
import { VerifiedActivityPanel } from "../../dashboard/_components/verified-activity-panel";
import { PortfolioInsightPanel } from "../../dashboard/_components/portfolio-insight-panel";
import { ContextualProofPanel } from "@/features/investor-ui/components/widgets/contextual-proof-panel";

import { buildAccumulationSeries } from "../../dashboard/_data/accumulation-series";
import { getFixtureInvestorUiDataSource } from "@/features/investor-ui/data-source";
import { toProvenance, formatBtcAmount } from "../_data/format-btc";

async function renderBtcWidgets(state?: string) {
  const data = await getBtcPageData(state);
  const mining = await getFixtureInvestorUiDataSource().getMining();
  const aiExperts = await getFixtureInvestorUiDataSource().getAiExperts();
  const dashboard = await getFixtureInvestorUiDataSource().getDashboard();

  return renderToStaticMarkup(
    <>
      <HeroPanel
        title="BTC accumulated"
        mainValue="0.150000 BTC"
        provenance={toProvenance(data.reserve.status)}
        metrics={[
          { label: "Mining-produced", value: "0.100000 BTC" },
          { label: "Strategic exposure", value: "0.050000 BTC" },
        ]}
      />
      <AccumulationChartPanel
        points={buildAccumulationSeries(data.extra.production.value?.monthly)}
        currentMonth={9}
        totalMonths={24}
        provenance={toProvenance(data.reserve.status)}
      />
      <DashboardStrategyPanel pockets={dashboard.allocation.value?.pockets ?? null} mining={mining} />
      <DashboardHealthPanel mining={mining} btc={data} />
      <VerifiedActivityPanel activity={dashboard.activity} alerts={dashboard.alerts} proofs={dashboard.proofs} />
      <ContextualProofPanel items={(data.extra.proofs.value ?? []).map((p) => ({ label: p.label, lastVerified: "Jul 1", href: p.href }))} />
      <PortfolioInsightPanel aiExperts={aiExperts} variant="bitcoin" />
    </>
  );
}

describe("Bitcoin page widgets (PROMPT 227)", () => {
  it("renders complete fixture without yield/APY copy", async () => {
    const html = await renderBtcWidgets("complete");
    expect(html).toContain("BTC accumulated");
    expect(html).toContain("Strategy composition");
    expect(html).toContain("Bitcoin Reserve Analyst");
    expect(html).not.toMatch(/\bestimated return\b|\bapy\b|\byield\b/i);
  });

  it("renders not-configured with empty accumulation history", async () => {
    const html = await renderBtcWidgets("not-configured");
    expect(html).toMatch(/Accumulation history will appear/i);
  });
});
