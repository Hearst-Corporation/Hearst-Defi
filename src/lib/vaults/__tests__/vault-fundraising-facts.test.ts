/**
 * Tests for loadFundraisingFacts()'s pure arithmetic guards (Bitcoin Strategic
 * Reserve B2B2C, P3): percentage clamp, null-target handling, zero-raised
 * handling. Mirrors the guard-testing philosophy of
 * `src/lib/engine/__tests__/mining-economics.test.ts` — never NaN/Infinity,
 * never a fabricated 0%/100% when the input is absent.
 *
 * Prisma is mocked (vi.hoisted + vi.mock), same convention as
 * `src/app/admin/vaults/__tests__/clone.test.ts`.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Prisma mock (must be hoisted before imports) ───────────────────────────

const { findUniqueMock, aggregateMock, findManyMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  aggregateMock: vi.fn(),
  findManyMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    vaultDeployment: {
      findUnique: findUniqueMock,
    },
    position: {
      aggregate: aggregateMock,
      findMany: findManyMock,
    },
  },
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────

import { loadFundraisingFacts } from "@/lib/vaults/vault-fundraising-facts";

// ── Helpers ────────────────────────────────────────────────────────────────

/** Minimal Decimal-like stub — only `.toNumber()` is exercised by the deriver. */
function decimal(n: number) {
  return { toNumber: () => n };
}

function buildDeploymentRow(overrides: {
  targetRaiseUsdc?: number | null;
  minRaiseUsdc?: number | null;
  fundraisingStage?: string;
  openingDate?: Date | null;
  closingDate?: Date | null;
  distributionFrequency?: string | null;
}) {
  return {
    targetRaiseUsdc:
      overrides.targetRaiseUsdc === undefined || overrides.targetRaiseUsdc === null
        ? null
        : decimal(overrides.targetRaiseUsdc),
    minRaiseUsdc:
      overrides.minRaiseUsdc === undefined || overrides.minRaiseUsdc === null
        ? null
        : decimal(overrides.minRaiseUsdc),
    fundraisingStage: overrides.fundraisingStage ?? "fundraising",
    openingDate: overrides.openingDate ?? null,
    closingDate: overrides.closingDate ?? null,
    distributionFrequency: overrides.distributionFrequency ?? null,
  };
}

beforeEach(() => {
  findUniqueMock.mockReset();
  aggregateMock.mockReset();
  findManyMock.mockReset();
});

// ── Tests: deployment not found ─────────────────────────────────────────────

describe("loadFundraisingFacts — not found", () => {
  it("returns null when the VaultDeployment row does not exist", async () => {
    findUniqueMock.mockResolvedValue(null);
    const facts = await loadFundraisingFacts("vault_missing");
    expect(facts).toBeNull();
    expect(aggregateMock).not.toHaveBeenCalled();
  });
});

// ── Tests: null-target handling ─────────────────────────────────────────────

describe("loadFundraisingFacts — no target set", () => {
  it("progressPct and remainingUsdc are null (never 0% or 100%) when targetRaiseUsdc is unset", async () => {
    findUniqueMock.mockResolvedValue(
      buildDeploymentRow({ targetRaiseUsdc: null, minRaiseUsdc: null }),
    );
    aggregateMock.mockResolvedValue({ _sum: { principalUsdc: decimal(250_000) } });
    findManyMock.mockResolvedValue([{ investorId: "inv_1" }]);

    const facts = await loadFundraisingFacts("vault_1");
    expect(facts).not.toBeNull();
    expect(facts?.targetRaiseUsdc).toBeNull();
    expect(facts?.progressPct).toBeNull();
    expect(facts?.remainingUsdc).toBeNull();
    expect(facts?.targetReached).toBe(false);
    expect(facts?.capitalRaisedUsdc).toBe(250_000);
  });

  it("minimumRaised is false (never fabricated true) when minRaiseUsdc is unset", async () => {
    findUniqueMock.mockResolvedValue(
      buildDeploymentRow({ minRaiseUsdc: null }),
    );
    aggregateMock.mockResolvedValue({ _sum: { principalUsdc: decimal(9_000_000) } });
    findManyMock.mockResolvedValue([]);

    const facts = await loadFundraisingFacts("vault_1");
    expect(facts?.minimumRaised).toBe(false);
  });
});

// ── Tests: zero-raised handling ──────────────────────────────────────────────

