import {
  AdminPageShell,
  AdminSectionCard,
} from "@/components/admin/admin-page-shell";
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
      {/* Canon start pattern — the proof library lives in a welded
          AdminSectionCard, like /customers. The published count rides in the
          card sub-header trailing slot; the proof row-cards stack in the body. */}
      <AdminSectionCard
        title="Published evidence"
        subtitle="Proof items released to the public Proof Center, most recent first."
        headerTrailing={
          items.length > 0 ? (
            <span className="ct-metric-caption tabular-nums">
              ({items.length})
            </span>
          ) : undefined
        }
        ariaLabel="Published evidence"
      >
        <div className="flex min-w-0 flex-col gap-4 p-5">
          <ProofList items={items} />
        </div>
      </AdminSectionCard>
    </AdminPageShell>
  );
}
