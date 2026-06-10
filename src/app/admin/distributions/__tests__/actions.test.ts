/**
 * Unit tests for src/app/admin/distributions/actions.ts
 *
 * Coverage focus:
 *   P0 — vaultRef Zod validation (computeDistribution + confirmDistribution)
 *   P0 — vaultRef persisted on the Distribution row (confirmDistribution happy path)
 *   P1 — missing vaultRef rejects both actions
 *   P1 — existing multisig flow is not broken by the new field
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

vi.mock("@/lib/distribution/atomic-exec", () => ({
  executeDistributionAtomically: vi.fn().mockResolvedValue({}),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { executeDistributionAtomically } from "@/lib/distribution/atomic-exec";
import { computeDistribution, confirmDistribution } from "../actions";

// ── Helpers ───────────────────────────────────────────────────────────────────

const ADMIN = { userId: "admin_001", walletAddress: "0xAdminSigner" };
const PERIOD = "2026-05";
const TOTAL_USDC = 10_000;
const VAULT_REF = "yield";
const SIGNER = "0xABCDEF1234567890ABCDef1234567890ABcDef12";

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
    vi.mocked(requireAdmin).mockResolvedValue(ADMIN);
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
    vi.mocked(requireAdmin).mockResolvedValue(ADMIN);
  });

  it("P0 — missing vaultRef (empty string) → throws Invalid input", async () => {
    await expect(
      confirmDistribution(PERIOD, SIGNER, TOTAL_USDC, ""),
    ).rejects.toThrow(/Invalid input/);
  });

  it("P0 — first signer creates approval, returns not-yet-confirmed", async () => {
    vi.mocked(prisma.distribution.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.distributionApproval.findMany).mockResolvedValue(
      [] as never,
    );
    vi.mocked(prisma.distributionApproval.create).mockResolvedValue({
      id: "approval_1",
    } as never);
    vi.mocked(prisma.distributionApproval.count).mockResolvedValue(1);

    const result = await confirmDistribution(
      PERIOD,
      SIGNER,
      TOTAL_USDC,
      VAULT_REF,
    );

    expect(result.confirmed).toBe(false);
    expect(result.signersCount).toBe(1);
    expect(result.required).toBe(2);

    // The approval was created (first signer path)
    expect(prisma.distributionApproval.create).toHaveBeenCalledWith({
      data: { period: PERIOD, signerWallet: SIGNER, totalUsdc: TOTAL_USDC },
    });
  });

  it("P0 — vaultRef persisted when threshold reached (distribution.create called with vaultRef)", async () => {
    // Simulate the threshold-reached path:
    // existing distribution not found, 1 prior approval exists (first signer),
    // count returns 2 → triggers $transaction.
    const SIGNER_B = "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
    const firstApproval = {
      id: "approval_1",
      period: PERIOD,
      signerWallet: SIGNER,
      totalUsdc: { toNumber: () => TOTAL_USDC },
    };

    vi.mocked(prisma.distribution.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.distributionApproval.findMany).mockResolvedValue([
      firstApproval,
    ] as never);
    vi.mocked(prisma.distributionApproval.create).mockResolvedValue(
      {} as never,
    );
    vi.mocked(prisma.distributionApproval.count).mockResolvedValue(2);

    // position for compute
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
      { count: 1 } as never,
    );

    const result = await confirmDistribution(
      PERIOD,
      SIGNER_B,
      TOTAL_USDC,
      VAULT_REF,
    );

    expect(result.confirmed).toBe(true);
    expect(result.signersCount).toBe(2);

    // Verify distribution was created with the vaultRef
    expect(prisma.distribution.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ vaultRef: VAULT_REF }),
      }),
    );

    // Verify the atomic finisher was called with the created distribution id
    expect(executeDistributionAtomically).toHaveBeenCalledWith(
      createdDistribution.id,
    );
  });

  it("P1 — duplicate period → throws already confirmed", async () => {
    vi.mocked(prisma.distribution.findFirst).mockResolvedValue({
      id: "dist_existing",
    } as never);

    await expect(
      confirmDistribution(PERIOD, SIGNER, TOTAL_USDC, VAULT_REF),
    ).rejects.toThrow(/already been confirmed/);
  });

  it("P1 — invalid signer wallet format → throws Invalid input", async () => {
    await expect(
      confirmDistribution(PERIOD, "not-an-address", TOTAL_USDC, VAULT_REF),
    ).rejects.toThrow(/Invalid input/);
  });

  // ── P0-3: TOCTOU race — the application findFirst passes but a concurrent
  // confirmation already created the row; the @@unique([period, vaultRef])
  // constraint fires inside the transaction (P2002). We must surface
  // "already confirmed" and never double-create/double-pay. ──────────────────
  it("P0-3 — concurrent confirm losing the race (P2002 in tx) → throws already confirmed, no double-pay", async () => {
    const SIGNER_B = "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
    const firstApproval = {
      id: "approval_1",
      period: PERIOD,
      signerWallet: SIGNER,
      totalUsdc: { toNumber: () => TOTAL_USDC },
    };

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
      confirmDistribution(PERIOD, SIGNER_B, TOTAL_USDC, VAULT_REF),
    ).rejects.toThrow(/already been confirmed/);

    // No recipient transactions were written for the losing confirmation.
    expect(prisma.investorTransaction.createMany).not.toHaveBeenCalled();
  });
});
