/**
 * chat-context tests (PR-5).
 *
 * buildPortfolioContextBlock(userId) must:
 *   - resolve the Investor strictly from the PASSED userId (never the session),
 *   - aggregate value / accumulated-value YTD / pocket allocation (v3.0: no
 *     periodic distribution is ever asserted),
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
    // A: deployed = 250 000 (principal ONLY — the fixture's accruedYieldUsdc
    // must no longer inflate it: nothing computes that column) ;
    // realized YTD = 1 500 (ledger rows only, no accrued leg).
    expect(blockA).toContain("250 000 USDC");
    expect(blockA).toContain("1 500 USDC");
    // The pre-0082a3ea merged figures must be gone.
    expect(blockA).not.toContain("255 000");
    expect(blockA).not.toContain("6 500");
    // B's distinctive numbers must NOT appear.
    expect(blockA).not.toContain("999");
    expect(blockA).not.toContain("88 888");

    const blockB = await buildPortfolioContextBlock(USER_B, NOW);
    expect(blockB).not.toBeNull();
    // B: deployed = 999 000 principal only (not 999000 + 12345 = 1 011 345).
    expect(blockB).toContain("999 000 USDC");
    expect(blockB).not.toContain("1 011 345");
    expect(blockB).not.toContain("250 000");
  });
});

// ---------------------------------------------------------------------------
// Provenance qualifiers
// ---------------------------------------------------------------------------

describe("buildPortfolioContextBlock — provenance qualifier per figure", () => {
  it("labels figures 'live' when the snapshot is fresh — no 'estimated' merge label", async () => {
    const block = await buildPortfolioContextBlock(USER_A, NOW);
    expect(block).not.toBeNull();
    expect(block).toContain("(live)"); // deployed capital + realized payouts
    // "estimated" existed only because realized+accrued were merged into one
    // figure whose provenance had to hedge. The merge is gone; so is the label.
    expect(block).not.toContain("(estimated)");
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
    // The allocation line still renders — as an honest "not reported" stating
    // the CONTRACTUAL target, labelled spec-not-measurement. Silence would
    // leave the model free to invent one; a percentage would fake a reading.
    expect(block).toContain("Allocation : non rapportee");
    expect(block).toContain("pas une mesure");
    // But no snapshot date line — there is no snapshot to date.
    expect(block).not.toContain("Dernier snapshot");
  });
});

// ---------------------------------------------------------------------------
// Allocation content (no distribution cadence under v3.0)
// ---------------------------------------------------------------------------

describe("buildPortfolioContextBlock — structured content", () => {
  it("includes a compact allocation breakdown from the snapshot", async () => {
    const block = await buildPortfolioContextBlock(USER_A, NOW);
    // v3.0 pocket labels — legacy snapshot bucket keys map onto the 3 pockets.
    expect(block).toContain("Mining Power 35%");
    expect(block).toContain("Reserve USDC 45%");
    expect(block).toContain("BTC Pouch 20%");
  });

  it("never asserts a periodic distribution (v3.0 accumulation note)", async () => {
    const block = await buildPortfolioContextBlock(USER_A, NOW);
    expect(block).not.toBeNull();
    expect(block).not.toContain("distribution");
    expect(block).not.toContain("Prochaine");
    // No fabricated end-of-month cadence date.
    expect(block).not.toContain("2026-06-30");
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

// ---------------------------------------------------------------------------
// LLM truth reconciliation — the chat context may only carry figures the UI's
// corrected contracts would show. It must never restate as fact an unreconciled
// snapshot value, a merged yield, a phantom accrual, or a fabricated date.
// ---------------------------------------------------------------------------

describe("buildPortfolioContextBlock — reconciled with the UI data-truth contracts", () => {
  it("never selects Position.accruedYieldUsdc from the database", async () => {
    await buildPortfolioContextBlock(USER_A, NOW);
    const select = mockPositionFind.mock.calls[0]?.[0]?.select as
      | Record<string, boolean>
      | undefined;
    expect(select).toBeDefined();
    // The column nothing computes must not even be READ — reading it is the
    // first step of every past regression.
    expect(select).not.toHaveProperty("accruedYieldUsdc");
    expect(select).toHaveProperty("principalUsdc");
  });

  it("states accrual as not-applicable rather than a measured figure", async () => {
    const block = await buildPortfolioContextBlock(USER_A, NOW);
    expect(block).toContain("Accrual : non applicable");
    // The fixture carries accruedYieldUsdc: 5000 — it must appear NOWHERE.
    expect(block).not.toContain("5 000");
  });

  it("realized payouts with an empty ledger say 'no payment', never '0 USDC'", async () => {
    mockTxFind.mockImplementation((() => Promise.resolve([]) as never) as never);
    const block = await buildPortfolioContextBlock(USER_A, NOW);
    expect(block).toContain("aucun paiement enregistre");
    // The payout line must carry the sentence, not a "0 USDC" figure. Scoped
    // to that line: "250 000 USDC" on the capital line legitimately ends in
    // "0 USDC" and must not trip this.
    const payoutLine = (block as string)
      .split("\n")
      .find((l) => l.includes("Paiements recus YTD"));
    expect(payoutLine).toBeDefined();
    expect(payoutLine).not.toMatch(/\d\s*USDC/);
  });

  it("never mentions yield or a next distribution — Series 1 has neither", async () => {
    const block = await buildPortfolioContextBlock(USER_A, NOW);
    expect(block).not.toBeNull();
    const lower = (block as string).toLowerCase();
    expect(lower).not.toContain("yield");
    expect(lower).not.toContain("rendement periodique garanti");
    expect(lower).not.toContain("prochaine distribution");
    expect(lower).not.toContain("next distribution");
  });

  it("a STALE vault snapshot cannot pass its allocation off as current", async () => {
    mockSnapshotFind.mockImplementation((() =>
      Promise.resolve({
        takenAt: STALE_SNAPSHOT_AT,
        allocations: [{ bucket: "mining", pct: 35 }],
      }) as never) as never);

    const block = await buildPortfolioContextBlock(USER_A, NOW);
    // The stale snapshot's percentages must not render at all — the block
    // reports "not reported" plus the contractual target, labelled as spec.
    expect(block).not.toContain("35%");
    expect(block).toContain("Allocation : non rapportee");
    expect(block).toContain("B1 40% / B2 27% / B3 33%");
    expect(block).toContain("pas une mesure");
  });

  it("a FRESH snapshot allocation is dated and marked non-contractual", async () => {
    const block = await buildPortfolioContextBlock(USER_A, NOW);
    // The snapshot taxonomy (cron/seed, four-sleeve) is not reconciled with
    // the contract's B1/B2/B3 — it may inform, never assert.
    expect(block).toContain("non contractuelle");
    expect(block).toContain("2026-06-11");
  });

  it("deployed capital is labelled as ledger principal, not as a mark-to-book value", async () => {
    const block = await buildPortfolioContextBlock(USER_A, NOW);
    expect(block).toContain("Capital deploye");
    expect(block).toContain("principal du ledger");
    // The old "Valeur totale" label implied a computed valuation that nothing
    // computes.
    expect(block).not.toContain("Valeur totale");
  });
});
