/**
 * Unit tests for publishProofOnChain in src/app/admin/proofs/actions.ts
 *
 * Mock strategy
 * ─────────────
 * • requireAdmin              — vi.mock'd; resolves to MOCK_ADMIN or throws
 * • prisma.proof              — vi.mock'd; findUnique / update are vi.fn()
 * • publishSignedAttestation  — vi.mock'd; returns a txHash or null
 * • recordAdminAudit          — vi.mock'd; no-op spy
 * • assertRateLimit           — vi.mock'd; resolves immediately
 * • revalidatePath            — vi.mock'd; no-op spy
 * • logger                    — silenced
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (declared before the module under test is imported) ─────────────

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    proof: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/attestation/publish", () => ({
  publishSignedAttestation: vi.fn(),
}));

vi.mock("@/lib/admin/audit", () => ({
  recordAdminAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/rate-limit", () => ({
  assertRateLimit: vi.fn().mockResolvedValue(undefined),
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

// ── Imports (after mocks) ─────────────────────────────────────────────────

import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { publishSignedAttestation } from "@/lib/attestation/publish";
import { recordAdminAudit } from "@/lib/admin/audit";
import { revalidatePath } from "next/cache";
import { publishProofOnChain } from "../actions";

// ── Helpers ───────────────────────────────────────────────────────────────

const MOCK_ADMIN = { userId: "user_abc123", walletAddress: "0xAdminWallet" };

const VALID_PAYLOAD = JSON.stringify({
  version: 1,
  period: "2026-05",
  partner: "Acme Mining LLC",
  attestor: "0xAttestorAddress1234567890abcdef12345678",
  deployedHashrateThs: 500,
  uptimePct: 98.5,
  hashpriceUsdPerThDay: 0.065,
  minedBtc: 1.234,
  revenueUsd: 75000,
  operatingCostUsd: 42000,
  totalAumUsd: 10_000_000,
  evidenceCid: "bafybeib2k3l4m5n6o7p8q9r0s1t2u3v4w5x6y7z8a9b0c1d2e3f4g5h6i7j8",
});

const VALID_HASH = "0xab12cd34ef5678901234567890abcdef1234567890abcdef1234567890abf9c3";
const VALID_TX   = "0xdeadbeefcafe1234567890abcdef1234567890abcdef1234567890abcdef1234";
const VALID_SIG  = "0xcafe0000000000000000000000000000000000000000000000000000000000dead0000000000000000000000000000000000000000000000000000000000000001";

const BASE_PROOF = {
  id: "proof_cuid_001",
  proofType: "mining_attestation",
  period: "2026-05",
  hash: VALID_HASH,
  uri: "ipfs://bafybeib2k3",
  postedAt: new Date("2026-05-31T00:00:00Z"),
  postedBy: "0xAttestorAddress1234567890abcdef12345678",
  txHash: null,
  notes: null,
  signer: "0xAttestorAddress1234567890abcdef12345678",
  signature: VALID_SIG,
  payloadJson: VALID_PAYLOAD,
};

// ── Tests ─────────────────────────────────────────────────────────────────

describe("publishProofOnChain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Case A: armed — publishSignedAttestation returns a txHash ────────────

  it("Case A — armed: publishSignedAttestation returns txHash → proof.update called, audit recorded, {ok:true, armed:true, txHash}", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(MOCK_ADMIN);
    vi.mocked(prisma.proof.findUnique).mockResolvedValue(BASE_PROOF as never);
    vi.mocked(publishSignedAttestation).mockResolvedValue(VALID_TX as `0x${string}`);
    vi.mocked(prisma.proof.update).mockResolvedValue({ ...BASE_PROOF, txHash: VALID_TX } as never);

    const result = await publishProofOnChain("proof_cuid_001");

    expect(result).toEqual({ ok: true, armed: true, txHash: VALID_TX });

    // proof.update must be called with the returned txHash
    expect(prisma.proof.update).toHaveBeenCalledOnce();
    expect(prisma.proof.update).toHaveBeenCalledWith({
      where: { id: "proof_cuid_001" },
      data: { txHash: VALID_TX },
    });

    // audit must be recorded with correct shape
    expect(recordAdminAudit).toHaveBeenCalledOnce();
    expect(recordAdminAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorWallet: MOCK_ADMIN.walletAddress,
        action: "proof.publishOnChain",
        entityType: "Proof",
        entityId: "proof_cuid_001",
        after: { txHash: VALID_TX, period: "2026-05" },
      }),
    );

    // cache revalidation
    expect(revalidatePath).toHaveBeenCalledWith("/admin/proofs");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/proof-center");
  });

  it("Case A — admin without walletAddress → falls back to userId in audit actorWallet", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ userId: "user_noWallet" });
    vi.mocked(prisma.proof.findUnique).mockResolvedValue(BASE_PROOF as never);
    vi.mocked(publishSignedAttestation).mockResolvedValue(VALID_TX as `0x${string}`);
    vi.mocked(prisma.proof.update).mockResolvedValue({ ...BASE_PROOF, txHash: VALID_TX } as never);

    await publishProofOnChain("proof_cuid_001");

    expect(recordAdminAudit).toHaveBeenCalledWith(
      expect.objectContaining({ actorWallet: "user_noWallet" }),
    );
  });

  // ── Case B: disarmed — publishSignedAttestation returns null ─────────────

  it("Case B — disarmed: publishSignedAttestation returns null → NO proof.update, NO audit, {ok:true, armed:false, txHash:null}", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(MOCK_ADMIN);
    vi.mocked(prisma.proof.findUnique).mockResolvedValue(BASE_PROOF as never);
    vi.mocked(publishSignedAttestation).mockResolvedValue(null);

    const result = await publishProofOnChain("proof_cuid_001");

    expect(result).toEqual({ ok: true, armed: false, txHash: null });

    expect(prisma.proof.update).not.toHaveBeenCalled();
    expect(recordAdminAudit).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  // ── Case C: guard failures — nothing written ──────────────────────────────

  it("Case C1 — proof not found → {ok:false, error:'Proof not found.'}, nothing written", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(MOCK_ADMIN);
    vi.mocked(prisma.proof.findUnique).mockResolvedValue(null);

    const result = await publishProofOnChain("proof_cuid_missing");

    expect(result).toEqual({ ok: false, error: "Proof not found." });
    expect(publishSignedAttestation).not.toHaveBeenCalled();
    expect(prisma.proof.update).not.toHaveBeenCalled();
    expect(recordAdminAudit).not.toHaveBeenCalled();
  });

  it("Case C2 — proofType !== mining_attestation → {ok:false}, nothing written", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(MOCK_ADMIN);
    vi.mocked(prisma.proof.findUnique).mockResolvedValue({
      ...BASE_PROOF,
      proofType: "custody",
    } as never);

    const result = await publishProofOnChain("proof_cuid_001");

    expect(result).toMatchObject({ ok: false });
    expect(publishSignedAttestation).not.toHaveBeenCalled();
    expect(prisma.proof.update).not.toHaveBeenCalled();
  });

  it("Case C3 — proof already has txHash → {ok:false, error containing 'already anchored'}, nothing written", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(MOCK_ADMIN);
    vi.mocked(prisma.proof.findUnique).mockResolvedValue({
      ...BASE_PROOF,
      txHash: VALID_TX,
    } as never);

    const result = await publishProofOnChain("proof_cuid_001");

    expect(result).toMatchObject({ ok: false });
    expect((result as { ok: false; error: string }).error).toMatch(/already anchored/i);
    expect(publishSignedAttestation).not.toHaveBeenCalled();
    expect(prisma.proof.update).not.toHaveBeenCalled();
  });

  it("Case C4 — payloadJson is null (missing signature) → {ok:false}, nothing written", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(MOCK_ADMIN);
    vi.mocked(prisma.proof.findUnique).mockResolvedValue({
      ...BASE_PROOF,
      payloadJson: null,
    } as never);

    const result = await publishProofOnChain("proof_cuid_001");

    expect(result).toMatchObject({ ok: false });
    expect(publishSignedAttestation).not.toHaveBeenCalled();
    expect(prisma.proof.update).not.toHaveBeenCalled();
  });

  it("Case C5 — malformed payloadJson → {ok:false, error:'Attestation payload is malformed.'}, nothing written", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(MOCK_ADMIN);
    vi.mocked(prisma.proof.findUnique).mockResolvedValue({
      ...BASE_PROOF,
      payloadJson: JSON.stringify({ version: 1, bad: "shape" }),
    } as never);

    const result = await publishProofOnChain("proof_cuid_001");

    expect(result).toEqual({
      ok: false,
      error: "Attestation payload is malformed.",
    });
    expect(publishSignedAttestation).not.toHaveBeenCalled();
    expect(prisma.proof.update).not.toHaveBeenCalled();
  });

  it("Case C6 — hash not 0x+64hex (e.g. IPFS CID) → {ok:false}, nothing written", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(MOCK_ADMIN);
    vi.mocked(prisma.proof.findUnique).mockResolvedValue({
      ...BASE_PROOF,
      hash: "bafybeib2k3l4m5n6o7p8q9r0s1t2u3v4w5x6y7z8a9b0c1d2e3f4g5h6i7j8",
    } as never);

    const result = await publishProofOnChain("proof_cuid_001");

    expect(result).toMatchObject({ ok: false });
    expect(publishSignedAttestation).not.toHaveBeenCalled();
    expect(prisma.proof.update).not.toHaveBeenCalled();
  });

  // ── Error path ────────────────────────────────────────────────────────────

  it("Case E — prisma.proof.update throws → {ok:false, error} (publishSignedAttestation itself never throws)", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(MOCK_ADMIN);
    vi.mocked(prisma.proof.findUnique).mockResolvedValue(BASE_PROOF as never);
    vi.mocked(publishSignedAttestation).mockResolvedValue(VALID_TX as `0x${string}`);
    vi.mocked(prisma.proof.update).mockRejectedValue(new Error("DB connection lost"));

    const result = await publishProofOnChain("proof_cuid_001");

    expect(result).toMatchObject({ ok: false });
    expect((result as { ok: false; error: string }).error).toContain("DB connection lost");
  });

  // ── Auth guard ────────────────────────────────────────────────────────────

  it("Case F — non-admin → requireAdmin throws, propagated (no DB access)", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error("Admin access required."));

    await expect(publishProofOnChain("proof_cuid_001")).rejects.toThrow(
      "Admin access required.",
    );
    expect(prisma.proof.findUnique).not.toHaveBeenCalled();
    expect(publishSignedAttestation).not.toHaveBeenCalled();
  });
});
