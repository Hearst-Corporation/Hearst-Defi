"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { assertRateLimit } from "@/lib/rate-limit";
import { publishSignedAttestation } from "@/lib/attestation/publish";
import { parseAttestationPayload } from "@/lib/attestation/stored";
import { recordAdminAudit } from "@/lib/admin/audit";

/** Admin proof actions rate limit: 20 requests / 60s / admin. */
const PROOF_RATE_MAX = 20;
const PROOF_RATE_WINDOW_MS = 60_000;

// ----------------------------------------------------------------------------
// Schema
// ----------------------------------------------------------------------------

const PROOF_TYPES = [
  "mining_attestation",
  "custody",
  "audit",
  "methodology",
] as const;

/**
 * Proof.hash is stored as a bytes32 hex string (64 hex chars, 0x-prefixed = 66 chars).
 * We also accept IPFS CIDv0 (Qm…, 46 chars) and CIDv1 (baf…, 52-59 chars) as hash values
 * because some attestations store the CID directly rather than a keccak digest.
 */
const HashSchema = z
  .string()
  .refine(
    (v) =>
      /^0x[a-fA-F0-9]{64}$/.test(v) || // bytes32 hex
      /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(v) || // CIDv0
      /^baf[a-zA-Z0-9]{49,56}$/.test(v), // CIDv1
    {
      message:
        "hash must be a bytes32 hex (0x + 64 hex chars), CIDv0 (Qm…), or CIDv1 (baf…)",
    },
  );

const ProofIngestSchema = z.object({
  proofType: z.enum(PROOF_TYPES),
  period: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "period must be YYYY-MM")
    .optional(),
  hash: HashSchema,
  uri: z
    .string()
    .min(1, "uri is required")
    .max(2048)
    .refine(
      (v) => v.startsWith("ipfs://") || v.startsWith("https://"),
      { message: "uri must start with ipfs:// or https://" },
    ),
  txHash: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/, "txHash must be 0x + 64 hex chars")
    .optional(),
  notes: z.string().max(500).optional(),
});

export type ProofIngestInput = z.infer<typeof ProofIngestSchema>;

export type ProofIngestResult =
  | { ok: true; id: string }
  | { ok: false; issues: z.ZodIssue[] };

// ----------------------------------------------------------------------------
// Actions
// ----------------------------------------------------------------------------

/**
 * Admin-gated Server Action: validate and persist a new Proof row.
 *
 * - Validates the payload with Zod (strict).
 * - Calls requireAdmin() — throws if the requester is not an admin.
 * - Persists via Prisma and revalidates /admin/proofs + /admin/proof-center.
 */
export async function ingestProof(
  input: ProofIngestInput,
): Promise<ProofIngestResult> {
  const admin = await requireAdmin();

  try {
    await assertRateLimit(
      `admin:proofs:${admin.userId}`,
      PROOF_RATE_MAX,
      PROOF_RATE_WINDOW_MS,
    );
  } catch {
    return { ok: false, issues: [{ code: "custom", path: ["rateLimit"], message: "Too many requests" }] };
  }

  const parsed = ProofIngestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues };
  }

  const { proofType, period, hash, uri, txHash, notes } = parsed.data;

  try {
    const proof = await prisma.proof.create({
      data: {
        proofType,
        period: period ?? null,
        hash,
        uri,
        txHash: txHash ?? null,
        notes: notes ?? null,
        // postedBy uses the admin's walletAddress when available, else userId
        postedBy: admin.walletAddress ?? admin.userId,
        // postedAt is defaulted to now() in the Prisma schema
      },
    });

    await recordAdminAudit({
      actorWallet: admin.walletAddress ?? admin.userId,
      action: "proof.ingest",
      entityType: "Proof",
      entityId: proof.id,
      after: { proofType, period: period ?? null, hash },
    });

    revalidatePath("/admin/proofs");
    revalidatePath("/admin/proof-center");

    logger.info("proof ingested", { proofId: proof.id, proofType });

    return { ok: true, id: proof.id };
  } catch (err) {
    logger.error("ingestProof failed", { proofType }, err);
    throw err;
  }
}

export type PublishOnChainResult =
  | { ok: true; armed: boolean; txHash: string | null }
  | { ok: false; error: string };

