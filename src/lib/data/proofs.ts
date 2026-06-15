import "server-only";

import { verifyStoredAttestation } from "@/lib/attestation";
import { prisma } from "@/lib/db";
import { canRunDemoProvider } from "@/lib/demo/guard";
import { buildDemoProofs } from "@/lib/demo/admin/proof-center";
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
 * In demo mode (canRunDemoProvider()) returns simulated proof rows — no Prisma
 * access, all txHash null, attestationVerified null, hash is the sentinel.
 */
export async function getProofs(
  page: number = 1,
  pageSize: number = 50,
): Promise<PaginatedResult<ProofItem>> {
  if (canRunDemoProvider()) return buildDemoProofs();

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

      const verification = await verifyStoredAttestation({
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
        attestationVerified: verification === null ? null : verification.valid,
      };
    }),
  );

  const data = items.filter((item): item is ProofItem => item !== null);
  return toPaginatedResult(data, total, page, ps);
}
