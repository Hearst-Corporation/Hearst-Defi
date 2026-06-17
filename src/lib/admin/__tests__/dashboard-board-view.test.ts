import { describe, expect, it } from "vitest";

import {
  computeNavDelta,
  resolveChartProvenance,
  resolveOperatorQueueProvenance,
  resolveProofProvenance,
  resolveRiskProvenance,
  resolveVaultSignalProvenance,
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

  it("resolveChartProvenance mirrors allocation and NAV gates", () => {
    expect(resolveChartProvenance(false, true)).toBe("live");
    expect(resolveChartProvenance(false, false)).toBe("manual");
    expect(resolveChartProvenance(true, true)).toBe("simulated");
    expect(resolveChartProvenance(true, false)).toBe("simulated");
  });

  it("resolveVaultSignalProvenance covers APY and Mining (livePreview → estimated)", () => {
    expect(resolveVaultSignalProvenance(true, false)).toBe("live");
    expect(resolveVaultSignalProvenance(false, true)).toBe("estimated");
    expect(resolveVaultSignalProvenance(false, false)).toBe("manual");
    expect(resolveVaultSignalProvenance(false, true, true)).toBe("simulated");
  });

  describe("vault-scope provenance (FixtureVaultPills / livePreview)", () => {
    it("preview fixture: vault signals estimated, risk/charts manual", () => {
      const livePreview = true;
      const hasLiveKpis = false;
      expect(resolveVaultSignalProvenance(hasLiveKpis, livePreview)).toBe("estimated");
      expect(resolveRiskProvenance(hasLiveKpis, RISK_DB)).toBe("manual");
      expect(resolveChartProvenance(false, false)).toBe("manual");
    });

    it("live yield fixture: vault signals share live provenance", () => {
      const hasLiveKpis = true;
      expect(resolveVaultSignalProvenance(hasLiveKpis, false)).toBe("live");
      expect(resolveRiskProvenance(hasLiveKpis, RISK_DB)).toBe("live");
      expect(resolveChartProvenance(false, true)).toBe("live");
    });
  });

  it("resolveOperatorQueueProvenance never badges platform queue as vault-live", () => {
    expect(resolveOperatorQueueProvenance(0)).toBe("manual");
    expect(resolveOperatorQueueProvenance(2)).toBe("partial");
    expect(resolveOperatorQueueProvenance(2, false, true, false)).toBe("partial");
    expect(resolveOperatorQueueProvenance(2, false, false, true)).toBe("manual");
    expect(resolveOperatorQueueProvenance(2, true)).toBe("simulated");
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
