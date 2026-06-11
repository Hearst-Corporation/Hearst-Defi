import { prisma } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ProofList } from "@/components/admin/proof-list";

export const dynamic = "force-dynamic";

export default async function ProofsPage() {
  const items = await prisma.proof.findMany({
    orderBy: { postedAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Proofs"
      />

      <section className="space-y-3">
        <h3 className="h3">Attestations ({items.length})</h3>
        <ProofList items={items} />
      </section>

      <p className="body-sm ct-text-muted">
        New attestations are ingested via the{" "}
        <code className="mono ct-text-body">ingestProof()</code>{" "}
        Server Action. On-chain submission UI is available in Phase 2.
      </p>
    </div>
  );
}
