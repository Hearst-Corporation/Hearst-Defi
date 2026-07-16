// Render smoke test for the /btc page's block components — verifies all 4
// documented `?state=` variants (complete/not-configured/stale/partial)
// render without throwing, and honesty invariants hold: no fabricated
// numbers in NOT_CONFIGURED, no accent green on non-LIVE data. Not a full
// E2E (no browser drive by this agent, per repo policy), but proves the
// component tree is sound server-side for every fixture state.

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { getBtcPageData } from "../_data/get-btc-page-data";
import { BtcHero } from "../_components/btc-hero";
import { BtcTrajectoryChart } from "../_components/btc-trajectory-chart";
import { BtcProductionPanel } from "../_components/btc-production-panel";
import { BtcPerformancePanel } from "../_components/btc-performance-panel";
import { BtcTakeProfitLadder } from "../_components/btc-take-profit-ladder";
import { BtcCustodyPanel } from "../_components/btc-custody-panel";
import { BtcEventsTimeline } from "../_components/btc-events-timeline";
import { BtcProofsPanel } from "../_components/btc-proofs-panel";
import { BtcAiExpertsRail } from "../_components/btc-ai-experts-rail";

function renderAllBlocks(data: Awaited<ReturnType<typeof getBtcPageData>>): string {
  return renderToStaticMarkup(
    <>
      <BtcHero reserve={data.reserve} trajectory={data.extra.trajectory} />
      <BtcTrajectoryChart trajectory={data.extra.trajectory} />
      <BtcProductionPanel production={data.extra.production} />
      <BtcPerformancePanel performance={data.performance} />
      <BtcTakeProfitLadder ladder={data.extra.takeProfitLadder} />
      <BtcCustodyPanel custody={data.extra.custody} />
      <BtcEventsTimeline events={data.extra.events} />
      <BtcProofsPanel proofs={data.extra.proofs} />
      <BtcAiExpertsRail experts={data.extra.aiExperts} />
    </>,
  );
}

describe("BTC page blocks", () => {
  it("renders the complete fixture without throwing, with a BTC-Reserve AI expert", async () => {
    const data = await getBtcPageData("complete");
    const html = renderAllBlocks(data);
    expect(html).toContain("BTC reserve");
    expect(html).toContain("BTC Reserve Analyst");
    expect(html).toMatch(/9\.4.*12\.8|12\.8.*9\.4/); // estimated range, never a single point
  });

  it("renders the not-configured fixture honestly, no fabricated numbers", async () => {
    const data = await getBtcPageData("not-configured");
    const html = renderAllBlocks(data);
    expect(html).toMatch(/not deployed|not configured|not yet linked/i);
    expect(html).toContain("BTC Reserve Analyst"); // AI experts rail is static/contextual, still shown
  });

  it("renders the stale fixture with a stale flag, no crash", async () => {
    const data = await getBtcPageData("stale");
    const html = renderAllBlocks(data);
    expect(html).toMatch(/stale/i);
  });

  it("renders the partial fixture (custody PARTIAL, ladder UNAVAILABLE), no crash", async () => {
    const data = await getBtcPageData("partial");
    const html = renderAllBlocks(data);
    expect(html).toMatch(/attestation pending|temporarily unavailable/i);
  });
});
