import { verifyStoredAttestation } from "@/lib/attestation";
import { prisma } from "@/lib/db";
import { AdminProofsView, PROOF_LIBRARY_TAKE } from "@/views/admin/proofs-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Proofs — Hearst Connect",
};

export default async function ProofsPage() {
  // Cap + total fetched together so the view can say "Showing X of Y" instead
  // of presenting a truncated window as the whole registry (Z3: undeclared
  // take:200). The 200-row cap intentionally differs from proof-center/full's
  // 50-row page — both are now DECLARED on screen.
  const [rows, total] = await Promise.all([
    prisma.proof.findMany({
      orderBy: { postedAt: "desc" },
      take: PROOF_LIBRARY_TAKE,
    }),
    prisma.proof.count(),
  ]);

  // Same ECDSA + allowlist verification as proof-center/full
  // (verifyAttestationForRow in src/lib/data/proofs.ts) — the two surfaces
  // previously disagreed: a proof read "published" here while /full showed it
  // "unverified". `null` = the row carries no signature to verify.
  const items = await Promise.all(
    rows.map(async (row) => {
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
        hash: row.hash,
        uri: row.uri,
        postedAt: row.postedAt,
        postedBy: row.postedBy,
        notes: row.notes,
        txHash: row.txHash,
        signatureVerified: verification === null ? null : verification.valid,
      };
    }),
  );

  return <AdminProofsView items={items} total={total} />;
}
