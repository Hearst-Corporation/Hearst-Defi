import { describe, expect, it } from "vitest";

import { buildDashboardKpiStrip } from "@/lib/admin/dashboard-kpi-strip";
import type { AdminProofStatus } from "@/lib/data/admin-overview";
import type { DashboardData } from "@/lib/data/dashboard";
import type { RiskFrameworkData } from "@/lib/data/risk-framework";

const RISK: RiskFrameworkData = {
  composite: 0,
  band: "low",
  bandLabel: "Low",
  dimensions: [],
  source: "partial",
};

const PROOF_WITH_ATTESTATION: AdminProofStatus = {
  lastMiningAttestationAt: new Date("2026-06-12T00:00:00Z"),
  miningFreshness: "live",
  attestationsCount: 1,
  proofsTotal: 1,
  custodyConfigured: false,
  custodyProvenance: "manual",
  custodyReservesUsdc: 0,
};

const PROOF_EMPTY: AdminProofStatus = {
  lastMiningAttestationAt: null,
  miningFreshness: "stale",
  attestationsCount: 0,
  proofsTotal: 0,
  custodyConfigured: false,
  custodyProvenance: "manual",
  custodyReservesUsdc: 0,
};

const DATA_STUB: Pick<DashboardData, "miningOps" | "vaultMeta"> = {
  miningOps: {
    hashrate_ph_s: 0,
    uptime_pct: 0,
    margin_score: 0,
    attestations_count: 0,
    hashprice: null,
    is_fallback: true,
  },
  vaultMeta: {
    id: "yield",
    name: "Hearst Yield Vault",
    apyTarget: { low: 8, high: 15 },
    allocationTargets: { mining: 40, btc_tactical: 0, usdc_base: 60, stable_reserve: 0 },
    assumptions: [],
    livePreview: false,
  },
};

function buildKpis(opts: {
  proofFresh: boolean;
  proof: AdminProofStatus;
  simulated?: boolean;
  risk?: RiskFrameworkData;
  miningMarginScore?: number;
}) {
  return buildDashboardKpiStrip({
    headlineApy: null,
    yieldPosture: "awaiting first snapshot",
    apyProvenance: opts.simulated ? "simulated" : "manual",
    risk: opts.risk ?? RISK,
    riskProvenance: opts.simulated ? "simulated" : "manual",
    miningMarginScore: opts.miningMarginScore ?? 0,
    miningProvenance: opts.simulated ? "simulated" : "manual",
    proofFresh: opts.proofFresh,
    proofProvenance: opts.proofFresh ? "attested" : opts.proof.attestationsCount > 0 ? "stale" : "manual",
    proof: opts.proof,
    operatorQueueCount: 0,
    operatorQueueProvenance: "manual",
    data: DATA_STUB as DashboardData,
  });
}

function proofKpi(kpis: ReturnType<typeof buildKpis>) {
  return kpis.find((k) => k.label === "Proof")!;
}

describe("buildDashboardKpiStrip", () => {
  it("renders five strip rows without a capital cell", () => {
    const kpis = buildKpis({ proofFresh: false, proof: PROOF_EMPTY });
    expect(kpis.map((k) => k.label)).toEqual([
      "APY",
      "Risk",
      "Mining",
      "Proof",
      "Operator queue",
    ]);
  });
});

describe("Proof KPI value — seed honesty", () => {
  it('seed context with attestation rows shows "Stale" with attestation sublabel', () => {
    const kpis = buildKpis({ proofFresh: false, proof: PROOF_WITH_ATTESTATION });
    expect(proofKpi(kpis).value).toBe("Stale");
    expect(proofKpi(kpis).provenance).toBe("stale");
    expect(proofKpi(kpis).sublabel).toContain("Last Jun 12");
  });

  it('seed context with no attestation shows "Pending"', () => {
    const kpis = buildKpis({ proofFresh: false, proof: PROOF_EMPTY });
    expect(proofKpi(kpis).value).toBe("Pending");
  });

  it('live context + fresh proof shows "Current"', () => {
    const kpis = buildKpis({ proofFresh: true, proof: PROOF_WITH_ATTESTATION });
    expect(proofKpi(kpis).value).toBe("Current");
    expect(proofKpi(kpis).provenance).toBe("attested");
  });

  it('live context + stale proof shows "Stale"', () => {
    const kpis = buildKpis({ proofFresh: false, proof: PROOF_WITH_ATTESTATION });
    expect(proofKpi(kpis).value).toBe("Stale");
  });

  it('live context + no proof shows "Pending"', () => {
    const kpis = buildKpis({ proofFresh: false, proof: PROOF_EMPTY });
    expect(proofKpi(kpis).value).toBe("Pending");
  });
});

function riskKpi(kpis: ReturnType<typeof buildKpis>) {
  return kpis.find((k) => k.label === "Risk")!;
}

function miningKpi(kpis: ReturnType<typeof buildKpis>) {
  return kpis.find((k) => k.label === "Mining")!;
}

const RISK_SIM: RiskFrameworkData = {
  composite: 38,
  band: "low",
  bandLabel: "Low",
  dimensions: [],
  source: "partial",
};

describe("Risk / Mining KPI values — demo (simulated) fill", () => {
  it("seed context still renders Risk/Mining values when scores exist", () => {
    const kpis = buildKpis({
      proofFresh: false,
      proof: PROOF_EMPTY,
      risk: RISK_SIM,
      miningMarginScore: 64,
    });
    expect(riskKpi(kpis).value).toBe("38/100");
    expect(miningKpi(kpis).value).toBe("64/100");
  });

  it("simulated context fills Risk and Mining values", () => {
    const kpis = buildKpis({
      proofFresh: false,
      proof: PROOF_EMPTY,
      simulated: true,
      risk: RISK_SIM,
      miningMarginScore: 64,
    });
    expect(riskKpi(kpis).value).toBe("38/100");
    expect(miningKpi(kpis).value).toBe("64/100");
  });

  it("simulated provenance stays honest — never live/attested", () => {
    const kpis = buildKpis({
      proofFresh: false,
      proof: PROOF_EMPTY,
      simulated: true,
      risk: RISK_SIM,
      miningMarginScore: 64,
    });
    expect(riskKpi(kpis).provenance).toBe("simulated");
    expect(miningKpi(kpis).provenance).toBe("simulated");
    expect(riskKpi(kpis).provenance).not.toBe("live");
    expect(miningKpi(kpis).provenance).not.toBe("attested");
  });
});
