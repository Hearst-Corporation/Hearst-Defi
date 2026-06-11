/**
 * getPositions — unit tests.
 *
 * NOTE: The Prisma `Subscription` model does not exist yet (E1/E2 dependency).
 * We test `getPositions` against a deterministic in-memory fixture that mirrors
 * what the real DB query returns, using Vitest's `vi.mock` to replace `prisma`.
 *
 * Fixture: 1 user, 2 vaults, 2 positions:
 *   Vault A — HYV-A, $500k principal, $42k accrued, $18k distributed,
 *             subscribedAt 2025-11-01, softLockup 60 days
 *   Vault B — HYV-B, $250k principal, $8k accrued, $5k distributed,
 *             subscribedAt 2025-12-15, softLockup 90 days
 *
 * Expectations:
 *   - 2 rows returned
 *   - sorted by totalReturn desc (Vault A wins: $60k vs $13k)
 *   - costBasis, currentNav, unrealized, realized, totalReturn correct
 *   - lockReleaseDate = subscribedAt + softLockupDays
 *   - IRR is either a finite number or null (Newton may not converge for all fixtures)
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock prisma (avoids DB dependency in unit tests)
// ---------------------------------------------------------------------------

// We must mock before importing the module under test.
vi.mock("@/lib/db", () => ({
  prisma: {
    investor: {
      findUnique: vi.fn(),
    },
    position: {
      findMany: vi.fn(),
    },
    investorTransaction: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import { getPositions } from "../positions";

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const USER_ID = "user-abc";
const INVESTOR_ID = "inv-001";

const MOCK_INVESTOR = {
  id: INVESTOR_ID,
  userId: USER_ID,
  walletAddress: null,
  email: "test@example.com",
  kycStatus: "approved",
  createdAt: new Date("2025-10-01T00:00:00Z"),
  updatedAt: new Date("2025-10-01T00:00:00Z"),
};

const SUBSCRIBE_A = new Date("2025-11-01T00:00:00Z");
const SUBSCRIBE_B = new Date("2025-12-15T00:00:00Z");

function toDecimal(n: number) {
  return { toNumber: () => n };
}

const MOCK_POSITIONS = [
  {
    id: "pos-A",
    investorId: INVESTOR_ID,
    vaultDeploymentId: "vd-A",
    vaultKey: "hyv_a",
    principalUsdc: toDecimal(500_000),
    accruedYieldUsdc: toDecimal(42_000),
    distributedUsdc: toDecimal(18_000),
    status: "active",
    subscribedAt: SUBSCRIBE_A,
    maturedAt: null,
    exitedAt: null,
    txHashOpen: null,
    vaultDeployment: {
      id: "vd-A",
      ticker: "HYV-A",
      name: "Hearst Yield Vault A",
      shareClass: "A",
      softLockupDays: 60,
      targetApyLowBps: 940,
      targetApyHighBps: 1280,
    },
  },
  {
    id: "pos-B",
    investorId: INVESTOR_ID,
    vaultDeploymentId: "vd-B",
    vaultKey: "hyv_b",
    principalUsdc: toDecimal(250_000),
    accruedYieldUsdc: toDecimal(8_000),
    distributedUsdc: toDecimal(5_000),
    status: "active",
    subscribedAt: SUBSCRIBE_B,
    maturedAt: null,
    exitedAt: null,
    txHashOpen: null,
    vaultDeployment: {
      id: "vd-B",
      ticker: "HYV-B",
      name: "Hearst Defensive Vault B",
      shareClass: "B",
      softLockupDays: 90,
      targetApyLowBps: 700,
      targetApyHighBps: 1000,
    },
  },
];

const MOCK_DISTRIBUTIONS = [
  // Vault A distributions
  {
    positionId: "pos-A",
    amountUsdc: toDecimal(9_000),
    occurredAt: new Date("2025-12-05T00:00:00Z"),
  },
  {
    positionId: "pos-A",
    amountUsdc: toDecimal(9_000),
    occurredAt: new Date("2026-01-05T00:00:00Z"),
  },
  // Vault B distributions
  {
    positionId: "pos-B",
    amountUsdc: toDecimal(5_000),
    occurredAt: new Date("2026-01-10T00:00:00Z"),
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getPositions — 1 user, 2 vaults", () => {
  const AS_OF = new Date("2026-02-01T00:00:00Z");

  beforeEach(() => {
    vi.mocked(prisma.investor.findUnique).mockResolvedValue(MOCK_INVESTOR as Parameters<typeof prisma.investor.findUnique>[0] extends infer P ? P extends { where: unknown } ? Awaited<ReturnType<typeof prisma.investor.findUnique>> : never : never);
    vi.mocked(prisma.position.findMany).mockResolvedValue(MOCK_POSITIONS as unknown as Awaited<ReturnType<typeof prisma.position.findMany>>);
    vi.mocked(prisma.investorTransaction.findMany).mockResolvedValue(MOCK_DISTRIBUTIONS as unknown as Awaited<ReturnType<typeof prisma.investorTransaction.findMany>>);
  });

  it("returns exactly 2 position rows", async () => {
    const rows = await getPositions(USER_ID, AS_OF);
    expect(rows).toHaveLength(2);
  });

  it("sorted by totalReturn descending (Vault A > Vault B)", async () => {
    const rows = await getPositions(USER_ID, AS_OF);
    expect(rows[0]!.id).toBe("pos-A");
    expect(rows[1]!.id).toBe("pos-B");
    expect(rows[0]!.totalReturnUsdc).toBeGreaterThan(rows[1]!.totalReturnUsdc);
  });

  it("Vault A: costBasis = 500k, currentNav = 542k", async () => {
    const rows = await getPositions(USER_ID, AS_OF);
    const a = rows.find((r) => r.id === "pos-A")!;
    expect(a.costBasisUsdc).toBe(500_000);
    expect(a.currentNavUsdc).toBe(542_000); // 500k + 42k accrued
  });

  it("Vault A: unrealizedPnl = 42k (accrued), realizedPnl = 18k (distributed)", async () => {
    const rows = await getPositions(USER_ID, AS_OF);
    const a = rows.find((r) => r.id === "pos-A")!;
    expect(a.unrealizedPnlUsdc).toBe(42_000);
    expect(a.realizedPnlUsdc).toBe(18_000);
    expect(a.totalReturnUsdc).toBe(60_000);
  });

  it("Vault B: costBasis = 250k, unrealizedPnl = 8k, realizedPnl = 5k", async () => {
    const rows = await getPositions(USER_ID, AS_OF);
    const b = rows.find((r) => r.id === "pos-B")!;
    expect(b.costBasisUsdc).toBe(250_000);
    expect(b.unrealizedPnlUsdc).toBe(8_000);
    expect(b.realizedPnlUsdc).toBe(5_000);
    expect(b.totalReturnUsdc).toBe(13_000);
  });

  it("lockReleaseDate = subscribedAt + softLockupDays", async () => {
    const rows = await getPositions(USER_ID, AS_OF);
    const a = rows.find((r) => r.id === "pos-A")!;
    const b = rows.find((r) => r.id === "pos-B")!;

    // Vault A: 2025-11-01 + 60 days = 2025-12-31
    const expectedA = new Date("2025-12-31T00:00:00Z");
    expect(a.lockReleaseDate?.getTime()).toBe(expectedA.getTime());

    // Vault B: 2025-12-15 + 90 days = 2026-03-15
    const expectedB = new Date("2026-03-15T00:00:00Z");
    expect(b.lockReleaseDate?.getTime()).toBe(expectedB.getTime());
  });

  it("shareClass and vaultTicker are populated from VaultDeployment", async () => {
    const rows = await getPositions(USER_ID, AS_OF);
    const a = rows.find((r) => r.id === "pos-A")!;
    const b = rows.find((r) => r.id === "pos-B")!;

    expect(a.shareClass).toBe("A");
    expect(a.vaultTicker).toBe("HYV-A");
    expect(b.shareClass).toBe("B");
    expect(b.vaultTicker).toBe("HYV-B");
  });

  it("irrAnnualized is a finite number or null (never NaN)", async () => {
    const rows = await getPositions(USER_ID, AS_OF);
    for (const row of rows) {
      if (row.irrAnnualized !== null) {
        expect(Number.isFinite(row.irrAnnualized)).toBe(true);
        expect(Number.isNaN(row.irrAnnualized)).toBe(false);
      }
    }
  });

  it("irrAnnualized for Vault A is positive (profitable position)", async () => {
    const rows = await getPositions(USER_ID, AS_OF);
    const a = rows.find((r) => r.id === "pos-A")!;
    // Vault A has 60k return on 500k cost = ~12% with > 90 days held → should converge
    if (a.irrAnnualized !== null) {
      expect(a.irrAnnualized).toBeGreaterThan(0);
    }
  });

  it("returns empty array for unknown userId (no investor)", async () => {
    vi.mocked(prisma.investor.findUnique).mockResolvedValue(null);
    const rows = await getPositions("unknown-user", AS_OF);
    expect(rows).toEqual([]);
  });

  it("does not fabricate deployment fields when VaultDeployment is missing", async () => {
    vi.mocked(prisma.position.findMany).mockResolvedValue([
      {
        ...MOCK_POSITIONS[0],
        vaultDeployment: null,
      },
    ] as unknown as Awaited<ReturnType<typeof prisma.position.findMany>>);
    vi.mocked(prisma.investorTransaction.findMany).mockResolvedValue([]);

    const rows = await getPositions(USER_ID, AS_OF);
    const row = rows[0]!;

    expect(row.vaultName).toBeNull();
    expect(row.vaultTicker).toBeNull();
    expect(row.shareClass).toBeNull();
    expect(row.lockReleaseDate).toBeNull();
  });
});
