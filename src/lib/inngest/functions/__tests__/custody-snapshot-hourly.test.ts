import { describe, expect, it, vi, beforeEach } from "vitest";

import type { CustodySnapshot } from "@/lib/data/custody";

// ─── Mock: loadCustody ────────────────────────────────────────────────────────
// Default: empty vault (provenance "manual", reserves 0) — the state the
// production vault is in today. Tests that need a live vault override this.
const loadCustodyMock = vi.fn<() => Promise<CustodySnapshot>>(async () => ({
  provenance: "manual",
  configured: false,
  asOf: new Date().toISOString(),
  accountsCount: 0,
  totalUsdcReserves: 0,
  accounts: [],
}));

vi.mock("@/lib/data/custody", () => ({
  loadCustody: loadCustodyMock,
}));

// ─── Mock: Prisma ─────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const vaultSnapshotFindFirstMock = vi.fn<() => Promise<any>>(async () => null);
const vaultSnapshotCreateMock = vi.fn(
  async (args: { data: Record<string, unknown> }) => ({
    id: "mock-snapshot-id",
    ...args.data,
  }),
);
const allocationCreateManyMock = vi.fn(async () => ({ count: 0 }));

vi.mock("@/lib/db", () => ({
  prisma: {
    vaultSnapshot: {
      findFirst: vaultSnapshotFindFirstMock,
      create:    vaultSnapshotCreateMock,
    },
    allocation: {
      createMany: allocationCreateManyMock,
    },
  },
}));

// ─── Mock: idempotency ────────────────────────────────────────────────────────
const isDuplicateMock  = vi.fn(async () => false);
const markCompleteMock = vi.fn(async () => undefined);

vi.mock("@/lib/idempotency", () => ({
  isDuplicate:  isDuplicateMock,
  markComplete: markCompleteMock,
}));

// ─── Mock: next/cache ─────────────────────────────────────────────────────────
// The handler calls revalidateTag("yield") to evict the yield cache after a fresh
// snapshot lands. Outside a request / static-generation context (a plain unit
// test) Next throws "Invariant: static generation store missing in revalidateTag".
// Same pattern the admin action tests use for revalidatePath — stub it to a no-op.
vi.mock("next/cache", () => ({
  revalidateTag:  vi.fn(),
  revalidatePath: vi.fn(),
}));

// ─── Step shim ────────────────────────────────────────────────────────────────
// Executes each step inline so tests run synchronously without Inngest runtime.
const stepShim = {
  run: <T,>(_name: string, fn: () => T | Promise<T>): Promise<T> =>
    Promise.resolve(fn()),
};

// ─── Fixture: authoritative prior snapshot (no allocations) ──────────────────
const PREVIOUS_SNAPSHOT = {
  id:                "prev-id",
  takenAt:           new Date(),
  aumUsdc:           { toNumber: () => 1_000_000 },
  currentApyLow:     { toNumber: () => 9 },
  currentApyHigh:    { toNumber: () => 12 },
  stressedApy:       { toNumber: () => 6 },
  riskScore:         3,
  miningMarginScore: 72,
  mode:              "balanced",
  source:            "computed",
  allocations:       [] as unknown[],
};

// ─────────────────────────────────────────────────────────────────────────────

