import "server-only";

import { unstable_cache } from "next/cache";

import { verifyStoredAttestation } from "@/lib/attestation";
import { prisma } from "@/lib/db";
import type { ProofItem, ProofType } from "@/lib/proof-center-types";
import {
  clampPageSize,
  toPrismaSkip,
  toPaginatedResult,
  type PaginatedResult,
} from "@/lib/pagination";

const PROOF_TYPES: ReadonlySet<string> = new Set<ProofType>([
  "mining_attestation",
  "custody",
  "audit",
  "methodology",
]);

const TYPE_LABEL: Record<ProofType, string> = {
  mining_attestation: "Mining attestation",
  custody: "Custody proof-of-reserves snapshot",
  audit: "Audit report",
  methodology: "Methodology document",
};

function isProofType(value: string): value is ProofType {
  return PROOF_TYPES.has(value);
}

/**
 * ECDSA attestation verification is CPU-bound (a `secp256k1` recover per row)
 * and its result is **immutable** for a fixed `(payloadJson, digest, signature,
 * signer)` tuple — the canonical encoding, the recovered address, and the
 * signer match are all deterministic. The only runtime-variable input is the
 * env allowlist, which is stable within a deployment.
 *
 * Wrapping the verification in `unstable_cache` keyed by the immutable columns
 * lets us skip re-running N ECDSA recovers on every uncached request: within
 * the TTL we replay the memoized boolean instead. We return only the
 * serializable `attestationVerified` value (`boolean | null`) rather than the
 * full result object — `unstable_cache` requires a pure function with
 * serializable inputs and output.
 *
 * `null` fields collapse to the empty string in the key; a row missing any of
 * them yields `null` from `verifyStoredAttestation` anyway (no signature to
 * verify), so distinct such rows sharing an empty key are equivalent.
 */
async function verifyAttestationForRow(input: {
  payloadJson: string | null;
  digest: string | null;
  signature: string | null;
  signer: string | null;
}): Promise<boolean | null> {
  const run = unstable_cache(
    async (): Promise<boolean | null> => {
      const verification = await verifyStoredAttestation({
        payloadJson: input.payloadJson,
        digest: input.digest,
        signature: input.signature,
        signer: input.signer,
      });
      return verification === null ? null : verification.valid;
    },
    [
      "proof-attestation-verify",
      input.digest ?? "",
      input.signature ?? "",
      input.signer ?? "",
    ],
    { revalidate: 3600, tags: ["proof-attestation-verify"] },
  );
  return run();
}

/**
 * The Prisma `Proof` table has no `title` column; the Proof Center card needs
 * one. Derive a stable, human-readable title from the structured fields so the
 * grid renders consistently without a schema change.
 */
function deriveTitle(proofType: ProofType, period: string | null): string {
  const base = TYPE_LABEL[proofType];
  return period ? `${base} · ${period}` : base;
}

/**
 * Reads off-chain ("paper") proofs from the Prisma `Proof` table, newest first,
 * and maps them onto the `ProofItem` shape the Proof Center grid expects.
 *
 * Rows with an unknown `proofType` are skipped rather than rendered with a
 * broken filter taxonomy.
 *
 */
export async function getProofs(
  page: number = 1,
  pageSize: number = 50,
): Promise<PaginatedResult<ProofItem>> {
  const ps = clampPageSize(pageSize);

  const [rows, total] = await Promise.all([
    prisma.proof.findMany({
      orderBy: { postedAt: "desc" },
      skip: toPrismaSkip(page, ps),
      take: ps,
    }),
    prisma.proof.count(),
  ]);

  const items = await Promise.all(
    rows.map(async (row): Promise<ProofItem | null> => {
      if (!isProofType(row.proofType)) return null;

      const attestationVerified = await verifyAttestationForRow({
        payloadJson: row.payloadJson,
        digest: row.hash,
        signature: row.signature,
        signer: row.signer,
      });

      return {
        id: row.id,
        proofType: row.proofType,
        period: row.period,
        title: deriveTitle(row.proofType, row.period),
        hash: row.hash,
        uri: row.uri,
        postedAt: row.postedAt.toISOString(),
        postedBy: row.postedBy,
        txHash: row.txHash,
        signer: row.signer,
        attestationVerified,
      };
    }),
  );

  const data = items.filter((item): item is ProofItem => item !== null);
  return toPaginatedResult(data, total, page, ps);
}
