import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminLeafLink } from "@/components/admin/dashboard/cockpit-panel-header";
import { ProofList } from "@/components/admin/proof-list";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Proofs — Hearst Connect",
};

export default async function ProofsPage() {
  const items = await prisma.proof.findMany({
    orderBy: { postedAt: "desc" },
    take: 200,
  });

  return (
    <div className="admin-doc-shell">
      <AdminPageHeader
        title="Proofs"
        description="CRUD library to publish and manage off-chain proofs (paper attestations, documents). On-chain records and the investor-facing view stay in Proof Center."
        actions={
          <AdminLeafLink
            href="/admin/proof-center/full"
            label="View in Proof Center"
          />
        }
      />

      <section className="admin-doc-stack admin-doc-stack--actions">
        {items.length > 0 ? (
          <h2 className="h2">Published evidence ({items.length})</h2>
        ) : null}
        <ProofList items={items} />
      </section>
    </div>
  );
}
