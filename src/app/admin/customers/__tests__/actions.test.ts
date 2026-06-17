/**
 * Unit tests for src/app/admin/customers/actions.ts
 *
 * Covers:
 *  - setInvestorKyc  (D2 — KYC override audit trail)
 *  - deployPosition  (4 parity-gap guards + happy path)
 *
 * Mock strategy mirrors the proofs/vaults/governance admin action suites:
 * • requireAdmin       — vi.mock'd, controlled per test
 * • prisma.investor    — findUnique (snapshot) + update vi.fn()
 * • prisma.$transaction — runs callback inline with the same prisma stub as tx
 * • prisma.position    — aggregate + create vi.fn()
 * • prisma.vaultDeployment — findUnique vi.fn()
 * • getVault           — vi.mock'd, returns a live vault by default
 * • isDemoInvestor     — vi.mock'd, returns false by default
 * • recordAdminAudit   — vi.fn() (no DB)
 * • next/cache         — revalidatePath no-op
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
    position: {
      aggregate: vi.fn(),
      create: vi.fn(),
    },
    vaultDeployment: {
      findUnique: vi.fn(),
    },
    // ATOM: setInvestorKyc + deployPosition both inline audit inside $transaction.
    // The mock runs the callback with the same prisma object as tx, so all
    // tx.* calls reuse these vi.fn()s for assertion.
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

// Gap 2: getVault mock — returns a live vault by default; overridden per test.
vi.mock("@/lib/data/vaults", () => ({
  getVault: vi.fn(),
}));

// Gap 4: isDemoInvestor mock — returns false by default; overridden per test.
vi.mock("@/lib/demo/provider", () => ({
  isDemoInvestor: vi.fn(),
}));

import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { recordAdminAudit } from "@/lib/admin/audit";
import { revalidatePath } from "next/cache";
import { getVault } from "@/lib/data/vaults";
import { isDemoInvestor } from "@/lib/demo/provider";
import { setInvestorKyc, deployPosition } from "../actions";

const MOCK_ADMIN = { userId: "user_admin", walletAddress: "0xAdminWallet" };

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

// ---------------------------------------------------------------------------
// Shared helpers for deployPosition tests
// ---------------------------------------------------------------------------

/** A fully-approved, accredited, non-demo investor stub. */
const MOCK_INVESTOR = {
  id: "inv_1",
  kycStatus: "approved",
  accreditationAttestedAt: new Date("2026-01-01"),
  user: { email: "investor@example.com" },
};

/** A live vault product stub (returned by getVault mock). */
const MOCK_VAULT = {
  id: "hearst-yield-vault",
  status: "live" as const,
  capacityUsdc: 1_000_000_000,
  // other VaultProduct fields not needed for these guards
};

/** Default position stub returned by position.create inside the transaction. */
const MOCK_POSITION = { id: "pos_abc123" };

/**
 * Wire up the happy-path mocks for deployPosition.
 * Individual tests override only what they need to change.
 */
