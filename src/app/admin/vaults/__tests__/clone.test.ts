/**
 * Tests for the vault clone pre-fill feature (A1 — wizard-clone-from-existing).
 *
 * Scope:
 *   - cloneFormValues() in src/lib/vaults/clone.ts
 *   - resolveVault() integration (mocked Prisma) for the deployment branch
 *
 * Verifies that at least 3 fields are correctly pre-filled for both
 * fixture-based and deployment-based clone sources.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Prisma mock (must be hoisted before imports) ───────────────────────────

const { findFirstMock } = vi.hoisted(() => ({
  findFirstMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    vaultDeployment: {
      findFirst: findFirstMock,
    },
  },
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────

import { cloneFormValues } from "@/lib/vaults/clone";
import { resolveVault } from "@/lib/vaults/resolver";
import type { VaultRef } from "@/lib/vaults/types";

// ── Helpers ────────────────────────────────────────────────────────────────

/** Minimal VaultDeployment row that satisfies VaultRef["deployment"] */
function buildDeploymentRef(): VaultRef {
  return {
    kind: "deployment",
    deployment: {
      id: "vault_clone_001",
      ticker: "HYV-A",
      name: "Hearst Yield Vault — Series A",
      description: "Mining-backed structured yield.",
      strategy: "mining_yield",
      colorTag: "accent",
      status: "live",
      minTicketUsdc: 250_000 as unknown as import("@prisma/client").Prisma.Decimal,
      capacityUsdc: 10_000_000 as unknown as import("@prisma/client").Prisma.Decimal,
      mgmtFeeBps: 100,
      perfFeeBps: 1_000,
      hurdleBps: 0,
      softLockupDays: 60,
      targetApyLowBps: 800,
      targetApyHighBps: 1_500,
      spvJurisdiction: "cayman",
      shareClass: "A",
      regExemption: "regD_506c",
      disclaimers:
        "This is not an offer of securities. Past performance does not predict future results.",
      targetMiningBps: 5_000,
      targetBtcTacticalBps: 2_500,
      targetUsdcBaseBps: 1_500,
      targetStableReserveBps: 1_000,
      requiredSigners: 2,
      signersWhitelist: '["0xA","0xB"]',
      network: null,
      contractAddress: null,
      createdBy: "0xAdmin",
      seededFromStudyId: null,
      createdAt: new Date("2026-05-01T00:00:00Z"),
      updatedAt: new Date("2026-05-26T00:00:00Z"),
      submittedAt: null,
      deployedAt: null,
      pausedAt: null,
      closedAt: null,
    },
  };
}

// ── Tests: cloneFormValues — deployment branch ─────────────────────────────

describe("cloneFormValues — deployment", () => {
  it("appends ' (clone)' to the vault name", () => {
    const ref = buildDeploymentRef();
    const values = cloneFormValues(ref);
    expect(values.name).toBe("Hearst Yield Vault — Series A (clone)");
  });

  it("copies targetApyLowBps and targetApyHighBps", () => {
    const ref = buildDeploymentRef();
    const values = cloneFormValues(ref);
    expect(values.targetApyLowBps).toBe(800);
    expect(values.targetApyHighBps).toBe(1_500);
  });

  it("copies softLockupDays", () => {
    const ref = buildDeploymentRef();
    const values = cloneFormValues(ref);
    expect(values.softLockupDays).toBe(60);
  });

  it("copies mgmtFeeBps and perfFeeBps", () => {
    const ref = buildDeploymentRef();
    const values = cloneFormValues(ref);
    expect(values.mgmtFeeBps).toBe(100);
    expect(values.perfFeeBps).toBe(1_000);
  });

  it("copies requiredSigners", () => {
    const ref = buildDeploymentRef();
    const values = cloneFormValues(ref);
    expect(values.requiredSigners).toBe(2);
  });

  it("copies allocation bps", () => {
    const ref = buildDeploymentRef();
    const values = cloneFormValues(ref);
    expect(values.targetMiningBps).toBe(5_000);
    expect(values.targetBtcTacticalBps).toBe(2_500);
    expect(values.targetUsdcBaseBps).toBe(1_500);
    expect(values.targetStableReserveBps).toBe(1_000);
  });

  it("does NOT copy ticker (must remain empty so slug stays unique)", () => {
    const ref = buildDeploymentRef();
    const values = cloneFormValues(ref);
    expect(values).not.toHaveProperty("ticker");
  });

  it("does NOT copy signersWhitelist (addresses are context-specific)", () => {
    const ref = buildDeploymentRef();
    const values = cloneFormValues(ref);
    expect(values).not.toHaveProperty("signersWhitelist");
  });
});

// ── Tests: cloneFormValues — fixture branch ────────────────────────────────

describe("cloneFormValues — fixture (yield)", () => {
  beforeEach(() => {
    findFirstMock.mockReset();
  });

  it("resolves the yield fixture and pre-fills at least 3 fields correctly", async () => {
    // resolveVault("yield") should short-circuit to fixture without DB hit
    const ref = await resolveVault("yield");
    expect(ref?.kind).toBe("fixture");
    expect(findFirstMock).not.toHaveBeenCalled();

    if (!ref) throw new Error("resolveVault unexpectedly returned null");

    const values = cloneFormValues(ref);

    // Field 1: name suffix
    expect(values.name).toMatch(/\(clone\)$/);

    // Field 2: APY range (VAULT_YIELD is 8–15%, = 800–1500 bps)
    expect(values.targetApyLowBps).toBe(800);
    expect(values.targetApyHighBps).toBe(1_500);

    // Field 3: lockup days from Share Class A = 60
    expect(values.softLockupDays).toBe(60);
  });

  it("maps fixture allocation targets (percent→bps) correctly", async () => {
    const ref = await resolveVault("yield");
    if (!ref) throw new Error("fixture not resolved");
    const values = cloneFormValues(ref);

    // VAULT_YIELD.allocationTargets: mining=60, btc_tactical=25, usdc_base=10, stable_reserve=5
    expect(values.targetMiningBps).toBe(6_000);
    expect(values.targetBtcTacticalBps).toBe(2_500);
    expect(values.targetUsdcBaseBps).toBe(1_000);
    expect(values.targetStableReserveBps).toBe(500);
  });

  it("maps btc-plus fixture APY (10–20%) to correct bps range", async () => {
    const ref = await resolveVault("btc-plus");
    if (!ref) throw new Error("btc-plus fixture not resolved");
    const values = cloneFormValues(ref);

    // VAULT_BTC_PLUS low=10, high=20 → 1000, 2000
    expect(values.targetApyLowBps).toBe(1_000);
    expect(values.targetApyHighBps).toBe(2_000);
    expect(values.name).toMatch(/\(clone\)$/);
  });
});

// ── Tests: resolveVault — invalid cloneFrom → null (AC #2) ─────────────────

describe("resolveVault — invalid cloneFrom silently returns null", () => {
  beforeEach(() => {
    findFirstMock.mockReset();
    findFirstMock.mockResolvedValue(null);
  });

  it("returns null for an unknown string", async () => {
    const ref = await resolveVault("NONEXISTENT-XYZ");
    expect(ref).toBeNull();
  });

  it("returns null for empty string without DB hit", async () => {
    const ref = await resolveVault("");
    expect(ref).toBeNull();
    expect(findFirstMock).not.toHaveBeenCalled();
  });
});
