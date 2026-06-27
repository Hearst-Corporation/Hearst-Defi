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
    <div className="dark flex flex-col rounded-2xl border border-white/10 bg-zinc-900 mb-8">
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        <AdminPageHeader
          titleLead="Proof"
          titleAccent="Library"
          contextLabel="Proof & System"
          actions={
            <AdminLeafLink
              href="/admin/proof-center/full"
              label="View in Proof Center"
            />
          }
        />

        <section className="flex flex-col gap-4" aria-label="Published evidence">
          {items.length > 0 ? (
            <h2 className="text-[13px] font-semibold tracking-tight text-white">
              Published evidence{" "}
              <span className="text-zinc-500 tabular-nums">
                ({items.length})
              </span>
            </h2>
          ) : null}
          <ProofList items={items} />
        </section>
      </div>
    </div>
  );
}
