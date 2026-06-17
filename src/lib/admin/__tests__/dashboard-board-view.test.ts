import { describe, expect, it } from "vitest";

import {
  computeNavDelta,
  resolveAllocationProvenance,
  resolveApyProvenance,
  resolveMiningProvenance,
  resolveNavProvenance,
  resolveOperatorQueueCount,
  resolveProofProvenance,
  resolveRiskProvenance,
} from "@/lib/admin/dashboard-board-view";
import type { AdminProofStatus } from "@/lib/data/admin-overview";
import type { RiskFrameworkData } from "@/lib/data/risk-framework";

const RISK_DB: RiskFrameworkData = {
  composite: 47,
  band: "medium",
  bandLabel: "Moderate",
  dimensions: [],
  source: "db",
};

const RISK_PARTIAL: RiskFrameworkData = {
  ...RISK_DB,
  source: "partial",
};

const RISK_FALLBACK: RiskFrameworkData = {
  composite: 0,
  band: "low",
  bandLabel: "Awaiting data",
  dimensions: [],
  source: "fallback",
};

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
  it("resolveRiskProvenance gates on hasLiveKpis before risk.source", () => {
    expect(resolveRiskProvenance(false, RISK_DB)).toBe("manual");
    expect(resolveRiskProvenance(true, RISK_DB)).toBe("live");
    expect(resolveRiskProvenance(true, RISK_PARTIAL)).toBe("partial");
    expect(resolveRiskProvenance(false, RISK_FALLBACK)).toBe("manual");
    expect(resolveRiskProvenance(false, RISK_DB, true)).toBe("simulated");
  });

  it("resolveNavProvenance mirrors allocation (manual when not live)", () => {
    expect(resolveNavProvenance(false, true)).toBe("live");
    expect(resolveNavProvenance(false, false)).toBe("manual");
    expect(resolveNavProvenance(true, true)).toBe("simulated");
  });

  it("resolveAllocationProvenance matches nav gates", () => {
    expect(resolveAllocationProvenance(false, true)).toBe("live");
    expect(resolveAllocationProvenance(false, false)).toBe("manual");
    expect(resolveAllocationProvenance(true, false)).toBe("simulated");
  });

  it("resolveMiningProvenance mirrors APY (livePreview → estimated)", () => {
    expect(resolveMiningProvenance(true, false)).toBe("live");
    expect(resolveMiningProvenance(false, true)).toBe("estimated");
    expect(resolveMiningProvenance(false, false)).toBe("manual");
    expect(resolveMiningProvenance(false, true, true)).toBe("simulated");
  });

  it("resolveOperatorQueueCount mirrors cockpit.actionQueue length", () => {
    expect(resolveOperatorQueueCount([])).toBe(0);
    expect(
      resolveOperatorQueueCount([
        {
          id: "a",
          type: "oracle.stale",
          severity: "P0",
          title: "Oracle",
          context: "stale",
          createdAt: "2026-06-01T00:00:00.000Z",
        },
        {
          id: "b",
          type: "kyc.review",
          severity: "P1",
          title: "KYC",
          context: "review",
          createdAt: "2026-06-01T00:00:00.000Z",
        },
      ]),
    ).toBe(2);
  });

  describe("vault-scope provenance (FixtureVaultPills / livePreview)", () => {
    it("preview fixture: APY + Mining estimated, risk/charts manual", () => {
      const livePreview = true;
      const hasLiveKpis = false;
      expect(resolveApyProvenance(hasLiveKpis, livePreview)).toBe("estimated");
      expect(resolveMiningProvenance(hasLiveKpis, livePreview)).toBe("estimated");
      expect(resolveRiskProvenance(hasLiveKpis, RISK_DB)).toBe("manual");
      expect(resolveAllocationProvenance(false, false)).toBe("manual");
      expect(resolveNavProvenance(false, false)).toBe("manual");
    });

    it("live yield fixture: vault signals share live provenance", () => {
      const hasLiveKpis = true;
      expect(resolveApyProvenance(hasLiveKpis, false)).toBe("live");
      expect(resolveMiningProvenance(hasLiveKpis, false)).toBe("live");
      expect(resolveRiskProvenance(hasLiveKpis, RISK_DB)).toBe("live");
      expect(resolveAllocationProvenance(false, true)).toBe("live");
      expect(resolveNavProvenance(false, true)).toBe("live");
    });
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
});
