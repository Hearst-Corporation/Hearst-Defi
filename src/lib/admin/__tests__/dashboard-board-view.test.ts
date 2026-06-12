import { describe, expect, it } from "vitest";

import {
  computeNavDelta,
  isProofSlotEmpty,
  resolveProofProvenance,
  riskSeverityTone,
} from "@/lib/admin/dashboard-board-view";
import type { AdminProofStatus } from "@/lib/data/admin-overview";

const EMPTY_PROOF: AdminProofStatus = {
  lastMiningAttestationAt: null,
  miningFreshness: "stale",
  attestationsCount: 0,
  proofsTotal: 0,
  custodyConfigured: false,
  custodyProvenance: "manual",
  custodyReservesUsdc: 0,
};

describe("dashboard-board-view", () => {
  it("isProofSlotEmpty is true only when all proof signals are absent", () => {
    expect(isProofSlotEmpty(EMPTY_PROOF)).toBe(true);
    expect(
      isProofSlotEmpty({ ...EMPTY_PROOF, proofsTotal: 1 }),
    ).toBe(false);
  });

  it("resolveProofProvenance maps freshness to attested / stale / manual", () => {
    expect(resolveProofProvenance(true, EMPTY_PROOF)).toBe("attested");
    expect(
      resolveProofProvenance(false, { ...EMPTY_PROOF, attestationsCount: 2 }),
    ).toBe("stale");
    expect(resolveProofProvenance(false, EMPTY_PROOF)).toBe("manual");
  });

  it("computeNavDelta returns null for invalid baselines", () => {
    expect(computeNavDelta(100, 0)).toBeNull();
    expect(computeNavDelta(null, 50)).toBeNull();
  });

  it("riskSeverityTone maps dimension severity", () => {
    expect(riskSeverityTone("high")).toBe("danger");
    expect(riskSeverityTone("medium")).toBe("warning");
    expect(riskSeverityTone("low")).toBe("success");
  });
});
