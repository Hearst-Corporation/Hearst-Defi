/**
 * Unit tests for src/app/admin/vaults/actions.ts — rejectDeployment.
 *
 * Mock strategy mirrors src/app/admin/proofs/__tests__/actions.test.ts:
 * • requireAdmin               — vi.mock'd, controlled per test
 * • prisma.vaultDeployment.*   — vi.mock'd (findUnique + update)
 * • prisma.vaultDeploymentApproval.deleteMany — vi.mock'd
 * • prisma.$transaction        — runs the ops sequentially (Prisma's array form)
 * • recordAdminAudit / logger  — silenced
 *
 * Coverage focus (P0-B / P0-C / P1):
 *   1. Whitelist guard         — non-whitelisted actor → throws.
 *   2. Approvals purge         — successful reject runs deleteMany inside $transaction.
 *   3. Race UX message         — vault already advanced (e.g. "deployed") → clear message.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (must be declared before the module under test is imported) ──────

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  const prisma: Record<string, unknown> = {
    vaultDeployment: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    vaultDeploymentApproval: {
      deleteMany: vi.fn(),
    },
    // D3: updateDraftVault now upserts the ShareClass inside the $transaction.
    shareClass: {
      upsert: vi.fn(),
    },
  };
  // $transaction supports BOTH forms used in this module:
  //   • array form  ($transaction([op1, op2])) — rejectDeployment
  //   • callback form ($transaction(async (tx) => …)) — updateDraftVault,
  //     where `tx` is the same mocked prisma so tx.vaultDeployment / tx.shareClass resolve.
  prisma["$transaction"] = vi.fn((arg: unknown) =>
    Array.isArray(arg)
      ? Promise.all(arg)
      : (arg as (tx: unknown) => unknown)(prisma),
  );
  return { prisma };
});

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

// ── Imports (after mocks) ──────────────────────────────────────────────────

import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { createDraftVault, rejectDeployment } from "../actions";
import type { CreateDraftInput } from "../actions";

// ── Helpers ────────────────────────────────────────────────────────────────

const SIGNER_A = "0xSignerA";
const SIGNER_B = "0xSignerB";
const NON_SIGNER = "0xRogueAdmin";

const VAULT_ID = "vault_cuid_001";

function buildVault(overrides: Partial<{ status: string; signersWhitelist: string[] }> = {}) {
  return {
    id: VAULT_ID,
    status: overrides.status ?? "review",
    signersWhitelist: JSON.stringify(
      overrides.signersWhitelist ?? [SIGNER_A, SIGNER_B],
    ),
    // Other columns are not read by rejectDeployment; opaque to the test.
  } as never;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("rejectDeployment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("P0-C — non-whitelisted actor → throws 'Only whitelisted signers'", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({
      userId: "user_rogue",
      walletAddress: NON_SIGNER,
    });
    vi.mocked(prisma.vaultDeployment.findUnique).mockResolvedValue(buildVault());

    await expect(
      rejectDeployment(VAULT_ID, "I want it back to draft"),
    ).rejects.toThrow("Only whitelisted signers can hard-reject a deployment");

    // No write should have happened: neither the purge nor the status update.
    expect(prisma.vaultDeploymentApproval.deleteMany).not.toHaveBeenCalled();
    expect(prisma.vaultDeployment.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("P0-B — whitelisted actor on review vault → purges approvals in transaction and resets submittedAt", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({
      userId: "user_a",
      walletAddress: SIGNER_A,
    });
    vi.mocked(prisma.vaultDeployment.findUnique).mockResolvedValue(buildVault());
    vi.mocked(prisma.vaultDeploymentApproval.deleteMany).mockResolvedValue({
      count: 1,
    } as never);
    vi.mocked(prisma.vaultDeployment.update).mockResolvedValue({
      id: VAULT_ID,
      status: "draft",
    } as never);

    await rejectDeployment(VAULT_ID, "Need to revise allocation policy");

    // $transaction was called exactly once, with an array of two operations.
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    const txArg = vi.mocked(prisma.$transaction).mock.calls[0]?.[0] as unknown;
    expect(Array.isArray(txArg)).toBe(true);
    expect(txArg as unknown[]).toHaveLength(2);

    // Both operations were issued (and were inside the $transaction call).
    expect(prisma.vaultDeploymentApproval.deleteMany).toHaveBeenCalledWith({
      where: { deploymentId: VAULT_ID },
    });
    expect(prisma.vaultDeployment.update).toHaveBeenCalledWith({
      where: { id: VAULT_ID },
      data: { status: "draft", submittedAt: null },
    });

    // Simulate the call chain the bug fix protects against: after reject,
    // a fresh approvals query (deleteMany already ran) must return [].
    vi.mocked(prisma.vaultDeploymentApproval.deleteMany).mockClear();
    // (Real findMany is not mocked here — but the contract proven above is that
    // deleteMany was scoped to deploymentId === VAULT_ID, so the next round
    // starts at zero approvals.)
  });

  it("P1 — race condition: vault.status === 'deployed' → clear UX message", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({
      userId: "user_a",
      walletAddress: SIGNER_A,
    });
    vi.mocked(prisma.vaultDeployment.findUnique).mockResolvedValue(
      buildVault({ status: "deployed" }),
    );

    await expect(
      rejectDeployment(VAULT_ID, "Changed my mind"),
    ).rejects.toThrow(/status is now "deployed"/);

    // Race-guard fires before any write — no purge, no update, no transaction.
    expect(prisma.vaultDeploymentApproval.deleteMany).not.toHaveBeenCalled();
    expect(prisma.vaultDeployment.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("Sanity — vault not found → throws 'Not found'", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({
      userId: "user_a",
      walletAddress: SIGNER_A,
    });
    vi.mocked(prisma.vaultDeployment.findUnique).mockResolvedValue(null);

    await expect(rejectDeployment(VAULT_ID, "reason")).rejects.toThrow(
      "Not found",
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("Sanity — non-admin → requireAdmin throws, propagated", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error("Admin access required."));

    await expect(rejectDeployment(VAULT_ID, "reason")).rejects.toThrow(
      "Admin access required.",
    );
    expect(prisma.vaultDeployment.findUnique).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// CreateDraftSchema Zod refinement tests (P1)
// ---------------------------------------------------------------------------

/** Minimal valid payload that satisfies all CreateDraftSchema rules. */
function validDraftInput(): CreateDraftInput {
  return {
    ticker: "HYV-A",
    name: "Hearst Yield Vault Series A",
    description: undefined,
    strategy: "mining_yield",
    colorTag: "accent",
    minTicketUsdc: 250_000,
    capacityUsdc: 10_000_000,
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
      "This is not an offer of securities. Past performance does not predict future results. Capital is subject to market risk. This is a projection only.",
    targetMiningBps: 6_000,
    targetBtcTacticalBps: 2_500,
    targetUsdcBaseBps: 1_000,
    targetStableReserveBps: 500,
    signersWhitelist: ["0xSignerA", "0xSignerB"],
    requiredSigners: 2,
  };
}

