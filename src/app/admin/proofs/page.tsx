import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminLeafLink } from "@/components/admin/dashboard/cockpit-panel-header";
import { ProofList } from "@/components/admin/proof-list";
import { prisma } from "@/lib/db";
import { resolveAdminDemoMode } from "@/lib/demo/admin-mode";
import { buildDemoProofRows } from "@/lib/demo/admin/proofs";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Proofs — Hearst Connect",
};

export default async function ProofsPage() {
  const demoMode = await resolveAdminDemoMode();
  const items = demoMode.providerEnabled
    ? buildDemoProofRows()
    : await prisma.proof.findMany({
        orderBy: { postedAt: "desc" },
        take: 200,
      });

  return (
    <div className="admin-doc-shell">
      <AdminPageHeader
        title="Proofs"
        description="Bibliothèque CRUD pour publier et gérer les preuves off-chain (attestations papier, documents). Les enregistrements on-chain et la lecture investisseur restent dans Proof Center."
        actions={
          <AdminLeafLink
            href="/admin/proof-center/full"
            label="Voir dans Proof Center"
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
