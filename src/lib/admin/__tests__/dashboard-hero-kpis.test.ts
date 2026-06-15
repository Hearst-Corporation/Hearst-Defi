import { describe, expect, it } from "vitest";

import { buildDashboardHeroKpis } from "@/lib/admin/dashboard-hero-kpis";
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
  hasLiveKpis: boolean;
  proofFresh: boolean;
  proof: AdminProofStatus;
}) {
  return buildDashboardHeroKpis({
    capitalUsdc: 0,
    capitalProvenance: "manual",
    vaultName: DATA_STUB.vaultMeta.name,
    headlineApy: null,
    yieldPosture: "awaiting first snapshot",
    apyProvenance: "manual",
    risk: RISK,
    riskProvenance: "manual",
    miningMarginScore: 0,
    miningProvenance: "manual",
    hasLiveKpis: opts.hasLiveKpis,
    proofFresh: opts.proofFresh,
    proofProvenance: opts.proofFresh ? "attested" : opts.proof.attestationsCount > 0 ? "stale" : "manual",
    proof: opts.proof,
    totalActionRequired: 0,
    data: DATA_STUB as DashboardData,
  });
}

function proofKpi(kpis: ReturnType<typeof buildKpis>) {
  return kpis.find((k) => k.label === "Proof")!;
}

describe("Proof KPI value — seed honesty", () => {
  it('seed context with attestation rows shows "On file", not "Attested"', () => {
    const kpis = buildKpis({ hasLiveKpis: false, proofFresh: false, proof: PROOF_WITH_ATTESTATION });
    expect(proofKpi(kpis).value).toBe("On file");
    expect(proofKpi(kpis).provenance).toBe("stale");
  });

  it('seed context with no attestation shows "Pending"', () => {
    const kpis = buildKpis({ hasLiveKpis: false, proofFresh: false, proof: PROOF_EMPTY });
    expect(proofKpi(kpis).value).toBe("Pending");
  });

  it('live context + fresh proof shows "Current"', () => {
    const kpis = buildKpis({ hasLiveKpis: true, proofFresh: true, proof: PROOF_WITH_ATTESTATION });
    expect(proofKpi(kpis).value).toBe("Current");
    expect(proofKpi(kpis).provenance).toBe("attested");
  });

  it('live context + stale proof shows "Stale"', () => {
    const kpis = buildKpis({ hasLiveKpis: true, proofFresh: false, proof: PROOF_WITH_ATTESTATION });
    expect(proofKpi(kpis).value).toBe("Stale");
  });

  it('live context + no proof shows "Pending"', () => {
    const kpis = buildKpis({ hasLiveKpis: true, proofFresh: false, proof: PROOF_EMPTY });
    expect(proofKpi(kpis).value).toBe("Pending");
  });
});
