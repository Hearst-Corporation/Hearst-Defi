/**
 * Unit tests for src/app/admin/customers/actions.ts (setInvestorKyc)
 *
 * Mock strategy mirrors the proofs/vaults/governance admin action suites:
 * • requireAdmin       — vi.mock'd, controlled per test
 * • prisma.investor    — findUnique (snapshot) + update vi.fn()
 * • recordAdminAudit   — vi.fn() (no DB)
 * • next/cache         — revalidatePath no-op
 *
 * Focus: D2 — a successful KYC override writes an `investor.setKyc` audit row
 * capturing the before/after kycStatus transition.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  const prisma = {
    investor: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    // ATOM: setInvestorKyc now inlines the audit insert inside a
    // prisma.$transaction. The mock runs the callback with the same prisma
    // object as tx, so tx.investor.update and tx.adminAudit.create reuse these.
    adminAudit: { create: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
  };
  return { prisma };
});

vi.mock("@/lib/admin/audit", () => ({
  recordAdminAudit: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { recordAdminAudit } from "@/lib/admin/audit";
import { revalidatePath } from "next/cache";
import { setInvestorKyc } from "../actions";

const MOCK_ADMIN = { userId: "user_admin", walletAddress: "0xAdminWallet" };

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("setInvestorKyc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("admin + valid input → updates kycStatus and writes an investor.setKyc audit row", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(MOCK_ADMIN);
    vi.mocked(prisma.investor.findUnique).mockResolvedValue({ kycStatus: "pending" } as never);
    vi.mocked(prisma.investor.update).mockResolvedValue({} as never);

    await setInvestorKyc(form({ investorId: "inv_1", status: "approved" }));

    expect(prisma.investor.update).toHaveBeenCalledWith({
      where: { id: "inv_1" },
      data: { kycStatus: "approved" },
    });
    // ATOM: the audit row is now inserted directly on the tx client inside
    // prisma.$transaction (atomic with the investor.update), not via
    // recordAdminAudit. before/after live in the JSON `diff` field.
    expect(prisma.adminAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "investor.setKyc",
        entityType: "Investor",
        entityId: "inv_1",
        actorWallet: MOCK_ADMIN.walletAddress,
        diff: JSON.stringify({
          before: { kycStatus: "pending" },
          after: { kycStatus: "approved" },
        }),
      }),
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/customers");
  });

  it("unknown investor → throws, no update, no audit", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(MOCK_ADMIN);
    vi.mocked(prisma.investor.findUnique).mockResolvedValue(null as never);

    await expect(
      setInvestorKyc(form({ investorId: "missing", status: "approved" })),
    ).rejects.toThrow("investor not found");

    expect(prisma.investor.update).not.toHaveBeenCalled();
    expect(recordAdminAudit).not.toHaveBeenCalled();
  });

  it("invalid input → throws before any DB read/write", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(MOCK_ADMIN);

    await expect(
      setInvestorKyc(form({ investorId: "", status: "bogus" })),
    ).rejects.toThrow("invalid input");

    expect(prisma.investor.findUnique).not.toHaveBeenCalled();
    expect(prisma.investor.update).not.toHaveBeenCalled();
    expect(recordAdminAudit).not.toHaveBeenCalled();
  });

  it("non-admin → requireAdmin throws, propagated", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error("Admin access required."));

    await expect(
      setInvestorKyc(form({ investorId: "inv_1", status: "approved" })),
    ).rejects.toThrow("Admin access required.");

    expect(prisma.investor.findUnique).not.toHaveBeenCalled();
  });
});
