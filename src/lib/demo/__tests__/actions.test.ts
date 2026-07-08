/**
 * Unit tests for resetDemoAccount (src/lib/demo/actions.ts).
 *
 * Focus: the P1 fix that scopes the shared `source:"demo_seed"` VaultSnapshot
 * delete to the legacy demo account only. Two demo accounts are allowlisted
 * (`isDemoAccount`), but only `adrien+demo@hearstcorporation.io` may destroy
 * that shared, non-recreatable platform data — `zand.demo@hearstcorporation.io`
 * must reset its own investor-scoped rows and leave the shared snapshot alone.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoist mocks before module imports ─────────────────────────────────────

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const requireInvestorMock = vi.fn();
vi.mock("@/lib/auth/require-investor", () => ({
  requireInvestor: (...args: unknown[]) => requireInvestorMock(...args),
}));

const getInvestorMock = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  getInvestor: (...args: unknown[]) => getInvestorMock(...args),
  // subscribe.ts (imported transitively via demo/actions.ts) also destructures
  // getSession from this module — never invoked by the tests below, but must
  // exist as a named export or the transitive import throws at module load.
  getSession: vi.fn(),
}));

const investorTransactionDeleteMany = vi.fn();
const positionDeleteMany = vi.fn();
const investorNavSnapshotDeleteMany = vi.fn();
const vaultSnapshotDeleteMany = vi.fn();
const transactionMock = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    investorTransaction: {
      deleteMany: (...a: unknown[]) => investorTransactionDeleteMany(...a),
    },
    position: {
      deleteMany: (...a: unknown[]) => positionDeleteMany(...a),
    },
    investorNavSnapshot: {
      deleteMany: (...a: unknown[]) => investorNavSnapshotDeleteMany(...a),
    },
    vaultSnapshot: {
      deleteMany: (...a: unknown[]) => vaultSnapshotDeleteMany(...a),
    },
    $transaction: (...a: unknown[]) => transactionMock(...a),
  },
}));

// ── Import module under test AFTER mocks ──────────────────────────────────

import { resetDemoAccount } from "@/lib/demo/actions";

// ── Fixtures ────────────────────────────────────────────────────────────────

const ADRIEN_SESSION = {
  userId: "user_adrien",
  email: "adrien+demo@hearstcorporation.io",
  role: "investor" as const,
  walletAddress: null,
};

const ZAND_SESSION = {
  userId: "user_zand",
  email: "zand.demo@hearstcorporation.io",
  role: "investor" as const,
  walletAddress: null,
};

const REAL_INVESTOR_SESSION = {
  userId: "user_real",
  email: "lp@hedgefund.io",
  role: "investor" as const,
  walletAddress: null,
};

function investorFor(userId: string, id: string) {
  return {
    id,
    userId,
    walletAddress: null,
    email: "unused@example.com",
    kycStatus: "approved",
    accreditationAttestedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("resetDemoAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transactionMock.mockResolvedValue([{}, {}, {}]);
    investorTransactionDeleteMany.mockResolvedValue({ count: 0 });
    positionDeleteMany.mockResolvedValue({ count: 0 });
    investorNavSnapshotDeleteMany.mockResolvedValue({ count: 0 });
    vaultSnapshotDeleteMany.mockResolvedValue({ count: 0 });
  });

  it("refuses a real investor without touching the DB", async () => {
    requireInvestorMock.mockResolvedValue(REAL_INVESTOR_SESSION);

    const result = await resetDemoAccount();

    expect(result.ok).toBe(false);
    expect(transactionMock).not.toHaveBeenCalled();
    expect(vaultSnapshotDeleteMany).not.toHaveBeenCalled();
  });

  it("adrien+demo reset deletes the shared demo_seed VaultSnapshot rows", async () => {
    requireInvestorMock.mockResolvedValue(ADRIEN_SESSION);
    getInvestorMock.mockResolvedValue(investorFor("user_adrien", "inv_adrien"));

    const result = await resetDemoAccount();

    expect(result.ok).toBe(true);
    expect(transactionMock).toHaveBeenCalledOnce();
    expect(vaultSnapshotDeleteMany).toHaveBeenCalledOnce();
    expect(vaultSnapshotDeleteMany).toHaveBeenCalledWith({
      where: { source: "demo_seed" },
    });
  });

  it("zand.demo reset does NOT delete the shared demo_seed VaultSnapshot rows", async () => {
    requireInvestorMock.mockResolvedValue(ZAND_SESSION);
    getInvestorMock.mockResolvedValue(investorFor("user_zand", "inv_zand"));

    const result = await resetDemoAccount();

    expect(result.ok).toBe(true);
    // The caller-scoped deletes (transactions/positions/NAV) still run.
    expect(transactionMock).toHaveBeenCalledOnce();
    // But the shared, non-investor-scoped VaultSnapshot wipe must never fire.
    expect(vaultSnapshotDeleteMany).not.toHaveBeenCalled();
  });

  it("is case-insensitive when matching the legacy demo snapshot owner", async () => {
    requireInvestorMock.mockResolvedValue({
      ...ADRIEN_SESSION,
      email: "  Adrien+Demo@HearstCorporation.IO  ",
    });
    getInvestorMock.mockResolvedValue(investorFor("user_adrien", "inv_adrien"));

    const result = await resetDemoAccount();

    expect(result.ok).toBe(true);
    expect(vaultSnapshotDeleteMany).toHaveBeenCalledOnce();
  });
});
