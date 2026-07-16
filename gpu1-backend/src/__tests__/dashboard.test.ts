import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DashboardDTO, Resolved } from "../domain/index.js";
import type { VaultRepository } from "../persistence/vault-repository.js";

// The v2 contract is NOT deployed (no DYNAVAULT_ADDRESS), so every contract-owned
// surface must be honestly NOT_CONFIGURED with a null value. DB-backed surfaces are
// LIVE only when a real record exists, PARTIAL (null) otherwise — never a
// fabricated zero. Product constants (allocation targets, minimum deposit,
// subscription rules) are manual · LIVE because they are real product terms.
describe("buildDashboard (contract not deployed)", () => {
  const NOW = 1_800_000_000_000;

  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "postgresql://x");
    vi.stubEnv("DYNAVAULT_ADDRESS", ""); // absent → runtime not_configured
    vi.resetModules();
  });
  afterEach(() => vi.unstubAllEnvs());

  async function build(repo: VaultRepository): Promise<DashboardDTO> {
    const { buildDashboard } = await import("../application/dashboard.js");
    return buildDashboard("user-1", { repo, nowMs: NOW });
  }

  // ── Repository fakes ─────────────────────────────────────────────────────────

  /** A funded investor: identity + one position + no distributions + one activity row. */
  const repoFunded: VaultRepository = {
    getUserPosition: async () => null, // legacy method — not exercised by buildDashboard
    getInvestorIdentity: async () => ({
      kycStatus: "approved",
      shareClass: null,
      whitelisted: null,
      walletAddress: "0xabc",
      accredited: true,
    }),
    getInvestorPosition: async () => ({
      principal: "250000",
      accrued: "12000",
      value: "262000",
      deposits: "250000",
      withdrawals: null,
      shares: null,
      positionsCount: 1,
      subscribedAt: new Date(NOW).toISOString(),
      status: "active",
    }),
    getDistributions: async () => ({
      count: 0,
      totalDistributedUsdc: null,
      lastDistributionAt: null,
      recent: [],
    }),
    getActivity: async () => [
      { type: "deposit", amountUsdc: "250000", occurredAt: new Date(NOW).toISOString(), txHash: "0xdeadbeef" },
    ],
    getProofSummary: async () => ({ totalProofs: 0, latestProofAt: null, types: [] }),
  };

  /** No investor record at all — every investor-scoped read returns null. */
  const repoNoInvestor: VaultRepository = {
    getUserPosition: async () => null,
    getInvestorIdentity: async () => null,
    getInvestorPosition: async () => null,
    getDistributions: async () => null,
    getActivity: async () => null,
    getProofSummary: async () => ({ totalProofs: 0, latestProofAt: null, types: [] }),
  };

  // ── Scenario 1: funded investor ──────────────────────────────────────────────

  it("with an investor + position: identity LIVE, position LIVE, allocation LIVE (manual); capacity/reserve/mining NOT_CONFIGURED", async () => {
    const dto = await build(repoFunded);

    expect(dto.runtime.mode).toBe("not_configured");

    // DB-backed → LIVE from db.
    expect(dto.identity.status).toBe("LIVE");
    expect(dto.identity.provenance).toBe("db");
    expect(dto.identity.value?.kycStatus).toBe("approved");
    // Share class + on-chain whitelist stay null (not stored / on-chain), never fabricated.
    expect(dto.identity.value?.shareClass).toBeNull();
    expect(dto.identity.value?.whitelisted).toBeNull();

    expect(dto.position.status).toBe("LIVE");
    expect(dto.position.provenance).toBe("db");
    expect(dto.position.value?.principal).toBe("250000");
    expect(dto.position.value?.positionsCount).toBe(1);
    expect(dto.position.value?.shares).toBeNull(); // on-chain → null even when funded

    // Product constants → manual · LIVE with the real target bps (4000/2700/3300 = 10000).
    expect(dto.allocation.status).toBe("LIVE");
    expect(dto.allocation.provenance).toBe("manual");
    expect(dto.allocation.value?.targetTotalBps).toBe(10000);
    const bps = dto.allocation.value?.pockets.map((p) => p.targetBps);
    expect(bps).toEqual([4000, 2700, 3300]);
    // actual bps is on-chain → null on every pocket.
    for (const p of dto.allocation.value?.pockets ?? []) {
      expect(p.actualBps).toBeNull();
    }

    // Subscription: manual · LIVE; userEligible derived from approved KYC.
    expect(dto.subscription.status).toBe("LIVE");
    expect(dto.subscription.provenance).toBe("manual");
    expect(dto.subscription.value?.minimumDeposit).toBe("250000");
    expect(dto.subscription.value?.userEligible).toBe(true);

    // Contract-owned → NOT_CONFIGURED with a null value.
    for (const f of [dto.capacity, dto.reserve, dto.mining, dto.performance, dto.rebalancing, dto.engine, dto.aiExperts] as ReadonlyArray<Resolved<unknown>>) {
      expect(f.status).toBe("NOT_CONFIGURED");
      expect(f.value).toBeNull();
    }
  });

  it("with an investor: activity LIVE from the DB, proofs LIVE (count 0, not fabricated)", async () => {
    const dto = await build(repoFunded);
    expect(dto.activity.status).toBe("LIVE");
    expect(dto.activity.value?.length).toBe(1);
    expect(dto.activity.value?.[0]?.type).toBe("deposit");

    // Proof table empty → still LIVE (a real read), count 0 (not null, not fabricated).
    expect(dto.proofs.status).toBe("LIVE");
    expect(dto.proofs.value?.totalProofs).toBe(0);
    expect(dto.proofs.value?.latestProofAt).toBeNull();
  });

  it("distributions: v2 accumulation note → empty summary is LIVE with count 0 and null total (never a fabricated 0)", async () => {
    const dto = await build(repoFunded);
    expect(dto.distributions.status).toBe("LIVE");
    expect(dto.distributions.value?.count).toBe(0);
    // Absence of distributions is null, NOT a fabricated "0".
    expect(dto.distributions.value?.totalDistributedUsdc).toBeNull();
    expect(dto.distributions.value?.lastDistributionAt).toBeNull();
  });

  // ── Scenario 2: no investor ──────────────────────────────────────────────────

  it("without an investor: identity/position/distributions/activity PARTIAL with value null — never a fabricated 0", async () => {
    const dto = await build(repoNoInvestor);

    for (const f of [dto.identity, dto.position, dto.distributions, dto.activity] as ReadonlyArray<Resolved<unknown>>) {
      expect(f.status).toBe("PARTIAL");
      expect(f.value).toBeNull(); // NOT 0, NOT an empty fabricated record
      expect(f.reason).toBe("no_investor_record");
    }

    // userEligible must be null (unknown), not a fabricated false, when there is no investor.
    expect(dto.subscription.value?.userEligible).toBeNull();
    // Product constants are still LIVE — they do not depend on an investor.
    expect(dto.allocation.status).toBe("LIVE");
    expect(dto.subscription.status).toBe("LIVE");
  });

  it("without an investor: alerts surface no_investor_record + no_position (derived, LIVE)", async () => {
    const dto = await build(repoNoInvestor);
    expect(dto.alerts.status).toBe("LIVE");
    const codes = dto.alerts.value?.map((a) => a.code) ?? [];
    expect(codes).toContain("no_investor_record");
    expect(codes).toContain("no_position");
  });

  // ── Scenario 3: honesty invariant ────────────────────────────────────────────

  it("invariant: every field whose value is null carries a non-LIVE status", async () => {
    for (const repo of [repoFunded, repoNoInvestor]) {
      const dto = await build(repo);
      const blocks: ReadonlyArray<Resolved<unknown>> = [
        dto.identity,
        dto.position,
        dto.distributions,
        dto.activity,
        dto.proofs,
        dto.allocation,
        dto.subscription,
        dto.alerts,
        dto.capacity,
        dto.reserve,
        dto.mining,
        dto.performance,
        dto.rebalancing,
        dto.engine,
        dto.aiExperts,
        dto.vault,
        dto.strategies,
        dto.recentEvents,
      ];
      for (const f of blocks) {
        if (f.value === null) {
          expect(f.status).not.toBe("LIVE");
        }
      }
    }
  });

  // ── Scenario 4: availableCapacity is never fabricated ────────────────────────

  it("availableCapacity is never fabricated — capacity stays NOT_CONFIGURED (null block) with no cap on-chain", async () => {
    const dto = await build(repoFunded);
    // The whole capacity block is null (NOT_CONFIGURED). There is NO fabricated
    // availableCapacity number computed from a missing cap.
    expect(dto.capacity.status).toBe("NOT_CONFIGURED");
    expect(dto.capacity.value).toBeNull();
    expect(dto.capacity.reason).toBe("dynavault_not_deployed");
  });

  // ── DB error degradation ─────────────────────────────────────────────────────

  it("a DB error on identity degrades to UNAVAILABLE (null), not a fabricated value", async () => {
    const repo: VaultRepository = {
      ...repoNoInvestor,
      getInvestorIdentity: async () => {
        throw new Error("db down");
      },
    };
    const dto = await build(repo);
    expect(dto.identity.status).toBe("UNAVAILABLE");
    expect(dto.identity.value).toBeNull();
  });

  it("carries generatedAt in meta and a machine reason on unavailable contract fields", async () => {
    const dto = await build(repoFunded);
    expect(dto.meta.generatedAt).toBe(new Date(NOW).toISOString());
    expect(dto.meta.contract.mode).toBe("not_configured");
    expect(dto.mining.reason).toBe("dynavault_not_deployed");
  });
});
