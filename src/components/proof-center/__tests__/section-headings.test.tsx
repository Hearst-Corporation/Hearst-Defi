import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EventTimeline } from "@/components/proof-center/event-timeline";
import { MiningCashFlowEvidence } from "@/components/proof-center/mining-cashflow-evidence";
import { ProofCenterCardHeader } from "@/components/proof-center/proof-center-card-header";

import { freshEvent } from "./fixtures";

describe("Proof Center — section heading contract", () => {
  it("ProofCenterCardHeader sectionLed drops eyebrow and keeps card title as h3", () => {
    const html = renderToStaticMarkup(
      <ProofCenterCardHeader
        sectionLed
        eyebrow="Proof of Reserves"
        title="Awaiting first attestation"
        tone="quiet"
      />,
    );

    expect(html).toContain('class="h3 ');
    expect(html).not.toContain('class="eyebrow"');
    expect(html).toContain("Awaiting first attestation");
  });

  it("MiningCashFlowEvidence sectionLed omits section eyebrow from card chrome", () => {
    const html = renderToStaticMarkup(
      <MiningCashFlowEvidence coverage={null} sectionLed />,
    );

    expect(html).toContain('class="h3 ');
    expect(html).toContain("Yield source — Bitcoin mining revenue");
    expect(html).not.toMatch(/<p class="eyebrow">Mining cash-flow evidence<\/p>/);
  });

  it("EventTimeline sectionLed shortens populated card title", () => {
    const html = renderToStaticMarkup(
      <EventTimeline events={[freshEvent()]} sectionLed />,
    );

    expect(html).toContain("Last 1 events");
    expect(html).not.toContain("On-chain event log — last");
  });
});
