/**
 * Unit tests for src/app/admin/distributions/actions.ts
 *
 * Coverage focus:
 *   P0   — vaultRef Zod validation (computeDistribution + confirmDistribution)
 *   P0   — vaultRef persisted on the Distribution row (confirmDistribution happy path)
 *   P0-3 — TOCTOU race: P2002 inside the tx → already-confirmed, no double-pay
 *   P1-A — server-derived signer identity: ONE authenticated admin can NOT reach
 *          quorum by calling confirmDistribution twice; TWO DISTINCT admins do.
 *   P1-B — honest finisher status: a failing atomic finisher returns
 *          finisher:'failed' (+ distributionId), never a silent { confirmed:true }.
 *   P1-B — retryDistributionFinisher drives a pending row to success and maps
 *          NOT_PENDING to a non-crash "already finalised" result.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (declared before module import) ────────────────────────────────────

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    position: {
      findMany: vi.fn(),
    },
    distribution: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    distributionApproval: {
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
    investorTransaction: {
      createMany: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      // Pass a proxy that resolves to the outer mocked prisma for simplicity.
      // Tests that need $transaction behaviour set up the mock themselves.
      const { prisma: p } = await import("@/lib/db");
      return fn(p);
    }),
  },
}));

vi.mock("@/lib/admin/audit", () => ({
  recordAdminAudit: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  assertRateLimit: vi.fn().mockResolvedValue(undefined),
}));

// Keep AtomicExecError as a REAL class so `instanceof` checks inside
// retryDistributionFinisher / confirmDistribution work, while the finisher
// itself stays a spy we can drive per-test.
vi.mock("@/lib/distribution/atomic-exec", () => {
  class AtomicExecError extends Error {
    constructor(
      message: string,
      public readonly code:
        | "NOT_PENDING"
        | "NO_POSITIONS"
        | "ZERO_PRINCIPAL"
        | "PERSIST_FAILED"
        | "EVENT_FAILED",
    ) {
      super(message);
      this.name = "AtomicExecError";
    }
  }
  return {
    AtomicExecError,
    executeDistributionAtomically: vi.fn().mockResolvedValue({}),
  };
});

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import {
  AtomicExecError,
  executeDistributionAtomically,
} from "@/lib/distribution/atomic-exec";
import {
  computeDistribution,
  confirmDistribution,
  retryDistributionFinisher,
} from "../actions";

// ── Helpers ───────────────────────────────────────────────────────────────────

// Admins have NO Investor row → requireAdmin returns walletAddress=undefined,
// so the server-derived signer key collapses to admin.userId. Two DISTINCT
// admins therefore produce two DISTINCT signerWallet values.
const ADMIN_1 = { userId: "admin_001" } as const;
const ADMIN_2 = { userId: "admin_002" } as const;
const PERIOD = "2026-05";
const TOTAL_USDC = 10_000;
const VAULT_REF = "yield";

function buildPosition(id: string, investorId: string, principal: number) {
  return {
    id,
    investorId,
    principalUsdc: { toNumber: () => principal },
    investor: { id: investorId, walletAddress: `0xWallet${id}` },
  };
}

// ── computeDistribution ───────────────────────────────────────────────────────

describe("computeDistribution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue(ADMIN_1);
  });

  it("P0 — missing vaultRef (empty string) → throws Invalid input", async () => {
    await expect(
      computeDistribution(PERIOD, TOTAL_USDC, ""),
    ).rejects.toThrow(/Invalid input/);
  });

  it("P0 — valid vaultRef included in result", async () => {
    vi.mocked(prisma.position.findMany).mockResolvedValue([
      buildPosition("pos1", "inv1", 10_000),
    ] as never);

    const result = await computeDistribution(PERIOD, TOTAL_USDC, VAULT_REF);

    expect(result.vaultRef).toBe(VAULT_REF);
    expect(result.period).toBe(PERIOD);
    expect(result.totalUsdc).toBe(TOTAL_USDC);
  });

  it("P1 — empty positions → returns result with vaultRef and empty recipients", async () => {
    vi.mocked(prisma.position.findMany).mockResolvedValue([] as never);

    const result = await computeDistribution(PERIOD, TOTAL_USDC, VAULT_REF);

    expect(result.vaultRef).toBe(VAULT_REF);
    expect(result.recipients).toHaveLength(0);
  });

  it("P1 — zero total principal → returns result with vaultRef and empty recipients", async () => {
    vi.mocked(prisma.position.findMany).mockResolvedValue([
      buildPosition("pos1", "inv1", 0),
    ] as never);

    const result = await computeDistribution(PERIOD, TOTAL_USDC, VAULT_REF);

    expect(result.vaultRef).toBe(VAULT_REF);
    expect(result.recipients).toHaveLength(0);
  });

  it("P1 — deployment vault slug is accepted", async () => {
    vi.mocked(prisma.position.findMany).mockResolvedValue([
      buildPosition("pos1", "inv1", 5_000),
    ] as never);

    const result = await computeDistribution(PERIOD, TOTAL_USDC, "hyv-a");

    expect(result.vaultRef).toBe("hyv-a");
  });
});

// ── confirmDistribution ───────────────────────────────────────────────────────

describe("confirmDistribution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default identity; tests that exercise the multisig path override per-call
    // with mockResolvedValueOnce to model distinct authenticated admins.
    vi.mocked(requireAdmin).mockResolvedValue(ADMIN_1);
  });

  it("P0 — missing vaultRef (empty string) → throws Invalid input", async () => {
    await expect(
      confirmDistribution(PERIOD, TOTAL_USDC, ""),
    ).rejects.toThrow(/Invalid input/);
  });

  it("P0 — first signer creates approval with the SERVER-DERIVED key, returns not-yet-confirmed", async () => {
    vi.mocked(prisma.distribution.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.distributionApproval.findMany).mockResolvedValue(
      [] as never,
    );
    vi.mocked(prisma.distributionApproval.create).mockResolvedValue({
      id: "approval_1",
    } as never);
    vi.mocked(prisma.distributionApproval.count).mockResolvedValue(1);

    const result = await confirmDistribution(PERIOD, TOTAL_USDC, VAULT_REF);

    expect(result.confirmed).toBe(false);
    expect(result.signersCount).toBe(1);
    expect(result.required).toBe(2);

    // The signerWallet written is the authenticated admin identity (userId),
    // NEVER a client-supplied wallet string.
    expect(prisma.distributionApproval.create).toHaveBeenCalledWith({
      data: {
        period: PERIOD,
        signerWallet: ADMIN_1.userId,
        totalUsdc: TOTAL_USDC,
      },
    });
  });

  // ── P1-A: the OLD bypass is gone. One authenticated admin signing twice
  // cannot forge quorum, because the signer key is derived server-side from
  // the SAME userId both times → @@unique([period, signerWallet]) de-dups it. ──
  it("P1-A — SAME admin confirming twice does NOT reach quorum (count stays 1, no distribution created)", async () => {
    // Both calls resolve to the same authenticated admin.
    vi.mocked(requireAdmin).mockResolvedValue(ADMIN_1);
    vi.mocked(prisma.distribution.findFirst).mockResolvedValue(null);

    // ── Call #1: no prior approvals → first-signer path creates the row.
    vi.mocked(prisma.distributionApproval.findMany).mockResolvedValueOnce(
      [] as never,
    );
    vi.mocked(prisma.distributionApproval.create).mockResolvedValue(
      { id: "approval_1" } as never,
    );
    // After call #1 the period has exactly one distinct signer.
    vi.mocked(prisma.distributionApproval.count).mockResolvedValueOnce(1);

    const first = await confirmDistribution(PERIOD, TOTAL_USDC, VAULT_REF);
    expect(first.confirmed).toBe(false);
    expect(first.signersCount).toBe(1);

    // ── Call #2: SAME admin signs again. There is already one approval row for
    // this admin; the idempotent create is a no-op (unique key collision) so the
    // distinct-signer count is STILL 1.
    const existingApproval = {
      id: "approval_1",
      period: PERIOD,
      signerWallet: ADMIN_1.userId,
      totalUsdc: { toNumber: () => TOTAL_USDC },
    };
    vi.mocked(prisma.distributionApproval.findMany).mockResolvedValueOnce([
      existingApproval,
    ] as never);
    // Subsequent-signer path: the create collides on @@unique and is swallowed.
    vi.mocked(prisma.distributionApproval.create).mockRejectedValueOnce(
      new Error("unique"),
    );
    vi.mocked(prisma.distributionApproval.count).mockResolvedValueOnce(1);

    const second = await confirmDistribution(PERIOD, TOTAL_USDC, VAULT_REF);

    expect(second.confirmed).toBe(false);
    expect(second.signersCount).toBe(1);
    expect(second.required).toBe(2);

    // Quorum was NEVER reached → nothing was distributed.
    expect(prisma.distribution.create).not.toHaveBeenCalled();
    expect(executeDistributionAtomically).not.toHaveBeenCalled();
    expect(prisma.investorTransaction.createMany).not.toHaveBeenCalled();
  });

  // ── P1-A: TWO DISTINCT authenticated admins DO reach quorum. ────────────────
  it("P1-A — TWO DISTINCT admins reach quorum: distribution created once, finisher called, confirmed", async () => {
    vi.mocked(prisma.distribution.findFirst).mockResolvedValue(null);

    // ── Call #1: admin_001, first signer.
    vi.mocked(requireAdmin).mockResolvedValueOnce(ADMIN_1);
    vi.mocked(prisma.distributionApproval.findMany).mockResolvedValueOnce(
      [] as never,
    );
    vi.mocked(prisma.distributionApproval.create).mockResolvedValueOnce(
      { id: "approval_1" } as never,
    );
    vi.mocked(prisma.distributionApproval.count).mockResolvedValueOnce(1);

    const first = await confirmDistribution(PERIOD, TOTAL_USDC, VAULT_REF);
    expect(first.confirmed).toBe(false);
    expect(first.signersCount).toBe(1);

    // The first signer row was keyed by admin_001's userId.
    expect(prisma.distributionApproval.create).toHaveBeenLastCalledWith({
      data: {
        period: PERIOD,
        signerWallet: ADMIN_1.userId,
        totalUsdc: TOTAL_USDC,
      },
    });

    // ── Call #2: admin_002, second DISTINCT signer → reaches quorum.
    vi.mocked(requireAdmin).mockResolvedValueOnce(ADMIN_2);
    const firstApproval = {
      id: "approval_1",
      period: PERIOD,
      signerWallet: ADMIN_1.userId,
      totalUsdc: { toNumber: () => TOTAL_USDC },
    };
    vi.mocked(prisma.distributionApproval.findMany).mockResolvedValueOnce([
      firstApproval,
    ] as never);
    vi.mocked(prisma.distributionApproval.create).mockResolvedValueOnce(
      { id: "approval_2" } as never,
    );
    vi.mocked(prisma.distributionApproval.count).mockResolvedValueOnce(2);

    // compute() runs again inside confirm at threshold.
    vi.mocked(prisma.position.findMany).mockResolvedValue([
      buildPosition("pos1", "inv1", TOTAL_USDC),
    ] as never);

    const createdDistribution = { id: "dist_001" };
    vi.mocked(prisma.distribution.create).mockResolvedValue(
      createdDistribution as never,
    );
    vi.mocked(prisma.investorTransaction.createMany).mockResolvedValue(
      { count: 1 } as never,
    );
    vi.mocked(prisma.distributionApproval.deleteMany).mockResolvedValue(
      { count: 2 } as never,
    );

    const second = await confirmDistribution(PERIOD, TOTAL_USDC, VAULT_REF);

    expect(second.confirmed).toBe(true);
    expect(second.signersCount).toBe(2);
    expect(second.required).toBe(2);

    // The second signer row was keyed by admin_002's userId — a DISTINCT signer.
    expect(prisma.distributionApproval.create).toHaveBeenLastCalledWith({
      data: {
        period: PERIOD,
        signerWallet: ADMIN_2.userId,
        totalUsdc: firstApproval.totalUsdc,
      },
    });

    // Exactly one distribution created, persisted with the vaultRef.
    expect(prisma.distribution.create).toHaveBeenCalledTimes(1);
    expect(prisma.distribution.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ vaultRef: VAULT_REF }),
      }),
    );

    // Finisher kicked off honestly with the created id; status surfaced.
    expect(executeDistributionAtomically).toHaveBeenCalledWith(
      createdDistribution.id,
    );
    expect(second.finisher).toBe("ok");
    expect(second.distributionId).toBe(createdDistribution.id);
  });

  it("P1 — duplicate period → throws already confirmed", async () => {
    vi.mocked(prisma.distribution.findFirst).mockResolvedValue({
      id: "dist_existing",
    } as never);

    await expect(
      confirmDistribution(PERIOD, TOTAL_USDC, VAULT_REF),
    ).rejects.toThrow(/already been confirmed/);
  });

  // ── P0-3: TOCTOU race — the application findFirst passes but a concurrent
  // confirmation already created the row; the @@unique([period, vaultRef])
  // constraint fires inside the transaction (P2002). We must surface
  // "already confirmed" and never double-create/double-pay. ──────────────────
  it("P0-3 — concurrent confirm losing the race (P2002 in tx) → throws already confirmed, no double-pay", async () => {
    // Two distinct admins so quorum is legitimately reached at this call.
    const firstApproval = {
      id: "approval_1",
      period: PERIOD,
      signerWallet: ADMIN_1.userId,
      totalUsdc: { toNumber: () => TOTAL_USDC },
    };

    vi.mocked(requireAdmin).mockResolvedValueOnce(ADMIN_2);
    // Application-level guard misses (the other tx hadn't committed when we read).
    vi.mocked(prisma.distribution.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.distributionApproval.findMany).mockResolvedValue([
      firstApproval,
    ] as never);
    vi.mocked(prisma.distributionApproval.create).mockResolvedValue({} as never);
    vi.mocked(prisma.distributionApproval.count).mockResolvedValue(2);
    vi.mocked(prisma.position.findMany).mockResolvedValue([
      buildPosition("pos1", "inv1", TOTAL_USDC),
    ] as never);

    // The DB unique constraint rejects the second distribution.create.
    const p2002 = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed on the fields: (`period`,`vaultRef`)",
      { code: "P2002", clientVersion: "7.x" },
    );
    vi.mocked(prisma.distribution.create).mockRejectedValue(p2002);

    await expect(
      confirmDistribution(PERIOD, TOTAL_USDC, VAULT_REF),
    ).rejects.toThrow(/already been confirmed/);

    // No recipient transactions were written for the losing confirmation.
    expect(prisma.investorTransaction.createMany).not.toHaveBeenCalled();
  });

  // ── P1-B: a failing atomic finisher must NOT be papered over. The confirm
  // succeeded (distribution row created) but finalisation (ledger / PCAP /
  // status→executed / emails) failed → return finisher:'failed' + the id so the
  // UI can offer a retry, instead of a silent { confirmed:true } with no signal. ─
  it("P1-B — finisher rejects (PERSIST_FAILED) → confirmed:true but finisher:'failed' + distributionId set", async () => {
    const firstApproval = {
      id: "approval_1",
      period: PERIOD,
      signerWallet: ADMIN_1.userId,
      totalUsdc: { toNumber: () => TOTAL_USDC },
    };

    vi.mocked(requireAdmin).mockResolvedValueOnce(ADMIN_2);
    vi.mocked(prisma.distribution.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.distributionApproval.findMany).mockResolvedValue([
      firstApproval,
    ] as never);
    vi.mocked(prisma.distributionApproval.create).mockResolvedValue({} as never);
    vi.mocked(prisma.distributionApproval.count).mockResolvedValue(2);
    vi.mocked(prisma.position.findMany).mockResolvedValue([
      buildPosition("pos1", "inv1", TOTAL_USDC),
    ] as never);

    const createdDistribution = { id: "dist_777" };
    vi.mocked(prisma.distribution.create).mockResolvedValue(
      createdDistribution as never,
    );
    vi.mocked(prisma.investorTransaction.createMany).mockResolvedValue(
      { count: 1 } as never,
    );
    vi.mocked(prisma.distributionApproval.deleteMany).mockResolvedValue(
      { count: 2 } as never,
    );

    // The finisher blows up AFTER the distribution row is committed.
    vi.mocked(executeDistributionAtomically).mockRejectedValueOnce(
      new AtomicExecError("ledger write failed", "PERSIST_FAILED"),
    );

    const result = await confirmDistribution(PERIOD, TOTAL_USDC, VAULT_REF);

    // The confirm itself succeeded — we do NOT roll back a committed distribution.
    expect(result.confirmed).toBe(true);
    // …but finalisation is reported HONESTLY so the UI can offer a retry.
    expect(result.finisher).toBe("failed");
    expect(result.distributionId).toBe(createdDistribution.id);
  });
});

// ── retryDistributionFinisher ───────────────────────────────────────────────

describe("retryDistributionFinisher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue(ADMIN_1);
  });

  it("P1-B — pending row → drives finisher to success, returns finisher:'ok'", async () => {
    vi.mocked(executeDistributionAtomically).mockResolvedValueOnce(
      {} as never,
    );

    const result = await retryDistributionFinisher("dist_777");

    expect(executeDistributionAtomically).toHaveBeenCalledWith("dist_777");
    expect(result).toEqual({ finisher: "ok" });
  });

  it("P1-B — NOT_PENDING (already finalised) → maps to a non-crash finisher:'ok'", async () => {
    vi.mocked(executeDistributionAtomically).mockRejectedValueOnce(
      new AtomicExecError("not pending", "NOT_PENDING"),
    );

    const result = await retryDistributionFinisher("dist_777");

    expect(result).toEqual({ finisher: "ok" });
  });

  it("P1-B — genuine failure (PERSIST_FAILED) → returns finisher:'failed' with a message", async () => {
    vi.mocked(executeDistributionAtomically).mockRejectedValueOnce(
      new AtomicExecError("ledger write failed", "PERSIST_FAILED"),
    );

    const result = await retryDistributionFinisher("dist_777");

    expect(result.finisher).toBe("failed");
    if (result.finisher === "failed") {
      expect(result.message).toMatch(/ledger write failed/);
    }
  });
});
