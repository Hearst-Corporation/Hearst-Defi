// Render smoke test for PROMPT 227 /btc page widgets.

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { getBtcPageData } from "../_data/get-btc-page-data";
import {
  BitcoinOrbit,
  AccumulationFlowCanvas,
  AccumulationChart,
  OperationalStatusStrip,
  ContextualProof,
  AiInsightWidget,
} from "@/components/investor-widgets";
import { buildAccumulationSeries } from "../../dashboard/_data/accumulation-series";
import { getFixtureInvestorUiDataSource } from "@/features/investor-ui/data-source";
import { toProvenance, formatBtcAmount, satsToBtcString } from "../_data/format-btc";

async function renderBtcWidgets(state?: string) {
  const data = await getBtcPageData(state);
  const mining = await getFixtureInvestorUiDataSource().getMining();
  const aiExperts = await getFixtureInvestorUiDataSource().getAiExperts();
  const totalBtc =
    data.reserve.value?.reserveBtcSats != null
      ? formatBtcAmount(satsToBtcString(data.reserve.value.reserveBtcSats))
      : null;

  return renderToStaticMarkup(
    <>
      <BitcoinOrbit progressPct={37.5} />
      <AccumulationFlowCanvas miningBtc="0.10 BTC" strategicBtc="0.05 BTC" totalBtc={totalBtc} />
      <AccumulationChart
        points={buildAccumulationSeries(data.extra.production.value?.monthly)}
        currentMonth={9}
        totalMonths={24}
        provenance={toProvenance(data.reserve.status)}
      />
      <OperationalStatusStrip mining={mining} btc={data} />
      <ContextualProof items={(data.extra.proofs.value ?? []).map((p) => ({ label: p.label, lastVerified: "Jul 1", href: p.href }))} />
      <AiInsightWidget aiExperts={aiExperts} variant="bitcoin" />
    </>,
  );
}

describe("Bitcoin page widgets (PROMPT 227)", () => {
  it("renders complete fixture without yield/APY copy", async () => {
    const html = await renderBtcWidgets("complete");
    expect(html).toContain("₿");
    expect(html).toContain("Accumulation sources");
    expect(html).toContain("Bitcoin Reserve Analyst");
    expect(html).not.toMatch(/\bestimated return\b|\bapy\b|\byield\b/i);
  });

  it("renders not-configured with empty accumulation history", async () => {
    const html = await renderBtcWidgets("not-configured");
    expect(html).toMatch(/Accumulation history will appear/i);
  });
});
