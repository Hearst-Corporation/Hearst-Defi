import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Prisma client. No DB rows.
const findFirstDeployment = vi.fn().mockResolvedValue(null);
const findManyDeployment = vi.fn().mockResolvedValue([]);
const findFirstSnapshot = vi.fn().mockResolvedValue(null);
const findManySnapshot = vi.fn().mockResolvedValue([]);

vi.mock("@/lib/db", () => ({
  prisma: {
    vaultDeployment: {
      findMany: (...a: unknown[]) => findManyDeployment(...a),
      findFirst: (...a: unknown[]) => findFirstDeployment(...a),
    },
    vaultSnapshot: {
      findMany: (...a: unknown[]) => findManySnapshot(...a),
      findFirst: (...a: unknown[]) => findFirstSnapshot(...a),
    },
  },
}));

import { listVaults, getVault } from "@/lib/data/vaults";

/** Minimal non-placeholder VaultDeployment row for the AUM-leak test. */
function makeRow(over: { id: string; ticker: string }) {
  const dec = (n: number) => ({ toNumber: () => n });
  return {
    id: over.id,
    ticker: over.ticker,
    name: over.ticker,
    description: "",
    strategy: "mining_yield",
    status: "deployed",
    targetApyLowBps: 800,
    targetApyHighBps: 1500,
    minTicketUsdc: dec(250_000),
    softLockupDays: 60,
    capacityUsdc: dec(100_000_000),
    mgmtFeeBps: 200,
    perfFeeBps: 1000,
    hurdleBps: 600,
    spvJurisdiction: "Cayman",
    shareClass: "A",
    regExemption: "Reg D",
    disclaimers: "",
    targetMiningBps: 6000,
    targetBtcTacticalBps: 1500,
    targetUsdcBaseBps: 1500,
    targetStableReserveBps: 1000,
    // Real (non-placeholder) on-chain address.
    contractAddress: "0x1111111111111111111111111111111111111111",
  } as never;
}

describe("listVaults — empty-DB contract", () => {
  it("returns an empty array when the DB has no VaultDeployment rows (no fabricated fixtures)", async () => {
    const vaults = await listVaults();
    expect(vaults).toEqual([]);
  });

  it("is idempotent across repeated calls", async () => {
    const a = await listVaults();
    const b = await listVaults();
    expect(a).toEqual(b);
  });
});

describe("getVault — empty-DB contract", () => {
  it("returns null for any id when the DB has no matching row", async () => {
    expect(await getVault("hearst-yield-vault")).toBeNull();
    expect(await getVault("hearst-defensive-vault")).toBeNull();
    expect(await getVault("HBP-A")).toBeNull();
  });

  it("returns null for an unknown vault id", async () => {
    expect(await getVault("nope-vault")).toBeNull();
  });
});

// A1 — AUM cross-vault leak guard. getVault() must apply the same
// isYieldVaultRow filter as listVaults(): only the Yield Vault inherits the
// single VaultSnapshot AUM; every other vault stays at 0.
describe("getVault — AUM is not leaked to non-Yield vaults (A1)", () => {
  beforeEach(() => {
    // A snapshot exists (the Yield Vault timeline, 25M).
    findFirstSnapshot.mockResolvedValue({ aumUsdc: { toNumber: () => 25_000_000 } });
  });

  it("applies the snapshot AUM to the Yield Vault", async () => {
    findFirstDeployment.mockResolvedValueOnce(
      makeRow({ id: "hearst-yield-vault", ticker: "HYV-A" }),
    );
    const vault = await getVault("hearst-yield-vault");
    expect(vault?.currentAumUsdc).toBe(25_000_000);
  });

  // The invariant is unchanged — the Yield vault's AUM must not leak onto
  // another vault. What changed is how the absence is expressed: `null`
  // ("no snapshot attributes an AUM to this vault") instead of `0`, which
  // asserted a measured empty vault. `VaultSnapshot` has no
  // `vaultDeploymentId` yet, so no non-Yield vault can have a real figure.
  it("does NOT apply the Yield AUM to the Defensive vault", async () => {
    findFirstDeployment.mockResolvedValueOnce(
      makeRow({ id: "hearst-defensive-vault", ticker: "HDV-A" }),
    );
    const vault = await getVault("hearst-defensive-vault");
    expect(vault?.currentAumUsdc).toBeNull();
  });

  it("does NOT apply the Yield AUM to the BTC Plus vault", async () => {
    findFirstDeployment.mockResolvedValueOnce(
      makeRow({ id: "hearst-btc-plus-vault", ticker: "HBP-A" }),
    );
    const vault = await getVault("hearst-btc-plus-vault");
    expect(vault?.currentAumUsdc).toBeNull();
  });
});