/**
 * Admin-gated Server Action: publish a stored mining-attestation Proof to the
 * on-chain PoRRegistry.
 *
 * The on-chain figures come exclusively from the proof's signed payloadJson —
 * nothing is fabricated. Gated/disarmed-safe: returns { ok:true, armed:false }
 * when the publisher key or PoRRegistry address is unset (no DB mutation).
 */
export async function publishProofOnChain(
  proofId: string,
): Promise<PublishOnChainResult> {
  const admin = await requireAdmin();

  try {
    await assertRateLimit(
      `admin:proofs:${admin.userId}`,
      PROOF_RATE_MAX,
      PROOF_RATE_WINDOW_MS,
    );
  } catch {
    return { ok: false, error: "Too many requests" };
  }

  const proof = await prisma.proof.findUnique({ where: { id: proofId } });
  if (proof === null) {
    return { ok: false, error: "Proof not found." };
  }

  if (
    proof.proofType !== "mining_attestation" ||
    !proof.payloadJson ||
    !proof.signature ||
    !/^0x[0-9a-fA-F]{64}$/.test(proof.hash)
  ) {
    return {
      ok: false,
      error: "Only signed mining attestations can be published on-chain.",
    };
  }

  if (proof.txHash) {
    return {
      ok: false,
      error: "This attestation is already anchored on-chain.",
    };
  }

  const payload = parseAttestationPayload(proof.payloadJson);
  if (payload === null) {
    return { ok: false, error: "Attestation payload is malformed." };
  }

  // Both `proof.hash` and `proof.signature` have been validated above:
  //   • hash: regex /^0x[0-9a-fA-F]{64}$/ guarantees the template-literal shape.
  //   • signature: presence checked (non-null) and the column is typed as `String?`
  //     in Prisma — the DB never stores a non-string there.
  // Widening via `as` is safe here; `as unknown as` is deliberately avoided.
  const signed = {
    payload,
    digest: proof.hash as `0x${string}`,
    signature: proof.signature as `0x${string}`,
    signedAt: proof.postedAt.toISOString(),
  };

  try {
    const txHash = await publishSignedAttestation(signed);

    if (txHash === null) {
      // Publisher disarmed — nothing written, be honest about it.
      logger.info("publishProofOnChain: publisher disarmed (no-op)", { proofId });
      return { ok: true, armed: false, txHash: null };
    }

    await prisma.proof.update({ where: { id: proofId }, data: { txHash } });

    await recordAdminAudit({
      actorWallet: admin.walletAddress ?? admin.userId,
      action: "proof.publishOnChain",
      entityType: "Proof",
      entityId: proofId,
      after: { txHash, period: payload.period },
    });

    revalidatePath("/admin/proofs");
    revalidatePath("/admin/proof-center");

    logger.info("publishProofOnChain: attestation anchored on-chain", {
      proofId,
      txHash,
      period: payload.period,
    });

    return { ok: true, armed: true, txHash };
  } catch (err) {
    logger.error("publishProofOnChain failed", { proofId }, err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unexpected error during on-chain publish.",
    };
  }
}

/**
 * Admin-gated Server Action: hard-delete a Proof row by id.
 */
export async function deleteProof(id: string): Promise<{ ok: true }> {
  const admin = await requireAdmin();

  try {
    await assertRateLimit(
      `admin:proofs:${admin.userId}`,
      PROOF_RATE_MAX,
      PROOF_RATE_WINDOW_MS,
    );
  } catch {
    throw new Error("Too many requests");
  }

  // Snapshot the proof before deletion so the audit log preserves what was
  // removed (the row is gone after delete and cannot be reconstructed).
  const existing = await prisma.proof.findUnique({
    where: { id },
    select: { proofType: true, period: true, hash: true },
  });

  try {
    await prisma.proof.delete({ where: { id } });

    await recordAdminAudit({
      actorWallet: admin.walletAddress ?? admin.userId,
      action: "proof.delete",
      entityType: "Proof",
      entityId: id,
      before: existing
        ? { proofType: existing.proofType, period: existing.period, hash: existing.hash }
        : null,
    });

    revalidatePath("/admin/proofs");
    revalidatePath("/admin/proof-center");
    logger.info("proof deleted", { proofId: id });
    return { ok: true };
  } catch (err) {
    // Race: another admin already deleted this proof. Surface a clean message
    // instead of leaking Prisma's verbose error text.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      logger.warn("deleteProof: already deleted", { proofId: id });
      throw new Error("Proof already deleted");
    }
    logger.error("deleteProof failed", { proofId: id }, err);
    throw err;
  }
}
