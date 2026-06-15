import { describe, expect, it } from "vitest";

import {
  computeNavDelta,
  resolveProofProvenance,
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
});
