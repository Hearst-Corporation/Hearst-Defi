import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Series1ProofEventStepper } from "@/components/proof-center/series1-proof-event-stepper";
import type {
  Series1ProofEventNodeModel,
  Series1ProofStepperState,
} from "@/lib/proof-center/series1-event-stepper";

function node(overrides: Partial<Series1ProofEventNodeModel> = {}): Series1ProofEventNodeModel {
  return {
    id: "evt-1",
    eventName: "Deposit",
    displayLabel: "Capital in",
    description: "Investor subscription — USDC deposited, shares minted.",
    isKnownEventType: true,
    status: "indexed",
    blockNumber: "100",
    txHash: "0x000000000000000000000000000000000000000000000000000000000000aa",
    logIndex: 0,
    investorAddress: null,
    assetAmountAtomic: null,
    shareAmountAtomic: null,
    occurredAt: "2026-07-01T00:00:00.000Z",
    indexedAt: "2026-07-01T00:05:00.000Z",
    chainId: 8453,
    contractAddress: "0x000000000000000000000000000000000000aa",
    provenance: { networkKind: "mainnet", label: "Mainnet" },
    ...overrides,
  };
}

describe("Series1ProofEventStepper", () => {
  it("renders indexed real events as a stepper", () => {
    const state: Series1ProofStepperState = { envelopeStatus: "live", events: [node()] };
    const html = renderToStaticMarkup(<Series1ProofEventStepper state={state} />);
    expect(html).toContain("Capital in");
    expect(html).toContain("Deposit");
    expect(html).toContain("indexed");
  });

  it("LIVE + empty → empty state, not a crash, not a fake row", () => {
    const state: Series1ProofStepperState = { envelopeStatus: "empty", events: [] };
    const html = renderToStaticMarkup(<Series1ProofEventStepper state={state} />);
    expect(html).toContain("No events indexed yet.");
  });

  it("UNAVAILABLE → unavailable state, distinct wording from empty", () => {
    const state: Series1ProofStepperState = { envelopeStatus: "unavailable", events: [] };
    const html = renderToStaticMarkup(<Series1ProofEventStepper state={state} />);
    expect(html).toContain("Indexer unreachable.");
    expect(html).not.toContain("No events indexed yet.");
  });

  it("NOT_CONFIGURED (genuine) → not-configured wording", () => {
    const state: Series1ProofStepperState = {
      envelopeStatus: "not_configured",
      notConfiguredReason: "not_configured",
      events: [],
    };
    const html = renderToStaticMarkup(<Series1ProofEventStepper state={state} />);
    expect(html).toContain("No indexer configured for this deployment yet.");
  });

  it("SIMULATED-rejected → 'not accepted as proof' wording, never rendered as live", () => {
    const state: Series1ProofStepperState = {
      envelopeStatus: "not_configured",
      notConfiguredReason: "simulated_rejected",
      events: [],
    };
    const html = renderToStaticMarkup(<Series1ProofEventStepper state={state} />);
    expect(html).toContain("Preview / simulated data is not accepted as proof.");
  });

  it("chainId 31337 → 'Fork preprod' badge visible, never presented as mainnet", () => {
    const state: Series1ProofStepperState = {
      envelopeStatus: "live",
      events: [node({ provenance: { networkKind: "preprod_fork", label: "Fork preprod" } })],
    };
    const html = renderToStaticMarkup(<Series1ProofEventStepper state={state} />);
    expect(html).toContain("Fork preprod");
    expect(html).not.toContain(">Mainnet<");
  });

  it("unexpected chainId → 'Network mismatch' badge visible, event still rendered", () => {
    const state: Series1ProofStepperState = {
      envelopeStatus: "live",
      events: [node({ provenance: { networkKind: "network_mismatch", label: "Network mismatch" } })],
    };
    const html = renderToStaticMarkup(<Series1ProofEventStepper state={state} />);
    expect(html).toContain("Network mismatch");
    expect(html).toContain("Capital in"); // the event itself is not hidden/replaced by an error
  });

  it("unknown eventName → generic label, 'Uncatalogued type' flag, no crash", () => {
    const state: Series1ProofStepperState = {
      envelopeStatus: "live",
      events: [
        node({
          eventName: "SomeFutureEvent",
          displayLabel: "On-chain event",
          description: "Indexed on-chain event, type not yet catalogued.",
          isKnownEventType: false,
        }),
      ],
    };
    const html = renderToStaticMarkup(<Series1ProofEventStepper state={state} />);
    expect(html).toContain("On-chain event");
    expect(html).toContain("SomeFutureEvent");
    expect(html).toContain("Uncatalogued type");
  });

  it("occurredAt null → shows 'Not reported', still surfaces indexedAt as technical time", () => {
    const state: Series1ProofStepperState = {
      envelopeStatus: "live",
      events: [node({ occurredAt: null, indexedAt: "2026-07-01T00:05:00.000Z" })],
    };
    const html = renderToStaticMarkup(<Series1ProofEventStepper state={state} />);
    expect(html).toContain("Not reported");
    expect(html).toContain("2026-07-01T00:05:00.000Z");
  });
});