describe("loadFundraisingFacts — zero raised", () => {
  it("progressPct is 0 (not null, not NaN) when a target is set but nothing has been raised", async () => {
    findUniqueMock.mockResolvedValue(
      buildDeploymentRow({ targetRaiseUsdc: 1_000_000, minRaiseUsdc: 100_000 }),
    );
    aggregateMock.mockResolvedValue({ _sum: { principalUsdc: null } });
    findManyMock.mockResolvedValue([]);

    const facts = await loadFundraisingFacts("vault_1");
    expect(facts?.capitalRaisedUsdc).toBe(0);
    expect(facts?.progressPct).toBe(0);
    expect(facts?.remainingUsdc).toBe(1_000_000);
    expect(facts?.investorCount).toBe(0);
    expect(facts?.minimumRaised).toBe(false);
    expect(facts?.targetReached).toBe(false);
  });
});

// ── Tests: percentage clamp ──────────────────────────────────────────────────

describe("loadFundraisingFacts — percentage clamp [0,100]", () => {
  it("clamps progressPct at 100 when capital raised exceeds the target (never > 100)", async () => {
    findUniqueMock.mockResolvedValue(
      buildDeploymentRow({ targetRaiseUsdc: 1_000_000, minRaiseUsdc: 100_000 }),
    );
    aggregateMock.mockResolvedValue({ _sum: { principalUsdc: decimal(1_500_000) } });
    findManyMock.mockResolvedValue([{ investorId: "inv_1" }, { investorId: "inv_2" }]);

    const facts = await loadFundraisingFacts("vault_1");
    expect(facts?.progressPct).toBe(100);
    expect(facts?.targetReached).toBe(true);
    expect(facts?.minimumRaised).toBe(true);
    expect(facts?.investorCount).toBe(2);
    // remainingUsdc is allowed to go negative (honest over-subscription signal),
    // only progressPct is clamped for display purposes.
    expect(facts?.remainingUsdc).toBe(-500_000);
  });

  it("computes a mid-range percentage correctly and never returns NaN/Infinity", async () => {
    findUniqueMock.mockResolvedValue(
      buildDeploymentRow({ targetRaiseUsdc: 4_000_000, minRaiseUsdc: 1_000_000 }),
    );
    aggregateMock.mockResolvedValue({ _sum: { principalUsdc: decimal(1_000_000) } });
    findManyMock.mockResolvedValue([{ investorId: "inv_1" }]);

    const facts = await loadFundraisingFacts("vault_1");
    expect(facts?.progressPct).toBe(25);
    expect(Number.isFinite(facts?.progressPct as number)).toBe(true);
    expect(facts?.minimumRaised).toBe(true);
    expect(facts?.targetReached).toBe(false);
  });

  it("never produces NaN/Infinity even with a degenerate (zero) target", async () => {
    findUniqueMock.mockResolvedValue(
      buildDeploymentRow({ targetRaiseUsdc: 0, minRaiseUsdc: null }),
    );
    aggregateMock.mockResolvedValue({ _sum: { principalUsdc: decimal(500) } });
    findManyMock.mockResolvedValue([]);

    const facts = await loadFundraisingFacts("vault_1");
    // A zero target is degenerate for percentage purposes — treated as "no
    // target" (null), never a divide-by-zero NaN/Infinity. remainingUsdc still
    // reports the honest (0 - raised) delta since a target value IS present.
    expect(facts?.progressPct).toBeNull();
    expect(Number.isFinite(facts?.remainingUsdc as number)).toBe(true);
    expect(facts?.remainingUsdc).toBe(-500);
  });
});

// ── Tests: passthrough fields ─────────────────────────────────────────────────

describe("loadFundraisingFacts — passthrough fields", () => {
  it("passes through fundraisingStage, dates, and distributionFrequency unmodified", async () => {
    const opening = new Date("2026-06-01T00:00:00Z");
    const closing = new Date("2026-09-01T00:00:00Z");
    findUniqueMock.mockResolvedValue(
      buildDeploymentRow({
        fundraisingStage: "target_reached",
        openingDate: opening,
        closingDate: closing,
        distributionFrequency: "monthly",
      }),
    );
    aggregateMock.mockResolvedValue({ _sum: { principalUsdc: null } });
    findManyMock.mockResolvedValue([]);

    const facts = await loadFundraisingFacts("vault_1");
    expect(facts?.fundraisingStage).toBe("target_reached");
    expect(facts?.openingDate).toBe(opening);
    expect(facts?.closingDate).toBe(closing);
    expect(facts?.distributionFrequency).toBe("monthly");
  });
});
