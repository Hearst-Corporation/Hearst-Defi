import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

// Mock the Prisma client so the loader degrades to its fallback path. The
// loader still runs the full code path (including the vault metadata
// projection); only the DB-bound branches degrade to empty.
vi.mock("@/lib/db", () => ({
  prisma: {
    vaultSnapshot: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    rebalanceEvent: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    miningMetric: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    distribution: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    proof: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
    },
    // resolver.ts reads vaultDeployment for resolveVault — return null (not used in these tests)
    vaultDeployment: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

vi.mock("server-only", () => ({}));

// Stub the BTC price fetch so the loader does not hit the network.
vi.mock("@/lib/data/btc-price", () => ({
  fetchBtcPrice: vi.fn().mockResolvedValue({
    spot_usd: 96_000,
    pct_change_24h: 0,
    pct_change_30d: 0,
    fetched_at: new Date().toISOString(),
    source: "fallback",
  }),
}));

// Stub the hashprice fetch (used transitively by the mining loader). Returns a
// stale snapshot so the loader takes its fallback branch without throwing on a
// null `usd_per_th_day` field.
vi.mock("@/lib/data/hashprice", () => ({
  fetchHashprice: vi.fn().mockResolvedValue({
    usd_per_th_day: 0,
    btc_price_usd: 0,
    network_hashrate_eh: 0,
    network_difficulty: 0,
    block_reward_btc: 0,
    fees_pct_of_reward: 0,
    fetched_at: new Date().toISOString(),
    source: "fallback",
    stale: true,
  }),
}));

import { loadDashboardData, loadDashboardForRef } from "@/lib/data/dashboard";
import {
  VAULT_BTC_PLUS,
  VAULT_DEFENSIVE,
  VAULT_YIELD,
} from "@/lib/engine/vaults";
import type { VaultDeployment } from "@prisma/client";

describe("loadDashboardData multi-vault metadata (ADR-006 #9)", () => {
  it("defaults to the Hearst Yield Vault preset when no id is passed", async () => {
    const data = await loadDashboardData();
    expect(data.vaultMeta.id).toBe(VAULT_YIELD.id);
    expect(data.vaultMeta.name).toBe(VAULT_YIELD.label);
    expect(data.vaultMeta.apyTarget.low).toBe(VAULT_YIELD.apyTarget.low);
    expect(data.vaultMeta.apyTarget.high).toBe(VAULT_YIELD.apyTarget.high);
    expect(data.vaultMeta.livePreview).toBe(false);
  });

  it("returns the Defensive Vault metadata when vaultId=defensive", async () => {
    const data = await loadDashboardData("defensive");
    expect(data.vaultMeta.id).toBe(VAULT_DEFENSIVE.id);
    expect(data.vaultMeta.name).toBe(VAULT_DEFENSIVE.label);
    expect(data.vaultMeta.apyTarget).toEqual({
      low: VAULT_DEFENSIVE.apyTarget.low,
      high: VAULT_DEFENSIVE.apyTarget.high,
    });
    expect(data.vaultMeta.allocationTargets).toEqual(
      VAULT_DEFENSIVE.allocationTargets,
    );
    // Live KPIs are not yet per-vault — preview flag must be ON so the UI can
    // label them as such (ADR-006 #9).
    expect(data.vaultMeta.livePreview).toBe(true);
  });

  it("returns the BTC Plus Vault metadata when vaultId=btc-plus", async () => {
    const data = await loadDashboardData("btc-plus");
    expect(data.vaultMeta.id).toBe(VAULT_BTC_PLUS.id);
    expect(data.vaultMeta.name).toBe(VAULT_BTC_PLUS.label);
    expect(data.vaultMeta.apyTarget.high).toBe(VAULT_BTC_PLUS.apyTarget.high);
    expect(data.vaultMeta.livePreview).toBe(true);
  });

  it("falls back to the Yield Vault on an unknown id (no silent vault swap)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const data = await loadDashboardData("not-a-real-vault");
    expect(data.vaultMeta.id).toBe(VAULT_YIELD.id);
    expect(data.vaultMeta.livePreview).toBe(true);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("never mixes apy targets across vaults (idempotent per call)", async () => {
    const yield1 = await loadDashboardData("yield");
    const def1 = await loadDashboardData("defensive");
    const btc1 = await loadDashboardData("btc-plus");
    const yield2 = await loadDashboardData("yield");

    // Each vault keeps its OWN apy band on every call — no leakage from one
    // run to the next, no implicit "last vault wins".
    expect(yield1.vaultMeta.apyTarget).toEqual(yield2.vaultMeta.apyTarget);
    expect(def1.vaultMeta.apyTarget).not.toEqual(yield1.vaultMeta.apyTarget);
    expect(btc1.vaultMeta.apyTarget).not.toEqual(yield1.vaultMeta.apyTarget);
    expect(def1.vaultMeta.apyTarget).not.toEqual(btc1.vaultMeta.apyTarget);
  });
});

// ---------------------------------------------------------------------------
// loadDashboardForRef — fixture equivalence
// ---------------------------------------------------------------------------

describe("loadDashboardForRef — fixture refs produce same shape as loadDashboardData", () => {
  it("yield fixture ref: vaultMeta equals loadDashboardData('yield')", async () => {
    const [fromId, fromRef] = await Promise.all([
      loadDashboardData("yield"),
      loadDashboardForRef({ kind: "fixture", fixture: VAULT_YIELD }),
    ]);
    expect(fromRef.vaultMeta.id).toBe(fromId.vaultMeta.id);
    expect(fromRef.vaultMeta.name).toBe(fromId.vaultMeta.name);
    expect(fromRef.vaultMeta.apyTarget).toEqual(fromId.vaultMeta.apyTarget);
    expect(fromRef.vaultMeta.allocationTargets).toEqual(
      fromId.vaultMeta.allocationTargets,
    );
    expect(fromRef.vaultMeta.livePreview).toBe(fromId.vaultMeta.livePreview);
  });

  it("defensive fixture ref: vaultMeta equals loadDashboardData('defensive')", async () => {
    const [fromId, fromRef] = await Promise.all([
      loadDashboardData("defensive"),
      loadDashboardForRef({ kind: "fixture", fixture: VAULT_DEFENSIVE }),
    ]);
    expect(fromRef.vaultMeta.id).toBe(fromId.vaultMeta.id);
    expect(fromRef.vaultMeta.name).toBe(fromId.vaultMeta.name);
    expect(fromRef.vaultMeta.apyTarget).toEqual(fromId.vaultMeta.apyTarget);
  });

  it("btc-plus fixture ref: vaultMeta equals loadDashboardData('btc-plus')", async () => {
    const [fromId, fromRef] = await Promise.all([
      loadDashboardData("btc-plus"),
      loadDashboardForRef({ kind: "fixture", fixture: VAULT_BTC_PLUS }),
    ]);
    expect(fromRef.vaultMeta.id).toBe(fromId.vaultMeta.id);
    expect(fromRef.vaultMeta.name).toBe(fromId.vaultMeta.name);
    expect(fromRef.vaultMeta.apyTarget).toEqual(fromId.vaultMeta.apyTarget);
  });

  it("all 3 fixtures: allocations.length, recentEvents.length, vault.mode equal loadDashboardData", async () => {
    const fixtures = [
      { fixture: VAULT_YIELD, id: "yield" },
      { fixture: VAULT_DEFENSIVE, id: "defensive" },
      { fixture: VAULT_BTC_PLUS, id: "btc-plus" },
    ] as const;

    for (const { fixture, id } of fixtures) {
      const [fromId, fromRef] = await Promise.all([
        loadDashboardData(id),
        loadDashboardForRef({ kind: "fixture", fixture }),
      ]);

      expect(fromRef.allocations.length, `allocations.length mismatch for vault "${id}"`).toBe(
        fromId.allocations.length,
      );
      expect(fromRef.recentEvents.length, `recentEvents.length mismatch for vault "${id}"`).toBe(
        fromId.recentEvents.length,
      );
      expect(fromRef.vault.mode, `vault.mode mismatch for vault "${id}"`).toBe(
        fromId.vault.mode,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// loadDashboardForRef — deployment ref
// ---------------------------------------------------------------------------

describe("loadDashboardForRef — deployment ref", () => {
  // Build a minimal VaultDeployment row using the real Prisma Decimal type.
  const deploymentRow: VaultDeployment = {
    id: "cmx_test_live_001",
    ticker: "HYV-A",
    name: "Hearst Yield Vault — Series A",
    description: "Live managed deployment",
    strategy: "mining_yield",
    colorTag: "accent",
    status: "live",
    minTicketUsdc: new Prisma.Decimal(250_000),
    capacityUsdc: new Prisma.Decimal(10_000_000),
    mgmtFeeBps: 100,
    perfFeeBps: 1_000,
    hurdleBps: 0,
    softLockupDays: 60,
    targetApyLowBps: 800,
    targetApyHighBps: 1_500,
    spvJurisdiction: "cayman",
    shareClass: "A",
    regExemption: "regD_506c",
    disclaimers: "Not an offer of securities.",
    targetMiningBps: 6_000,
    targetBtcTacticalBps: 2_500,
    targetUsdcBaseBps: 1_000,
    targetStableReserveBps: 500,
    network: null,
    contractAddress: null,
    requiredSigners: 2,
    signersWhitelist: JSON.stringify([]),
    createdAt: new Date("2026-05-26T00:00:00Z"),
    updatedAt: new Date("2026-05-26T00:00:00Z"),
    submittedAt: null,
    deployedAt: null,
    pausedAt: null,
    closedAt: null,
    createdBy: "admin",
    seededFromStudyId: null,
  };

  it("does not throw for a live deployment ref", async () => {
    await expect(
      loadDashboardForRef({ kind: "deployment", deployment: deploymentRow }),
    ).resolves.toBeDefined();
  });

  it("vaultMeta.name === deployment.name", async () => {
    const data = await loadDashboardForRef({
      kind: "deployment",
      deployment: deploymentRow,
    });
    expect(data.vaultMeta.name).toBe(deploymentRow.name);
  });

  it("vaultMeta.apyTarget.low === targetApyLowBps / 100", async () => {
    const data = await loadDashboardForRef({
      kind: "deployment",
      deployment: deploymentRow,
    });
    expect(data.vaultMeta.apyTarget.low).toBe(
      deploymentRow.targetApyLowBps / 100,
    );
  });

  it("vaultMeta.apyTarget.high === targetApyHighBps / 100", async () => {
    const data = await loadDashboardForRef({
      kind: "deployment",
      deployment: deploymentRow,
    });
    expect(data.vaultMeta.apyTarget.high).toBe(
      deploymentRow.targetApyHighBps / 100,
    );
  });

  it("vaultMeta.livePreview === true (no per-deployment snapshot yet)", async () => {
    const data = await loadDashboardForRef({
      kind: "deployment",
      deployment: deploymentRow,
    });
    expect(data.vaultMeta.livePreview).toBe(true);
  });

  it("vault KPIs are defined (not undefined)", async () => {
    const data = await loadDashboardForRef({
      kind: "deployment",
      deployment: deploymentRow,
    });
    expect(data.vault).toBeDefined();
    expect(data.vault.aumUsdc).toBeDefined();
    expect(data.vault.apyRange).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Seed honesty — hasLiveTimelineSnapshot / latestSnapshotSource contract
// ---------------------------------------------------------------------------

describe("seed honesty — DashboardData contract (no DB rows)", () => {
  it("hasLiveTimelineSnapshot is false when no snapshot exists", async () => {
    const data = await loadDashboardData("yield");
    // DB mock returns null snapshot — must be conservative.
    expect(data.hasTimelineSnapshot).toBe(false);
    expect(data.hasLiveTimelineSnapshot).toBe(false);
    expect(data.latestSnapshotSource).toBeNull();
  });
});
