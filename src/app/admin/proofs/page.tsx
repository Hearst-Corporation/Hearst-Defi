import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ProofList } from "@/components/admin/proof-list";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { canRunDemoProvider } from "@/lib/demo/guard";
import { buildDemoProofRows } from "@/lib/demo/admin/proofs";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Proofs — Hearst Connect",
};

export default async function ProofsPage() {
  await requireAdmin();

  const items = canRunDemoProvider()
    ? buildDemoProofRows()
    : await prisma.proof.findMany({
        orderBy: { postedAt: "desc" },
        take: 200,
      });

  return (
    <div className="admin-doc-shell">
      <AdminPageHeader
        title="Proofs"
        description="Off-chain evidence library for paper attestations and documents. On-chain records stay tracked separately in Proof Center."
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
