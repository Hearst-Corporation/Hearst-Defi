/**
 * Unit tests for src/lib/distribution/atomic-exec.ts
 *
 * Coverage:
 *   1. happy path — all artifacts created, correct return shape
 *   2. distribution not pending → throws AtomicExecError(NOT_PENDING)
 *   3. computation: sum of ledger entries == distribution.amountUsdc
 *   4. rollback: pcap creation fail → ledger entries not committed
 *   5. Inngest event emitted with correct payload
 *   6. BLA-5/JOB-4: CAS — concurrent second call gets NOT_PENDING (count=0)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Must be declared before any imports that pull in the mocked modules.

vi.mock("@/lib/db", () => ({
  prisma: {
    distribution: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    position: {
      findMany: vi.fn(),
    },
    distributionLedgerEntry: {
      createMany: vi.fn(),
    },
    pcap: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: {
    send: vi.fn(),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { prisma } from "@/lib/db";
import { inngest } from "@/lib/inngest/client";
import {
  executeDistributionAtomically,
  AtomicExecError,
} from "../atomic-exec";
import { DISTRIBUTION_EVENTS } from "../events";

// ── Helpers ───────────────────────────────────────────────────────────────────

const DIST_ID = "dist_test_001";
const PERIOD = "2026-05";
const AMOUNT_USDC = 10_000;

function buildDistribution(status = "pending") {
  return {
    id: DIST_ID,
    period: PERIOD,
    amountUsdc: { toNumber: () => AMOUNT_USDC },
    status,
  };
}

function buildPositions(
  items: Array<{ id: string; investorId: string; principal: number }>,
) {
  return items.map((p) => ({
    id: p.id,
    investorId: p.investorId,
    principalUsdc: { toNumber: () => p.principal },
  }));
}

/**
 * Helper that simulates a real Prisma $transaction by running the callback
 * with the mocked prisma client. Also wires updateMany to return count=1
 * (successful CAS) by default.
 */
function mockTransactionSuccess() {
  // Default CAS: count=1 (first and only caller wins)
  vi.mocked(prisma.distribution.updateMany).mockResolvedValue({ count: 1 } as never);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (prisma.$transaction as any).mockImplementation(
    async (fn: (tx: unknown) => Promise<unknown>) => {
      const { prisma: tx } = await import("@/lib/db");
      return fn(tx);
    },
  );
}

