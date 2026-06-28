import { redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { EmptySurface } from "@/components/ui/empty-surface";
import { getSpecIndex } from "@/lib/spec";

export const dynamic = "force-dynamic";

export default async function SpecIndexPage() {
  const entries = await getSpecIndex();
  const first = entries[0];
  if (first) {
    redirect(`/admin/spec/${first.slug}`);
  }
  return (
    <div className="dark flex flex-col rounded-2xl border border-white/10 bg-surface-page mb-8">
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        <AdminPageHeader
          titleLead="Product"
          titleAccent="Spec"
          contextLabel="Operations"
        />
        <EmptySurface
          variant="widget"
          message="No spec files found."
          detail="Add documents under /docs/spec/ to populate the specification library."
          className="min-h-32"
          ariaLabel="Specification library awaiting documents"
        />
      </div>
    </div>
  );
}
