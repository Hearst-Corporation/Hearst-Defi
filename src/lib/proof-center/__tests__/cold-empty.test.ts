import { describe, expect, it } from "vitest";

import { isProofCenterColdEmpty } from "@/lib/proof-center/cold-empty";

describe("isProofCenterColdEmpty", () => {
  const cold = {
    demo: false,
    hasAttestation: false,
    proofsCount: 0,
    onChainEventsCount: 0,
    distributionsCount: 0,
    rebalancesCount: 0,
    timelockCount: 0,
  };

  it("is true when every artefact bucket is empty", () => {
    expect(isProofCenterColdEmpty(cold)).toBe(true);
  });

  it("is false for demo sandbox", () => {
    expect(isProofCenterColdEmpty({ ...cold, demo: true })).toBe(false);
  });

  it("is false when any artefact exists", () => {
    expect(isProofCenterColdEmpty({ ...cold, onChainEventsCount: 1 })).toBe(false);
    expect(isProofCenterColdEmpty({ ...cold, hasAttestation: true })).toBe(false);
  });
});