function mockTransactionReject(msg: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (prisma.$transaction as any).mockRejectedValue(new Error(msg));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("executeDistributionAtomically", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 1. Happy path ──────────────────────────────────────────────────────────

  it("happy path — returns all artifacts, marks distribution executed via CAS", async () => {
    vi.mocked(prisma.distribution.findUnique).mockResolvedValue(
      buildDistribution("pending") as never,
    );
    vi.mocked(prisma.position.findMany).mockResolvedValue(
      buildPositions([
        { id: "pos1", investorId: "inv1", principal: 6_000 },
        { id: "pos2", investorId: "inv2", principal: 4_000 },
      ]) as never,
    );

    mockTransactionSuccess();

    vi.mocked(prisma.distributionLedgerEntry.createMany).mockResolvedValue(
      { count: 2 } as never,
    );

    const pcapCreatedAt = new Date("2026-05-26T12:00:00Z");
    vi.mocked(prisma.pcap.create).mockResolvedValue({
      id: "pcap_001",
      distributionId: DIST_ID,
      generatedAt: pcapCreatedAt,
      pdfUrl: `/pcap/${DIST_ID}/distribution-${PERIOD}.pdf`,
      generatedFor: "distribution",
    } as never);

    vi.mocked(prisma.distribution.update).mockResolvedValue({} as never);
    vi.mocked(inngest.send).mockResolvedValue(undefined as never);

    const result = await executeDistributionAtomically(DIST_ID);

    // tx
    expect(result.tx.hash).toBe(`0xMOCK_${DIST_ID}`);
    expect(result.tx.status).toBe("pending");

    // ledger entries
    expect(result.ledgerEntries).toHaveLength(2);
    expect(result.ledgerEntries[0]!.positionId).toBe("pos1");
    expect(result.ledgerEntries[1]!.positionId).toBe("pos2");

    // pcap
    expect(result.pcap.pdfUrl).toContain(DIST_ID);
    expect(result.pcap.generatedAt).toEqual(pcapCreatedAt);

    // emails
    expect(result.emailsQueued).toBe(1);

    // CAS: distribution.updateMany must have been called with pending guard
    expect(prisma.distribution.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: DIST_ID, status: "pending" },
        data: expect.objectContaining({
          status: "executed",
          txHash: `0xMOCK_${DIST_ID}`,
        }),
      }),
    );
  });

  // ── 2. Distribution not pending ────────────────────────────────────────────

  it("not pending (outer guard) — throws AtomicExecError with code NOT_PENDING", async () => {
    vi.mocked(prisma.distribution.findUnique).mockResolvedValue(
      buildDistribution("executed") as never,
    );

    await expect(
      executeDistributionAtomically(DIST_ID),
    ).rejects.toThrow(AtomicExecError);

    await expect(
      executeDistributionAtomically(DIST_ID),
    ).rejects.toMatchObject({ code: "NOT_PENDING" });
  });

  it("distribution not found — throws AtomicExecError with code NOT_PENDING", async () => {
    vi.mocked(prisma.distribution.findUnique).mockResolvedValue(null);

    await expect(
      executeDistributionAtomically(DIST_ID),
    ).rejects.toThrow(AtomicExecError);
  });

  // ── 3. Computation: sum of ledger entries == amountUsdc ────────────────────

  it("sum of ledger entries equals distribution.amountUsdc", async () => {
    const total = 30_000;
    const distribution = {
      id: DIST_ID,
      period: PERIOD,
      amountUsdc: { toNumber: () => total },
      status: "pending",
    };

    vi.mocked(prisma.distribution.findUnique).mockResolvedValue(
      distribution as never,
    );
    vi.mocked(prisma.position.findMany).mockResolvedValue(
      buildPositions([
        { id: "pos1", investorId: "inv1", principal: 10_000 },
        { id: "pos2", investorId: "inv2", principal: 15_000 },
        { id: "pos3", investorId: "inv3", principal: 5_000 },
      ]) as never,
    );

    mockTransactionSuccess();
    vi.mocked(prisma.distributionLedgerEntry.createMany).mockResolvedValue(
      { count: 3 } as never,
    );
    vi.mocked(prisma.pcap.create).mockResolvedValue({
      id: "pcap_002",
      distributionId: DIST_ID,
      generatedAt: new Date(),
      pdfUrl: "/pcap/stub.pdf",
      generatedFor: "distribution",
    } as never);
    vi.mocked(prisma.distribution.update).mockResolvedValue({} as never);
    vi.mocked(inngest.send).mockResolvedValue(undefined as never);

    const result = await executeDistributionAtomically(DIST_ID);

    const sum = result.ledgerEntries.reduce(
      (acc, entry) => acc + entry.amount,
      0,
    );

    // Sum must match total (allow for floating-point rounding < $0.02 per entry)
    expect(Math.abs(sum - total)).toBeLessThan(0.02 * result.ledgerEntries.length);
  });

  // ── 4. Rollback: pcap fail → ledger entries not committed ─────────────────

  it("transaction rollback — if $transaction throws, error is wrapped in AtomicExecError", async () => {
    vi.mocked(prisma.distribution.findUnique).mockResolvedValue(
      buildDistribution("pending") as never,
    );
    vi.mocked(prisma.position.findMany).mockResolvedValue(
      buildPositions([
        { id: "pos1", investorId: "inv1", principal: 10_000 },
      ]) as never,
    );

    // Simulate pcap creation failing inside the transaction by making
    // $transaction itself reject (Prisma rolls back on any throw inside the callback).
    mockTransactionReject("pcap creation failed — simulated DB error");

    await expect(
      executeDistributionAtomically(DIST_ID),
    ).rejects.toThrow(AtomicExecError);

    await expect(
      executeDistributionAtomically(DIST_ID),
    ).rejects.toMatchObject({ code: "PERSIST_FAILED" });

    // distribution.update must NOT have been called (rolled back)
    expect(prisma.distribution.update).not.toHaveBeenCalled();
    // createMany must NOT have been called outside the failed transaction
    expect(prisma.distributionLedgerEntry.createMany).not.toHaveBeenCalled();
  });

  // ── 5. Inngest event emitted ───────────────────────────────────────────────

  it("emits distribution.executed Inngest event with correct payload", async () => {
    vi.mocked(prisma.distribution.findUnique).mockResolvedValue(
      buildDistribution("pending") as never,
    );
    vi.mocked(prisma.position.findMany).mockResolvedValue(
      buildPositions([
        { id: "pos1", investorId: "inv1", principal: AMOUNT_USDC },
      ]) as never,
    );

    mockTransactionSuccess();
    vi.mocked(prisma.distributionLedgerEntry.createMany).mockResolvedValue(
      { count: 1 } as never,
    );
    vi.mocked(prisma.pcap.create).mockResolvedValue({
      id: "pcap_003",
      distributionId: DIST_ID,
      generatedAt: new Date(),
      pdfUrl: "/pcap/stub.pdf",
      generatedFor: "distribution",
    } as never);
    vi.mocked(prisma.distribution.update).mockResolvedValue({} as never);
    vi.mocked(inngest.send).mockResolvedValue(undefined as never);

    await executeDistributionAtomically(DIST_ID);

    expect(inngest.send).toHaveBeenCalledOnce();
    expect(inngest.send).toHaveBeenCalledWith(
      expect.objectContaining({
        name: DISTRIBUTION_EVENTS.EXECUTED,
        data: expect.objectContaining({
          distributionId: DIST_ID,
          period: PERIOD,
          amountUsdc: AMOUNT_USDC,
          txHash: `0xMOCK_${DIST_ID}`,
        }),
      }),
    );
  });

  // ── Bonus: Inngest failure is non-fatal ────────────────────────────────────

  it("Inngest send failure is non-fatal — result still returned", async () => {
    vi.mocked(prisma.distribution.findUnique).mockResolvedValue(
      buildDistribution("pending") as never,
    );
    vi.mocked(prisma.position.findMany).mockResolvedValue(
      buildPositions([
        { id: "pos1", investorId: "inv1", principal: AMOUNT_USDC },
      ]) as never,
    );

    mockTransactionSuccess();
    vi.mocked(prisma.distributionLedgerEntry.createMany).mockResolvedValue(
      { count: 1 } as never,
    );
    vi.mocked(prisma.pcap.create).mockResolvedValue({
      id: "pcap_004",
      distributionId: DIST_ID,
      generatedAt: new Date(),
      pdfUrl: "/pcap/stub.pdf",
      generatedFor: "distribution",
    } as never);
    vi.mocked(prisma.distribution.update).mockResolvedValue({} as never);

    // Inngest throws
    vi.mocked(inngest.send).mockRejectedValue(new Error("network error"));

    const result = await executeDistributionAtomically(DIST_ID);

    // Should still succeed — emailsQueued = 0 (send failed)
    expect(result.tx.hash).toBe(`0xMOCK_${DIST_ID}`);
    expect(result.emailsQueued).toBe(0);
  });

  // ── 6. BLA-5/JOB-4: CAS concurrency — second finisher gets NOT_PENDING ─────

  it("BLA-5: CAS count=0 inside transaction throws NOT_PENDING (concurrent finisher)", async () => {
    vi.mocked(prisma.distribution.findUnique).mockResolvedValue(
      buildDistribution("pending") as never,
    );
    vi.mocked(prisma.position.findMany).mockResolvedValue(
      buildPositions([
        { id: "pos1", investorId: "inv1", principal: AMOUNT_USDC },
      ]) as never,
    );

    // Simulate the loser of a concurrent race: CAS finds no pending row (count=0)
    vi.mocked(prisma.distribution.updateMany).mockResolvedValue({ count: 0 } as never);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.$transaction as any).mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => {
        const { prisma: tx } = await import("@/lib/db");
        return fn(tx);
      },
    );

    await expect(
      executeDistributionAtomically(DIST_ID),
    ).rejects.toMatchObject({ code: "NOT_PENDING" });

    // Ledger entries must NOT have been written
    expect(prisma.distributionLedgerEntry.createMany).not.toHaveBeenCalled();
    expect(prisma.pcap.create).not.toHaveBeenCalled();
  });
});
