/**
 * Unit tests for src/app/admin/proofs/actions.ts
 *
 * Mock strategy
 * ─────────────
 * • requireAdmin   — vi.mock'd to resolve immediately (admin present) or throw (non-admin)
 * • prisma.proof   — vi.mock'd, create/delete are vi.fn()
 * • next/cache     — revalidatePath is a no-op spy
 * • logger         — silenced
 *
 * Pattern mirrors the other admin action test suites in this repo.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (must be declared before the module under test is imported) ──────

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    proof: {
      create: vi.fn(),
      delete: vi.fn(),
      // D2: ingestProof/deleteProof now snapshot + audit. findUnique is used by
      // deleteProof to capture the row before deletion.
      findUnique: vi.fn(),
    },
  },
}));

// D2: actions now write an admin-audit row. Mock the audit module (mirrors the
// vaults/governance suites) so the audit call is a no-op and needs no DB mock.
vi.mock("@/lib/admin/audit", () => ({
  recordAdminAudit: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  assertRateLimit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────

import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { recordAdminAudit } from "@/lib/admin/audit";
import { ingestProof, deleteProof } from "../actions";

// ── Helpers ────────────────────────────────────────────────────────────────

const MOCK_ADMIN = { userId: "user_abc123", walletAddress: "0xAdminWallet" };

const VALID_INPUT = {
  proofType: "mining_attestation" as const,
  period: "2026-05",
  hash: "0xab12cd34ef5678901234567890abcdef1234567890abcdef1234567890abf9c3",
  uri: "ipfs://bafybeib2k3l4m5n6o7p8q9r0s1t2u3v4w5x6y7z8a9b0c1d2e3f4g5h6i7j8",
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe("ingestProof", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Case A — admin + valid input → { ok: true, id } and row created", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(MOCK_ADMIN);
    vi.mocked(prisma.proof.create).mockResolvedValue({
      id: "proof_cuid_001",
      proofType: VALID_INPUT.proofType,
      period: VALID_INPUT.period,
      hash: VALID_INPUT.hash,
      uri: VALID_INPUT.uri,
      postedAt: new Date(),
      postedBy: MOCK_ADMIN.walletAddress,
      txHash: null,
      notes: null,
    } as never);

    const result = await ingestProof(VALID_INPUT);

    expect(result).toEqual({ ok: true, id: "proof_cuid_001" });
    expect(prisma.proof.create).toHaveBeenCalledOnce();
    expect(prisma.proof.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        proofType: "mining_attestation",
        period: "2026-05",
        hash: VALID_INPUT.hash,
        uri: VALID_INPUT.uri,
        txHash: null,
        notes: null,
        postedBy: MOCK_ADMIN.walletAddress,
      }),
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/proofs");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/proof-center");
    // D2: a proof.ingest audit row is written after a successful create.
    expect(recordAdminAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "proof.ingest",
        entityType: "Proof",
        entityId: "proof_cuid_001",
        after: expect.objectContaining({ proofType: "mining_attestation", hash: VALID_INPUT.hash }),
      }),
    );
  });

  it("Case A² — admin + valid input with notes → notes persisted on the row", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(MOCK_ADMIN);
    vi.mocked(prisma.proof.create).mockResolvedValue({
      id: "proof_cuid_002",
      proofType: VALID_INPUT.proofType,
      period: VALID_INPUT.period,
      hash: VALID_INPUT.hash,
      uri: VALID_INPUT.uri,
      postedAt: new Date(),
      postedBy: MOCK_ADMIN.walletAddress,
      txHash: null,
      notes: "Quarterly attestation — Spearbit signed off on Phase 2 ABI.",
    } as never);

    const result = await ingestProof({
      ...VALID_INPUT,
      notes: "Quarterly attestation — Spearbit signed off on Phase 2 ABI.",
    });

    expect(result).toEqual({ ok: true, id: "proof_cuid_002" });
    expect(prisma.proof.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        notes: "Quarterly attestation — Spearbit signed off on Phase 2 ABI.",
      }),
    });
  });

  it("Case A³ — notes > 500 chars rejected by Zod, nothing created", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(MOCK_ADMIN);

    const result = await ingestProof({
      ...VALID_INPUT,
      notes: "x".repeat(501),
    });

    expect(result).toMatchObject({ ok: false });
    expect(prisma.proof.create).not.toHaveBeenCalled();
  });

  it("Case B — admin + invalid hash → { ok: false, issues }, nothing created", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(MOCK_ADMIN);

    const result = await ingestProof({
      ...VALID_INPUT,
      hash: "tooshort",
    });

    expect(result).toMatchObject({ ok: false });
    expect((result as { ok: false; issues: unknown[] }).issues.length).toBeGreaterThan(0);
    expect(prisma.proof.create).not.toHaveBeenCalled();
  });

  it("Case B² — admin + invalid period format → { ok: false, issues }, nothing created", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(MOCK_ADMIN);

    const result = await ingestProof({
      ...VALID_INPUT,
      period: "05-2026", // wrong format
    });

    expect(result).toMatchObject({ ok: false });
    expect(prisma.proof.create).not.toHaveBeenCalled();
  });

  it("Case C — non-admin → requireAdmin throws, propagated", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error("Admin access required."));

    await expect(ingestProof(VALID_INPUT)).rejects.toThrow("Admin access required.");
    expect(prisma.proof.create).not.toHaveBeenCalled();
  });
});

describe("deleteProof", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Case D — admin valid id → row deleted, { ok: true }", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(MOCK_ADMIN);
    // D2: deleteProof snapshots the row via findUnique before deleting.
    vi.mocked(prisma.proof.findUnique).mockResolvedValue({
      proofType: "custody",
      period: "2026-05",
      hash: VALID_INPUT.hash,
    } as never);
    vi.mocked(prisma.proof.delete).mockResolvedValue({} as never);

    const result = await deleteProof("proof_cuid_001");

    expect(result).toEqual({ ok: true });
    expect(prisma.proof.delete).toHaveBeenCalledOnce();
    expect(prisma.proof.delete).toHaveBeenCalledWith({
      where: { id: "proof_cuid_001" },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/proofs");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/proof-center");
    // D2: a proof.delete audit row preserves the deleted row's snapshot.
    expect(recordAdminAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "proof.delete",
        entityType: "Proof",
        entityId: "proof_cuid_001",
        before: expect.objectContaining({ proofType: "custody", hash: VALID_INPUT.hash }),
      }),
    );
  });

  it("Case C² — non-admin on delete → requireAdmin throws, propagated", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error("Admin access required."));

    await expect(deleteProof("proof_cuid_001")).rejects.toThrow("Admin access required.");
    expect(prisma.proof.delete).not.toHaveBeenCalled();
  });
});
