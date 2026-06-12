import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ProofList } from "@/components/admin/proof-list";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ProofsPage() {
  await requireAdmin();

  const items = await prisma.proof.findMany({
    orderBy: { postedAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Off-chain proofs"
        description="Paper attestations ingested off-chain. Live on-chain proofs are in Proof Center."
      />

      {items.length === 0 ? (
        <ProofList items={items} />
      ) : (
        <section className="space-y-3">
          <h2 className="h2">Published proofs ({items.length})</h2>
          <ProofList items={items} />
        </section>
      )}

      <p className="body-sm ct-text-muted">
        New attestations are ingested via the{" "}
        <code className="mono ct-text-body">ingestProof()</code> Server Action.
        On-chain submission UI is available in Phase 2.
      </p>
    </div>
  );
}
