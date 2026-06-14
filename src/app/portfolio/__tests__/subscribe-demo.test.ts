/**
 * Demo Provider (Lot 3) — subscribe() defense-in-depth safety net.
 *
 * The CLIENT demo invest path never calls subscribe() — it redirects straight
 * to the confirmed page with NO depositToVault and NO real subscribe. This test
 * covers the SERVER safety net: if anything ever does call subscribe() as the
 * recognized demo identity, the action must no-op BEFORE any DB write and return
 * a non-real sentinel position id.
 *
 * Mock strategy mirrors subscribe.test.ts but additionally controls
 * isDemoInvestor via a mock of @/lib/demo/provider (guard-injection is internal
 * to the action, so we control the recognition boolean at the module boundary
 * rather than mutating process.env).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (declared before the module under test is imported) ─────────────

vi.mock("@/lib/auth/session", () => ({
  getInvestor: vi.fn(),
}));

vi.mock("@/lib/data/vaults", () => ({
  getVault: vi.fn(),
}));

vi.mock("@/lib/demo/provider", () => ({
  isDemoInvestor: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    vaultDeployment: { findUnique: vi.fn() },
    position: {
      findUnique: vi.fn(),
      create: vi.fn(),
      aggregate: vi.fn(),
    },
    subscription: { create: vi.fn() },
    shareClass: { findUnique: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const { prisma: p } = await import("@/lib/db");
      return fn(p);
    }),
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────

import { getInvestor } from "@/lib/auth/session";
import { getVault } from "@/lib/data/vaults";
import { isDemoInvestor } from "@/lib/demo/provider";
import { prisma } from "@/lib/db";
import { subscribe } from "@/app/actions/subscribe";
import { DEMO_SUBSCRIBE_NOOP_POSITION_ID } from "@/lib/demo/markers";
import { DEMO_INVESTOR_EMAIL } from "@/lib/dev/investor-demo";

// ── Fixtures ──────────────────────────────────────────────────────────────

const DEMO_INVESTOR = {
  id: "inv_demo_001",
  userId: "user_demo_001",
  walletAddress: null,
  email: DEMO_INVESTOR_EMAIL,
  kycStatus: "approved",
  accreditationAttestedAt: new Date("2026-01-01"),
  createdAt: new Date(),
  updatedAt: new Date(),
};

const REAL_INVESTOR = {
  ...DEMO_INVESTOR,
  id: "inv_real_001",
  email: "lp@hedgefund.io",
};

const LIVE_VAULT = {
  id: "hearst-yield-vault",
  ticker: "HYV-A",
  name: "Hearst Yield Vault",
  description: "Mining-backed structured yield.",
  strategy: "mining_yield" as const,
  status: "live" as const,
  apyLow: 8,
  apyHigh: 15,
  minTicketUsdc: 250_000,
  softLockupDays: 60,
  capacityUsdc: 100_000_000,
  currentAumUsdc: 10_000_000,
  fees: { mgmtBps: 100, perfBps: 1_000, hurdleBps: 0 },
  riskLevel: "low-moderate" as const,
  spvJurisdiction: "cayman",
  shareClass: "A",
  regExemption: "regS",
  disclaimers: "Projections are not guaranteed.",
  targetMiningBps: 6000,
  targetBtcTacticalBps: 2500,
  targetUsdcBaseBps: 1000,
  targetStableReserveBps: 500,
};

// ── Tests ─────────────────────────────────────────────────────────────────

describe("subscribe — demo safety net (no-op before any DB write)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.vaultDeployment.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.position.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.position.aggregate).mockResolvedValue({
      _sum: { principalUsdc: null },
    } as unknown as Awaited<ReturnType<typeof prisma.position.aggregate>>);
  });

  it("demo identity → ok with the non-real sentinel id, ZERO prisma writes", async () => {
    vi.mocked(getInvestor).mockResolvedValue(DEMO_INVESTOR);
    vi.mocked(isDemoInvestor).mockReturnValue(true);

    const result = await subscribe("hearst-yield-vault", 500_000, "A", "0xabc");

    expect(result).toEqual({
      ok: true,
      positionId: DEMO_SUBSCRIBE_NOOP_POSITION_ID,
    });

    // No DB read or write of any kind happened — the early return sits above
    // every validation, the idempotency lookup, and the $transaction.
    expect(getVault).not.toHaveBeenCalled();
    expect(prisma.vaultDeployment.findUnique).not.toHaveBeenCalled();
    expect(prisma.position.findUnique).not.toHaveBeenCalled();
    expect(prisma.position.aggregate).not.toHaveBeenCalled();
    expect(prisma.position.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.subscription.create).not.toHaveBeenCalled();
  });

  it("the sentinel position id is NOT the seeded demo position id", () => {
    // The no-op id must be distinct from the read-only demo dataset's position,
    // so a no-op write can never be confused with the seeded demo position.
    expect(DEMO_SUBSCRIBE_NOOP_POSITION_ID).toBe("demo-noop-no-subscription");
    expect(DEMO_SUBSCRIBE_NOOP_POSITION_ID).not.toBe("demo-investor-position-hyv");
  });

  it("still throws Unauthenticated when there is no investor (guard order)", async () => {
    vi.mocked(getInvestor).mockResolvedValue(null);
    vi.mocked(isDemoInvestor).mockReturnValue(false);

    await expect(
      subscribe("hearst-yield-vault", 500_000, "A", "0xabc"),
    ).rejects.toThrow("Unauthenticated");
  });

  it("real (non-demo) investor is unaffected — reaches the normal flow", async () => {
    vi.mocked(getInvestor).mockResolvedValue(REAL_INVESTOR);
    vi.mocked(isDemoInvestor).mockReturnValue(false);
    vi.mocked(getVault).mockResolvedValue(LIVE_VAULT);
    vi.mocked(prisma.position.create).mockResolvedValue({
      id: "pos_real_001",
    } as unknown as Awaited<ReturnType<typeof prisma.position.create>>);

    const result = await subscribe(
      "hearst-yield-vault",
      250_000,
      "A",
      undefined,
      { allowOffChain: true },
    );

    // Non-demo path runs as before: vault is fetched and a real position is
    // written. The demo branch did NOT short-circuit it.
    expect(getVault).toHaveBeenCalledOnce();
    expect(result).toEqual({ ok: true, positionId: "pos_real_001" });
  });
});
