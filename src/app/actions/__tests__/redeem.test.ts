/**
 * Unit tests for the redeem (withdraw) server action.
 *
 * Verifies the guards and the position-update branch (full exit vs partial),
 * mirroring the deposit/subscribe contract.
 *
 * TOCTOU fix (DB-4): the $transaction now receives an async callback that
 * re-reads the position and uses a conditional updateMany. Tests reflect that.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Prisma } from "@prisma/client";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/auth/session", () => ({ getInvestor: vi.fn() }));

type TxPosition = {
  status: string;
  principalUsdc: { toNumber: () => number };
};

type OuterPosition = {
  id: string;
  investorId: string;
  status: string;
  principalUsdc: { toNumber: () => number };
};

const txFindUnique = vi.fn<
  (args: Prisma.PositionFindUniqueArgs) => Promise<TxPosition | null>
>();
const txUpdateMany = vi.fn<
  (args: Prisma.PositionUpdateManyArgs) => Promise<Prisma.BatchPayload>
>();
const txCreate = vi.fn<
  (args: Prisma.InvestorTransactionCreateArgs) => Promise<object>
>();

const txClient = {
  position: {
    findUnique: (a: Prisma.PositionFindUniqueArgs) => txFindUnique(a),
    updateMany: (a: Prisma.PositionUpdateManyArgs) => txUpdateMany(a),
  },
  investorTransaction: {
    create: (a: Prisma.InvestorTransactionCreateArgs) => txCreate(a),
  },
};

const findUnique = vi.fn<
  (args: Prisma.PositionFindUniqueArgs) => Promise<OuterPosition | null>
>();
const txn = vi.fn<
  (fn: (tx: typeof txClient) => Promise<unknown>) => Promise<unknown>
>();

vi.mock("@/lib/db", () => ({
  prisma: {
    position: {
      findUnique: (a: Prisma.PositionFindUniqueArgs) => findUnique(a),
    },
    investorTransaction: { create: vi.fn(() => ({ __op: "create" })) },
    $transaction: (fn: (tx: typeof txClient) => Promise<unknown>) => txn(fn),
  },
}));

import { redeem } from "@/app/actions/redeem";
import { getInvestor } from "@/lib/auth/session";

const mockGetInvestor = vi.mocked(getInvestor);
const INVESTOR = {
  id: "inv_1",
  userId: "user_1",
  walletAddress: null,
  email: "lp@firm.io",
  kycStatus: "approved",
  accreditationAttestedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function pos(over: Partial<{ status: string; principal: number; investorId: string }>) {
  return {
    id: "pos_1",
    investorId: over.investorId ?? "inv_1",
    status: over.status ?? "active",
    principalUsdc: { toNumber: () => over.principal ?? 250_000 },
  };
}

/**
 * Wire up the $transaction mock to execute the async callback with the tx client.
 * Also set txFindUnique to return a fresh position for re-validation inside the tx.
 */
function mockTxSuccess(principal = 250_000, status = "active") {
  txFindUnique.mockResolvedValue({
    status,
    principalUsdc: { toNumber: () => principal },
  });
  txUpdateMany.mockResolvedValue({ count: 1 });
  txCreate.mockResolvedValue({});
  txn.mockImplementation(async (fn) => fn(txClient));
}

describe("redeem server action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("unauthenticated → throws", async () => {
    mockGetInvestor.mockResolvedValue(null);
    await expect(redeem("pos_1", 1000)).rejects.toThrow();
  });

  it("rejects an invalid amount without touching the DB", async () => {
    mockGetInvestor.mockResolvedValue(INVESTOR);
    const r = await redeem("pos_1", 0);
    expect(r.ok).toBe(false);
    expect(txn).not.toHaveBeenCalled();
  });

  it("rejects a position the investor does not own", async () => {
    mockGetInvestor.mockResolvedValue(INVESTOR);
    findUnique.mockResolvedValue(pos({ investorId: "someone_else" }));
    const r = await redeem("pos_1", 1000);
    expect(r).toEqual({ ok: false, error: "Position not found." });
    expect(txn).not.toHaveBeenCalled();
  });

  it("rejects a non-active position (outer guard)", async () => {
    mockGetInvestor.mockResolvedValue(INVESTOR);
    findUnique.mockResolvedValue(pos({ status: "exited" }));
    const r = await redeem("pos_1", 1000);
    expect(r.ok).toBe(false);
    expect(txn).not.toHaveBeenCalled();
  });

  it("rejects an amount above the principal (outer guard)", async () => {
    mockGetInvestor.mockResolvedValue(INVESTOR);
    findUnique.mockResolvedValue(pos({ principal: 250_000 }));
    const r = await redeem("pos_1", 300_000);
    expect(r.ok).toBe(false);
    expect(txn).not.toHaveBeenCalled();
  });

  it("full redemption closes the position (exited)", async () => {
    mockGetInvestor.mockResolvedValue(INVESTOR);
    findUnique.mockResolvedValue(pos({ principal: 250_000 }));
    mockTxSuccess(250_000);
    const r = await redeem("pos_1", 250_000, "0xabc");
    expect(r).toEqual({ ok: true, positionId: "pos_1", closed: true });
    expect(txn).toHaveBeenCalledOnce();
  });

  it("partial redemption keeps the position active", async () => {
    mockGetInvestor.mockResolvedValue(INVESTOR);
    findUnique.mockResolvedValue(pos({ principal: 250_000 }));
    mockTxSuccess(250_000);
    const r = await redeem("pos_1", 100_000, "0xdef");
    expect(r).toEqual({ ok: true, positionId: "pos_1", closed: false });
    expect(txn).toHaveBeenCalledOnce();
  });

  // ── TOCTOU / conditional update tests ────────────────────────────────────

  it("DB-4: updateMany is called with conditional principal guard (gte amount)", async () => {
    mockGetInvestor.mockResolvedValue(INVESTOR);
    findUnique.mockResolvedValue(pos({ principal: 250_000 }));
    mockTxSuccess(250_000);
    await redeem("pos_1", 100_000, "0xtoctou");
    expect(txUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          principalUsdc: expect.objectContaining({ gte: expect.anything() }),
        }),
      }),
    );
  });

  it("DB-4: when updateMany returns count=0 (concurrent conflict), the transaction throws", async () => {
    mockGetInvestor.mockResolvedValue(INVESTOR);
    findUnique.mockResolvedValue(pos({ principal: 250_000 }));
    txFindUnique.mockResolvedValue({
      status: "active",
      principalUsdc: { toNumber: () => 250_000 },
    });
    txUpdateMany.mockResolvedValue({ count: 0 });
    txn.mockImplementation(async (fn) => fn(txClient));
    await expect(redeem("pos_1", 100_000)).rejects.toThrow(/concurrent/i);
  });

  it("DB-4: inner tx re-check catches a position that went inactive between outer read and tx", async () => {
    mockGetInvestor.mockResolvedValue(INVESTOR);
    findUnique.mockResolvedValue(pos({ principal: 250_000, status: "active" }));
    txFindUnique.mockResolvedValue({
      status: "exited",
      principalUsdc: { toNumber: () => 0 },
    });
    txn.mockImplementation(async (fn) => fn(txClient));
    await expect(redeem("pos_1", 100_000)).rejects.toThrow(/not active/i);
  });
});
