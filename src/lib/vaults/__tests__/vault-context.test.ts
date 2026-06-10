/**
 * Tests for getCurrentVaultContext — vault scope resolution from URL.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { findFirstMock, findManyMock } = vi.hoisted(() => ({
  findFirstMock: vi.fn(),
  findManyMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    vaultDeployment: {
      findFirst: findFirstMock,
      findMany: findManyMock,
    },
  },
}));

import { getCurrentVaultContext } from "@/lib/vaults/context";

const DEPLOYMENT_ROW = {
  id: "cmx7abcde1234567",
  ticker: "HYV-A",
  name: "Hearst Yield A",
  status: "live",
  updatedAt: new Date("2026-05-26T10:00:00Z"),
  description: "Series A",
  targetApyLowBps: 800,
  targetApyHighBps: 1200,
  capacityUsdc: 10_000_000,
  minTicketUsdc: 250_000,
  softLockupDays: 60,
  mgmtFeeBps: 150,
  perfFeeBps: 1500,
  hurdleBps: 0,
  requiredSigners: 2,
  signersWhitelist: "[]",
  strategy: "mining_yield",
  spvJurisdiction: "cayman",
  shareClass: "A",
  regExemption: "reg_d_506b",
  targetMiningBps: 5000,
  targetBtcTacticalBps: 2000,
  targetUsdcBaseBps: 2000,
  targetStableReserveBps: 1000,
  disclaimers: "Not guaranteed.",
  createdAt: new Date("2026-01-01"),
};

beforeEach(() => {
  findFirstMock.mockReset();
  findManyMock.mockReset();
  findManyMock.mockResolvedValue([]);
});

describe("getCurrentVaultContext", () => {
  it("returns null current and isVaultScoped=false when no vault in URL", async () => {
    const ctx = await getCurrentVaultContext({}, "/admin/dashboard");
    expect(ctx.current).toBeNull();
    expect(ctx.isVaultScoped).toBe(false);
    expect(Array.isArray(ctx.all)).toBe(true);
  });

  it("resolves vault from ?vault= searchParam", async () => {
    findFirstMock.mockResolvedValue(DEPLOYMENT_ROW);
    const ctx = await getCurrentVaultContext(
      { vault: "hyv-a" },
      "/admin/dashboard",
    );
    expect(ctx.current).not.toBeNull();
    expect(ctx.isVaultScoped).toBe(true);
    expect(ctx.current?.kind).toBe("deployment");
  });

  it("resolves vault from /admin/vaults/[id] path", async () => {
    findFirstMock.mockResolvedValue(DEPLOYMENT_ROW);
    const ctx = await getCurrentVaultContext({}, "/admin/vaults/hyv-a");
    expect(ctx.current).not.toBeNull();
    expect(ctx.isVaultScoped).toBe(true);
  });

  it("prefers ?vault= over path segment when both are present", async () => {
    findFirstMock.mockResolvedValue(DEPLOYMENT_ROW);
    await getCurrentVaultContext(
      { vault: "hyv-a" },
      "/admin/vaults/other-id",
    );
    expect(findFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [{ ticker: "HYV-A" }, { id: "hyv-a" }],
        },
      }),
    );
  });

  it("resolves fixture vaults (yield / defensive / btc-plus) without hitting the DB", async () => {
    const ctx = await getCurrentVaultContext({ vault: "yield" }, "/admin/dashboard");
    expect(findFirstMock).not.toHaveBeenCalled();
    expect(ctx.current?.kind).toBe("fixture");
  });

  it("returns null current when vault param does not match any vault", async () => {
    findFirstMock.mockResolvedValue(null);
    const ctx = await getCurrentVaultContext(
      { vault: "nonexistent-xyz" },
      "/admin/dashboard",
    );
    expect(ctx.current).toBeNull();
    expect(ctx.isVaultScoped).toBe(true);
  });
});
