import { describe, expect, it } from "vitest";

import {
  series1ProofStepperErrorState,
  toSeries1ProofStepperState,
  toSeries1ProofStepperStateFromEnvelope,
} from "../series1-event-stepper";
import type { Series1EventSummary } from "@/lib/backend";
import type { DataStatus } from "@/lib/backend";

function event(overrides: Partial<Series1EventSummary> = {}): Series1EventSummary {
  return {
    id: "evt-1",
    eventName: "Deposit",
    chainId: 8453,
    contractAddress: "0x000000000000000000000000000000000000aa",
    blockNumber: "100",
    txHash: "0x000000000000000000000000000000000000000000000000000000000000aa",
    logIndex: 0,
    investorAddress: null,
    assetAmountAtomic: null,
    shareAmountAtomic: null,
    occurredAt: "2026-07-01T00:00:00.000Z",
    indexedAt: "2026-07-01T00:05:00.000Z",
    ...overrides,
  };
}

function resolved(status: DataStatus, value: readonly Series1EventSummary[] | null) {
  return { status, value };
}

describe("toSeries1ProofStepperState", () => {
  it("LIVE + events > 0 → live, mapped and sorted", () => {
    const state = toSeries1ProofStepperState(resolved("LIVE", [event({ id: "a" })]));
    expect(state.envelopeStatus).toBe("live");
    expect(state.events).toHaveLength(1);
    expect(state.events[0]!.status).toBe("indexed");
  });

  it("LIVE + [] → empty", () => {
    const state = toSeries1ProofStepperState(resolved("LIVE", []));
    expect(state.envelopeStatus).toBe("empty");
    expect(state.events).toHaveLength(0);
  });

  it("NOT_CONFIGURED → not_configured with reason not_configured", () => {
    const state = toSeries1ProofStepperState(resolved("NOT_CONFIGURED", null));
    expect(state.envelopeStatus).toBe("not_configured");
    expect(state.notConfiguredReason).toBe("not_configured");
    expect(state.events).toHaveLength(0);
  });

  it("envelope meta.status SIMULATED → not_configured with reason simulated_rejected, never live", () => {
    // SIMULATED lives on the envelope's meta.status (EnvelopeStatus), one
    // level above Resolved<T>.status (DataStatus) — even if the resolved
    // value carries real-looking rows, a SIMULATED envelope must reject them.
    const state = toSeries1ProofStepperStateFromEnvelope("SIMULATED", resolved("LIVE", [event()]));
    expect(state.envelopeStatus).toBe("not_configured");
    expect(state.notConfiguredReason).toBe("simulated_rejected");
    // The simulated event must never leak into the rendered list.
    expect(state.events).toHaveLength(0);
  });

  it("UNAVAILABLE → unavailable", () => {
    const state = toSeries1ProofStepperState(resolved("UNAVAILABLE", null));
    expect(state.envelopeStatus).toBe("unavailable");
    expect(state.events).toHaveLength(0);
  });

  it("transport error → error with detail", () => {
    const state = series1ProofStepperErrorState("fetch failed: ECONNREFUSED");
    expect(state.envelopeStatus).toBe("error");
    expect(state.errorDetail).toBe("fetch failed: ECONNREFUSED");
  });

  it("sorts by blockNumber asc, then logIndex asc — not by array order", () => {
    const state = toSeries1ProofStepperState(
      resolved("LIVE", [
        event({ id: "c", blockNumber: "300", logIndex: 0 }),
        event({ id: "a", blockNumber: "100", logIndex: 1 }),
        event({ id: "b", blockNumber: "100", logIndex: 0 }),
      ]),
    );
    expect(state.events.map((e) => e.id)).toEqual(["b", "a", "c"]);
  });

  it("chainId 31337 → preprod_fork provenance", () => {
    const state = toSeries1ProofStepperState(resolved("LIVE", [event({ chainId: 31337 })]));
    expect(state.events[0]!.provenance).toEqual({ networkKind: "preprod_fork", label: "Fork preprod" });
  });

  it("unexpected chainId (neither 31337 nor mainnet) → network_mismatch, event still rendered", () => {
    const state = toSeries1ProofStepperState(resolved("LIVE", [event({ chainId: 999999 })]));
    expect(state.events).toHaveLength(1);
    expect(state.events[0]!.provenance.networkKind).toBe("network_mismatch");
  });

  it("unknown eventName → rendered generic, isKnownEventType false, no throw", () => {
    const state = toSeries1ProofStepperState(resolved("LIVE", [event({ eventName: "SomeFutureEvent" })]));
    expect(state.events).toHaveLength(1);
    expect(state.events[0]!.isKnownEventType).toBe(false);
    expect(state.events[0]!.displayLabel).toBe("On-chain event");
  });

  it("occurredAt null → carried as null, never backfilled from indexedAt", () => {
    const state = toSeries1ProofStepperState(
      resolved("LIVE", [event({ occurredAt: null, indexedAt: "2026-07-01T00:05:00.000Z" })]),
    );
    expect(state.events[0]!.occurredAt).toBeNull();
    expect(state.events[0]!.indexedAt).toBe("2026-07-01T00:05:00.000Z");
  });
});