function setupDeployMocks() {
  vi.mocked(requireAdmin).mockResolvedValue(MOCK_ADMIN);
  vi.mocked(prisma.investor.findUnique).mockResolvedValue(MOCK_INVESTOR as never);
  vi.mocked(getVault).mockResolvedValue(MOCK_VAULT as never);
  vi.mocked(isDemoInvestor).mockReturnValue(false);
  // No real VaultDeployment row (fixture vault path).
  vi.mocked(prisma.vaultDeployment.findUnique).mockResolvedValue(null as never);
  // Capacity aggregate: 0 consumed → plenty of room.
  vi.mocked(prisma.position.aggregate).mockResolvedValue({
    _sum: { principalUsdc: null },
  } as never);
  vi.mocked(prisma.position.create).mockResolvedValue(MOCK_POSITION as never);
  vi.mocked(prisma.adminAudit.create).mockResolvedValue({} as never);
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

// ---------------------------------------------------------------------------
// deployPosition — parity-gap guards
// ---------------------------------------------------------------------------

describe("deployPosition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDeployMocks();
  });

  // Happy path ----------------------------------------------------------------

  it("admin + approved KYC + accredited + valid amount → creates Position and writes audit", async () => {
    const result = await deployPosition(
      form({ investorId: "inv_1", amountUsdc: "500000", classCode: "A" }),
    );

    expect(result).toEqual({ ok: true, positionId: "pos_abc123" });

    // position.create ran inside $transaction with the correct vaultKey + status
    expect(prisma.position.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          vaultKey: "hearst-yield-vault:class-A",
          principalUsdc: 500_000,
          status: "active",
          txHashOpen: null,
        }),
      }),
    );

    // adminAudit row written inside the same transaction
    expect(prisma.adminAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "investor.deployPosition",
          entityType: "Investor",
          entityId: "inv_1",
        }),
      }),
    );

    // revalidatePath called for the relevant paths
    expect(revalidatePath).toHaveBeenCalledWith("/admin/customers");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/customers/inv_1");
  });

  // KYC gate (Gap parity — existing guard) -----------------------------------

  it("kycStatus pending → { ok:false } with KYC error, NO position created", async () => {
    vi.mocked(prisma.investor.findUnique).mockResolvedValue({
      ...MOCK_INVESTOR,
      kycStatus: "pending",
    } as never);

    const result = await deployPosition(
      form({ investorId: "inv_1", amountUsdc: "500000", classCode: "A" }),
    );

    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toContain("KYC");
    expect(prisma.position.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  // Gap 3 — accreditation gate -----------------------------------------------

  it("accreditationAttestedAt null → { ok:false }, no position created", async () => {
    vi.mocked(prisma.investor.findUnique).mockResolvedValue({
      ...MOCK_INVESTOR,
      accreditationAttestedAt: null,
    } as never);

    const result = await deployPosition(
      form({ investorId: "inv_1", amountUsdc: "500000", classCode: "A" }),
    );

    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toContain("accreditation");
    expect(prisma.position.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  // Gap 1 — amount below min (no demo override) ------------------------------

  it("amount below Class A minimum ($250k) → { ok:false } with minLabel, no position", async () => {
    const result = await deployPosition(
      form({ investorId: "inv_1", amountUsdc: "100", classCode: "A" }),
    );

    expect(result.ok).toBe(false);
    const err = (result as { ok: false; error: string }).error;
    expect(err).toContain("Below minimum ticket");
    // $250k → "k" tier, not "M" tier
    expect(err).toContain("$250k");
    expect(prisma.position.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  // Gap 4 — demo-investor short-circuit --------------------------------------

  it("demo investor identity → { ok:false } with demo error, no position created", async () => {
    vi.mocked(isDemoInvestor).mockReturnValue(true);

    const result = await deployPosition(
      form({ investorId: "inv_1", amountUsdc: "500000", classCode: "A" }),
    );

    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toContain("demo investor");
    expect(prisma.position.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  // Gap 2 — vault-status gate ------------------------------------------------

  it("vault status not live → { ok:false }, no position created", async () => {
    vi.mocked(getVault).mockResolvedValue({ ...MOCK_VAULT, status: "paused" } as never);

    const result = await deployPosition(
      form({ investorId: "inv_1", amountUsdc: "500000", classCode: "A" }),
    );

    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toContain("not open");
    expect(prisma.position.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  // Non-admin ----------------------------------------------------------------

  it("non-admin → requireAdmin throws, propagated", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error("Admin access required."));

    await expect(
      deployPosition(form({ investorId: "inv_1", amountUsdc: "500000", classCode: "A" })),
    ).rejects.toThrow("Admin access required.");

    expect(prisma.investor.findUnique).not.toHaveBeenCalled();
    expect(prisma.position.create).not.toHaveBeenCalled();
  });
});
