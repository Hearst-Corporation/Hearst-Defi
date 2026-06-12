/**
 * chat-context tests (PR-5).
 *
 * buildPortfolioContextBlock(userId) must:
 *   - resolve the Investor strictly from the PASSED userId (never the session),
 *   - aggregate value / YTD yield / next distribution / allocation,
 *   - qualify each figure with a provenance label (live / estimated / stale),
 *   - return null when there is no investor OR no positions,
 *   - never surface another investor's figures (per-user scoping).
 *
 * Harness: mock `@/lib/db` with an in-memory store keyed by userId/investorId,
 * each mock enforcing its own `where` filter so a loader that forgets to scope
 * would leak the other tenant's rows and fail an assertion loudly.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    investor: { findUnique: vi.fn() },
    position: { findMany: vi.fn() },
    investorTransaction: { findMany: vi.fn() },
    vaultSnapshot: { findFirst: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import { buildPortfolioContextBlock } from "@/lib/llm/chat-context";

const mockInvestorFind = vi.mocked(prisma.investor.findUnique);
const mockPositionFind = vi.mocked(prisma.position.findMany);
const mockTxFind = vi.mocked(prisma.investorTransaction.findMany);
const mockSnapshotFind = vi.mocked(prisma.vaultSnapshot.findFirst);

// ---------------------------------------------------------------------------
// Fixtures: user A (investor inv_a) and user B (investor inv_b).
// ---------------------------------------------------------------------------

const USER_A = "user_a";
const USER_B = "user_b";
const INV_A = "inv_a";
const INV_B = "inv_b";

const NOW = new Date("2026-06-12T00:00:00.000Z");
const FRESH_SNAPSHOT_AT = new Date("2026-06-11T18:00:00.000Z"); // < 24h old
const STALE_SNAPSHOT_AT = new Date("2026-06-01T00:00:00.000Z"); // > 24h old

const investors: Record<string, { id: string }> = {
  [USER_A]: { id: INV_A },
  [USER_B]: { id: INV_B },
};

// Positions per investor. A has real money; B's figures are distinct so a leak
// would be obvious in the rendered block.
const positionsByInvestor: Record<
  string,
  Array<{ principalUsdc: number; accruedYieldUsdc: number }>
> = {
  [INV_A]: [{ principalUsdc: 250000, accruedYieldUsdc: 5000 }],
  [INV_B]: [{ principalUsdc: 999000, accruedYieldUsdc: 12345 }],
};

const txByInvestor: Record<string, Array<{ amountUsdc: number }>> = {
  [INV_A]: [{ amountUsdc: 1500 }],
  [INV_B]: [{ amountUsdc: 88888 }],
};

function scopeInvestor(args: { where?: { userId?: string } }) {
  const userId = args.where?.userId;
  return userId && investors[userId] ? investors[userId] : null;
}

function scopePositions(args: { where?: { investorId?: string } }) {
  const investorId = args.where?.investorId;
  return investorId ? (positionsByInvestor[investorId] ?? []) : [];
}

function scopeTx(args: { where?: { investorId?: string } }) {
  const investorId = args.where?.investorId;
  return investorId ? (txByInvestor[investorId] ?? []) : [];
}

beforeEach(() => {
  vi.clearAllMocks();

  mockInvestorFind.mockImplementation(((args: {
    where?: { userId?: string };
  }) => Promise.resolve(scopeInvestor(args)) as never) as never);

  mockPositionFind.mockImplementation(((args: {
    where?: { investorId?: string };
  }) => Promise.resolve(scopePositions(args)) as never) as never);

  mockTxFind.mockImplementation(((args: {
    where?: { investorId?: string };
  }) => Promise.resolve(scopeTx(args)) as never) as never);

  // Default: a fresh snapshot with a typical 3-bucket allocation.
  mockSnapshotFind.mockImplementation((() =>
    Promise.resolve({
      takenAt: FRESH_SNAPSHOT_AT,
      allocations: [
        { bucket: "mining", pct: 35 },
        { bucket: "usdc_base", pct: 45 },
        { bucket: "btc_tactical", pct: 20 },
      ],
    }) as never) as never);
});

// ---------------------------------------------------------------------------
// Scoping: resolve investor strictly from the passed userId
// ---------------------------------------------------------------------------

describe("buildPortfolioContextBlock — per-user scoping", () => {
  it("resolves the Investor with where.userId = the passed userId", async () => {
    await buildPortfolioContextBlock(USER_A, NOW);
    expect(mockInvestorFind).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER_A } }),
    );
  });

  it("queries positions/transactions scoped to that investor's id only", async () => {
    await buildPortfolioContextBlock(USER_A, NOW);
    expect(mockPositionFind).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ investorId: INV_A }) }),
    );
    expect(mockTxFind).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ investorId: INV_A }) }),
    );
  });

  it("A's block carries A's figures, never B's — no cross-tenant bleed", async () => {
    const blockA = await buildPortfolioContextBlock(USER_A, NOW);
    expect(blockA).not.toBeNull();
    // A: value = 250000 + 5000 = 255 000 ; YTD = 1500 + 5000 = 6 500
    expect(blockA).toContain("255 000 USDC");
    expect(blockA).toContain("6 500 USDC");
    // B's distinctive numbers must NOT appear.
    expect(blockA).not.toContain("999");
    expect(blockA).not.toContain("88 888");

    const blockB = await buildPortfolioContextBlock(USER_B, NOW);
    expect(blockB).not.toBeNull();
    // B: value = 999000 + 12345 = 1 011 345
    expect(blockB).toContain("1 011 345 USDC");
    expect(blockB).not.toContain("255 000");
  });
});

// ---------------------------------------------------------------------------
// Provenance qualifiers
// ---------------------------------------------------------------------------

describe("buildPortfolioContextBlock — provenance qualifier per figure", () => {
  it("labels figures 'live'/'estimated' when the snapshot is fresh", async () => {
    const block = await buildPortfolioContextBlock(USER_A, NOW);
    expect(block).not.toBeNull();
    expect(block).toContain("(live)"); // total value
    expect(block).toContain("(estimated)"); // YTD yield + next distribution
  });

  it("labels figures 'stale' when the latest snapshot is older than the SLO", async () => {
    mockSnapshotFind.mockImplementation((() =>
      Promise.resolve({
        takenAt: STALE_SNAPSHOT_AT,
        allocations: [{ bucket: "mining", pct: 35 }],
      }) as never) as never);

    const block = await buildPortfolioContextBlock(USER_A, NOW);
    expect(block).not.toBeNull();
    expect(block).toContain("(stale)");
  });

  it("treats value as stale when there is no snapshot at all", async () => {
    mockSnapshotFind.mockImplementation((() =>
      Promise.resolve(null) as never) as never);

    const block = await buildPortfolioContextBlock(USER_A, NOW);
    expect(block).not.toBeNull();
    // Value provenance via resolveProvenance(null) → stale.
    expect(block).toContain("(stale)");
    // No allocation line / snapshot line when there is no snapshot.
    expect(block).not.toContain("Allocation");
    expect(block).not.toContain("snapshot");
  });
});

// ---------------------------------------------------------------------------
// Allocation + cadence content
// ---------------------------------------------------------------------------

describe("buildPortfolioContextBlock — structured content", () => {
  it("includes a compact allocation breakdown from the snapshot", async () => {
    const block = await buildPortfolioContextBlock(USER_A, NOW);
    expect(block).toContain("mining 35%");
    expect(block).toContain("USDC base 45%");
    expect(block).toContain("BTC tactique 20%");
  });

  it("includes the next-distribution end-of-month date", async () => {
    const block = await buildPortfolioContextBlock(USER_A, NOW);
    // June 2026 EOM = 2026-06-30.
    expect(block).toContain("2026-06-30");
  });

  it("stays within the block length cap", async () => {
    const block = await buildPortfolioContextBlock(USER_A, NOW);
    expect(block).not.toBeNull();
    expect((block as string).length).toBeLessThanOrEqual(1_200);
  });
});

// ---------------------------------------------------------------------------
// Null cases
// ---------------------------------------------------------------------------

describe("buildPortfolioContextBlock — null when empty", () => {
  it("returns null when no Investor exists for the userId", async () => {
    const block = await buildPortfolioContextBlock("user_unknown", NOW);
    expect(block).toBeNull();
    // Never queries positions for a non-existent investor.
    expect(mockPositionFind).not.toHaveBeenCalled();
  });

  it("returns null when the investor has zero positions", async () => {
    mockPositionFind.mockImplementation((() =>
      Promise.resolve([]) as never) as never);

    const block = await buildPortfolioContextBlock(USER_A, NOW);
    expect(block).toBeNull();
  });
});
