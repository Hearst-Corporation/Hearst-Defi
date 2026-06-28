import { AdminPageShell } from "@/components/admin/admin-page-shell";
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
    <AdminPageShell
      titleLead="Proof"
      titleAccent="Library"
      contextLabel="Proof & System"
      headerActions={
        <AdminLeafLink
          href="/admin/proof-center/full"
          label="View in Proof Center"
        />
      }
    >
      {/* ANTI-CAGE : chaque preuve est DÉJÀ une carte (BentoPanel) dans
          ProofList. On ne re-wrap PAS la liste dans une AdminSectionCard (ça
          ferait carte-dans-carte). Le titre vit en sur-header léger, les
          row-cards restent une pile à plat dessous. */}
      <section className="flex min-w-0 flex-col gap-4" aria-label="Published evidence">
        {items.length > 0 ? (
          <h2 className="ct-section-title">
            Published evidence{" "}
            <span className="ct-metric-caption tabular-nums">
              ({items.length})
            </span>
          </h2>
        ) : null}
        <ProofList items={items} />
      </section>
    </AdminPageShell>
  );
}