describe("custodySnapshotHourly Inngest function", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: idempotency guard passes (not a duplicate)
    isDuplicateMock.mockResolvedValue(false);
    // Default: no prior snapshot
    vaultSnapshotFindFirstMock.mockResolvedValue(null);
    // Default: custody = empty vault
    loadCustodyMock.mockResolvedValue({
      provenance:          "manual",
      configured:          false,
      asOf:                new Date().toISOString(),
      accountsCount:       0,
      totalUsdcReserves:   0,
      accounts:            [],
    });
  });

  // ─── Metadata ──────────────────────────────────────────────────────────────

  it("registers with id 'custody-snapshot-hourly'", async () => {
    const { custodySnapshotHourly, CUSTODY_SNAPSHOT_HOURLY_ID } = await import(
      "@/lib/inngest/functions/custody-snapshot-hourly"
    );
    expect(CUSTODY_SNAPSHOT_HOURLY_ID).toBe("custody-snapshot-hourly");
    expect(custodySnapshotHourly.opts.id).toBe("custody-snapshot-hourly");
  });

  it("uses a valid hourly cron expression", async () => {
    const { custodySnapshotHourly, CUSTODY_SNAPSHOT_HOURLY_CRON } = await import(
      "@/lib/inngest/functions/custody-snapshot-hourly"
    );
    expect(CUSTODY_SNAPSHOT_HOURLY_CRON).toBe("5 * * * *");
    const trigger = custodySnapshotHourly.opts.triggers?.[0];
    if (!trigger || !("cron" in trigger)) {
      throw new Error("Expected a cron trigger.");
    }
    expect(trigger.cron).toBe("5 * * * *");
  });

  it("has concurrency limit 1", async () => {
    const { custodySnapshotHourly } = await import(
      "@/lib/inngest/functions/custody-snapshot-hourly"
    );
    expect(custodySnapshotHourly.opts.concurrency).toEqual({ limit: 1 });
  });

  // ─── GUARD: vault empty → NO write ─────────────────────────────────────────

  it("skips write when vault is empty (provenance manual, reserves 0)", async () => {
    // loadCustody default is already empty — no override needed
    const { custodySnapshotHourlyHandler } = await import(
      "@/lib/inngest/functions/custody-snapshot-hourly"
    );

    const result = await custodySnapshotHourlyHandler({ step: stepShim });

    // Must return skipped
    expect(result).toEqual({ skipped: true, reason: "vault_empty_or_unconfigured" });

    // Critical: ZERO persistence calls
    expect(vaultSnapshotCreateMock).not.toHaveBeenCalled();
    expect(allocationCreateManyMock).not.toHaveBeenCalled();

    // markComplete IS called so we don't retry endlessly on empty-vault
    expect(markCompleteMock).toHaveBeenCalledTimes(1);
  });

  it("skips write when provenance is live but reserves are 0 (edge: configured scope but no funds)", async () => {
    loadCustodyMock.mockResolvedValueOnce({
      provenance:        "live",
      configured:        true,
      asOf:              new Date().toISOString(),
      accountsCount:     1,
      totalUsdcReserves: 0,   // zero — must still skip
      accounts:          [],
    });

    const { custodySnapshotHourlyHandler } = await import(
      "@/lib/inngest/functions/custody-snapshot-hourly"
    );

    const result = await custodySnapshotHourlyHandler({ step: stepShim });

    expect(result).toEqual({ skipped: true, reason: "vault_empty_or_unconfigured" });
    expect(vaultSnapshotCreateMock).not.toHaveBeenCalled();
  });

  it("skips write when configured=false even if provenance somehow equals live", async () => {
    loadCustodyMock.mockResolvedValueOnce({
      provenance:        "live",
      configured:        false,   // unscoped — must skip
      asOf:              new Date().toISOString(),
      accountsCount:     1,
      totalUsdcReserves: 500_000,
      accounts:          [],
    });

    const { custodySnapshotHourlyHandler } = await import(
      "@/lib/inngest/functions/custody-snapshot-hourly"
    );

    const result = await custodySnapshotHourlyHandler({ step: stepShim });

    expect(result).toEqual({ skipped: true, reason: "vault_empty_or_unconfigured" });
    expect(vaultSnapshotCreateMock).not.toHaveBeenCalled();
  });

  // ─── LIVE PATH: vault has real funds ───────────────────────────────────────

  it("creates a VaultSnapshot with source='live' when vault has real funds", async () => {
    const LIVE_RESERVES = 1_500_000;

    vaultSnapshotFindFirstMock.mockResolvedValueOnce(PREVIOUS_SNAPSHOT);
    loadCustodyMock.mockResolvedValueOnce({
      provenance:        "live",
      configured:        true,
      asOf:              new Date().toISOString(),
      accountsCount:     1,
      totalUsdcReserves: LIVE_RESERVES,
      accounts:          [{ id: "86", name: "Hearst Connect", assets: [], usdcTotal: LIVE_RESERVES }],
    });

    const { custodySnapshotHourlyHandler } = await import(
      "@/lib/inngest/functions/custody-snapshot-hourly"
    );

    const result = await custodySnapshotHourlyHandler({ step: stepShim });

    // Must NOT be skipped
    expect("skipped" in result).toBe(false);
    if ("skipped" in result) throw new Error("Expected live result.");

    // Source must be "live"
    expect(result.source).toBe("live");

    // snapshotId must be the one returned by prisma.vaultSnapshot.create
    expect(result.snapshotId).toBe("mock-snapshot-id");

    // vaultSnapshot.create must have been called exactly once
    expect(vaultSnapshotCreateMock).toHaveBeenCalledTimes(1);

    const createCall = vaultSnapshotCreateMock.mock.calls[0];
    if (!createCall) throw new Error("Expected create call.");
    const { data } = createCall[0] as { data: Record<string, unknown> };

    // source must be "live"
    expect(data["source"]).toBe("live");

    // aumUsdc must be the REAL balance from totalUsdcReserves — not a hardcode
    expect(data["aumUsdc"]).toBe(LIVE_RESERVES);
  });

  it("aumUsdc comes from totalUsdcReserves — not a constant", async () => {
    // Run twice with different amounts to prove aumUsdc tracks the input
    const AMOUNT_A = 2_000_000;
    const AMOUNT_B = 750_000;

    const { custodySnapshotHourlyHandler } = await import(
      "@/lib/inngest/functions/custody-snapshot-hourly"
    );

    for (const amount of [AMOUNT_A, AMOUNT_B]) {
      vaultSnapshotCreateMock.mockClear();
      vaultSnapshotFindFirstMock.mockResolvedValueOnce(PREVIOUS_SNAPSHOT);
      loadCustodyMock.mockResolvedValueOnce({
        provenance:        "live",
        configured:        true,
        asOf:              new Date().toISOString(),
        accountsCount:     1,
        totalUsdcReserves: amount,
        accounts:          [],
      });

      const result = await custodySnapshotHourlyHandler({ step: stepShim });

      expect("skipped" in result).toBe(false);
      if ("skipped" in result) continue;
      expect(result.aumUsdc).toBe(amount);

      const call = vaultSnapshotCreateMock.mock.calls[0];
      if (!call) throw new Error("Expected create call.");
      const { data } = call[0] as { data: Record<string, unknown> };
      expect(data["aumUsdc"]).toBe(amount);
    }
  });

  it("skips write when no AUTHORITATIVE prior snapshot exists (refuses to invent engine fields)", async () => {
    loadCustodyMock.mockResolvedValueOnce({
      provenance:        "live",
      configured:        true,
      asOf:              new Date().toISOString(),
      accountsCount:     1,
      totalUsdcReserves: 1_000_000,
      accounts:          [],
    });
    vaultSnapshotFindFirstMock.mockResolvedValueOnce(null); // no authoritative prior snapshot

    const { custodySnapshotHourlyHandler } = await import(
      "@/lib/inngest/functions/custody-snapshot-hourly"
    );

    const result = await custodySnapshotHourlyHandler({ step: stepShim });

    // Engine-owned columns are non-nullable — with nothing to inherit, the job
    // must skip rather than fabricate zero APY/risk scores.
    expect(result).toEqual({ skipped: true, reason: "no_authoritative_prior_snapshot" });
    expect(vaultSnapshotCreateMock).not.toHaveBeenCalled();
    expect(allocationCreateManyMock).not.toHaveBeenCalled();
  });

  it("does NOT create allocations when the previous snapshot has none", async () => {
    loadCustodyMock.mockResolvedValueOnce({
      provenance:        "live",
      configured:        true,
      asOf:              new Date().toISOString(),
      accountsCount:     1,
      totalUsdcReserves: 1_000_000,
      accounts:          [],
    });
    vaultSnapshotFindFirstMock.mockResolvedValueOnce(PREVIOUS_SNAPSHOT); // no allocations

    const { custodySnapshotHourlyHandler } = await import(
      "@/lib/inngest/functions/custody-snapshot-hourly"
    );

    await custodySnapshotHourlyHandler({ step: stepShim });

    expect(vaultSnapshotCreateMock).toHaveBeenCalledTimes(1);
    // No allocations to inherit → createMany must not be called
    expect(allocationCreateManyMock).not.toHaveBeenCalled();
  });

  it("loads the prior snapshot with a source allowlist that excludes demo_seed", async () => {
    loadCustodyMock.mockResolvedValueOnce({
      provenance:        "live",
      configured:        true,
      asOf:              new Date().toISOString(),
      accountsCount:     1,
      totalUsdcReserves: 1_000_000,
      accounts:          [],
    });
    vaultSnapshotFindFirstMock.mockResolvedValueOnce(PREVIOUS_SNAPSHOT);

    const { custodySnapshotHourlyHandler } = await import(
      "@/lib/inngest/functions/custody-snapshot-hourly"
    );

    await custodySnapshotHourlyHandler({ step: stepShim });

    const findCall = vaultSnapshotFindFirstMock.mock.calls[0] as unknown as [
      { where?: { source?: { in?: string[] } } },
    ];
    const sources = findCall?.[0]?.where?.source?.in;
    expect(Array.isArray(sources)).toBe(true);
    expect(sources).not.toContain("demo_seed");
    expect(sources).toContain("live");
  });

  it("inherits and recalculates allocations from previous snapshot", async () => {
    const LIVE_AUM = 1_500_000;

    loadCustodyMock.mockResolvedValueOnce({
      provenance:        "live",
      configured:        true,
      asOf:              new Date().toISOString(),
      accountsCount:     1,
      totalUsdcReserves: LIVE_AUM,
      accounts:          [],
    });

    // Previous snapshot with 2 allocations (60% mining, 40% usdc_base)
    vaultSnapshotFindFirstMock.mockResolvedValueOnce({
      id:                "prev-id",
      takenAt:           new Date(),
      aumUsdc:           { toNumber: () => 1_000_000 },
      currentApyLow:     { toNumber: () => 9 },
      currentApyHigh:    { toNumber: () => 12 },
      stressedApy:       { toNumber: () => 6 },
      riskScore:         3,
      miningMarginScore: 72,
      mode:              "balanced",
      source:            "computed",
      allocations: [
        {
          id:                   "alloc-1",
          snapshotId:           "prev-id",
          bucket:               "mining",
          pct:                  60,
          valueUsdc:            600_000,
          yieldContributionBps: 350,
        },
        {
          id:                   "alloc-2",
          snapshotId:           "prev-id",
          bucket:               "usdc_base",
          pct:                  40,
          valueUsdc:            400_000,
          yieldContributionBps: 120,
        },
      ],
    });

    const { custodySnapshotHourlyHandler } = await import(
      "@/lib/inngest/functions/custody-snapshot-hourly"
    );

    await custodySnapshotHourlyHandler({ step: stepShim });

    expect(allocationCreateManyMock).toHaveBeenCalledTimes(1);
    const rawCall = (allocationCreateManyMock.mock.calls as unknown as Array<[unknown]>)[0];
    if (!rawCall) throw new Error("Expected createMany call.");
    const { data } = rawCall[0] as {
      data: Array<{
        bucket: string;
        pct: number;
        valueUsdc: number;
        yieldContributionBps: number;
      }>;
    };

    expect(data).toHaveLength(2);

    // Mining: 60% of 1_500_000 = 900_000
    const mining = data.find((a) => a.bucket === "mining");
    expect(mining).toBeDefined();
    expect(mining?.valueUsdc).toBeCloseTo(900_000, 0);
    expect(mining?.pct).toBe(60);

    // USDC base: 40% of 1_500_000 = 600_000
    const usdcBase = data.find((a) => a.bucket === "usdc_base");
    expect(usdcBase).toBeDefined();
    expect(usdcBase?.valueUsdc).toBeCloseTo(600_000, 0);
  });

  // ─── Idempotency ───────────────────────────────────────────────────────────

  it("returns skipped immediately when isDuplicate is true", async () => {
    isDuplicateMock.mockResolvedValueOnce(true);

    const { custodySnapshotHourlyHandler } = await import(
      "@/lib/inngest/functions/custody-snapshot-hourly"
    );

    const result = await custodySnapshotHourlyHandler({ step: stepShim });

    expect(result).toEqual({ skipped: true, reason: "already_run_this_hour" });
    expect(loadCustodyMock).not.toHaveBeenCalled();
    expect(vaultSnapshotCreateMock).not.toHaveBeenCalled();
  });
});