describe("CreateDraftSchema — Zod refinements (P1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue({
      userId: "user_admin",
      walletAddress: "0xAdmin",
    });
    vi.mocked(prisma.vaultDeployment.create).mockResolvedValue({
      id: "vault_new_001",
      ticker: "HYV-A",
    } as never);
  });

  it("happy path — valid input passes all refinements", async () => {
    const result = await createDraftVault(validDraftInput());
    expect(result.ok).toBe(true);
  });

  it("APY range invariant — targetApyHighBps <= targetApyLowBps → rejected", async () => {
    const input = validDraftInput();
    input.targetApyHighBps = 800; // equal to low → must fail
    input.targetApyLowBps = 800;
    const result = await createDraftVault(input);
    expect(result.ok).toBe(false);
    if (!result.ok && typeof result.issues !== "string") {
      const msgs = result.issues.map((i) => i.message);
      expect(msgs.some((m) => /targetApyHighBps.*greater.*targetApyLowBps/i.test(m))).toBe(true);
    }
  });

  it("Allocation sum — does not equal 10000 bps → rejected", async () => {
    const input = validDraftInput();
    input.targetMiningBps = 5_000; // sum becomes 9000
    const result = await createDraftVault(input);
    expect(result.ok).toBe(false);
    if (!result.ok && typeof result.issues !== "string") {
      const msgs = result.issues.map((i) => i.message);
      expect(msgs.some((m) => /sum.*10000|10000.*sum/i.test(m))).toBe(true);
    }
  });

  it("Description forbidden word — contains 'guarantee' → rejected", async () => {
    const input = validDraftInput();
    input.description = "We guarantee excellent returns.";
    const result = await createDraftVault(input);
    expect(result.ok).toBe(false);
    if (!result.ok && typeof result.issues !== "string") {
      const msgs = result.issues.map((i) => i.message);
      expect(msgs.some((m) => /forbidden word/i.test(m))).toBe(true);
    }
  });

  it("Required signers — exceeds whitelist size → rejected", async () => {
    const input = validDraftInput();
    input.signersWhitelist = ["0xA", "0xB"];
    input.requiredSigners = 3; // 3 > 2 → must fail
    const result = await createDraftVault(input);
    expect(result.ok).toBe(false);
    if (!result.ok && typeof result.issues !== "string") {
      const msgs = result.issues.map((i) => i.message);
      expect(msgs.some((m) => /requiredSigners.*exceed.*signersWhitelist/i.test(m))).toBe(true);
    }
  });

  it("Required signers — below 2 → rejected by base bounds", async () => {
    const input = validDraftInput();
    input.requiredSigners = 1;
    const result = await createDraftVault(input);
    expect(result.ok).toBe(false);
  });

  it("Required signers — above 5 → rejected by base bounds", async () => {
    const input = validDraftInput();
    input.signersWhitelist = ["0xA", "0xB", "0xC", "0xD", "0xE", "0xF"]; // 6 > max 5
    input.requiredSigners = 6;
    const result = await createDraftVault(input);
    expect(result.ok).toBe(false);
  });

  it("Required signers — quorum 3-of-5 happy path", async () => {
    const input = validDraftInput();
    input.signersWhitelist = ["0xA", "0xB", "0xC", "0xD", "0xE"];
    input.requiredSigners = 3;
    const result = await createDraftVault(input);
    expect(result.ok).toBe(true);
  });

  it("Name forbidden word — contains 'guarantee' → rejected", async () => {
    const input = validDraftInput();
    input.name = "Hearst Guaranteed Vault";
    const result = await createDraftVault(input);
    expect(result.ok).toBe(false);
    if (!result.ok && typeof result.issues !== "string") {
      const msgs = result.issues.map((i) => i.message);
      expect(
        msgs.some(
          (m) =>
            /forbidden word/i.test(m) &&
            result.issues !== "string" &&
            (result.issues as import("zod").ZodIssue[]).some(
              (issue) => issue.path.includes("name"),
            ),
        ),
      ).toBe(true);
    }
  });
});
