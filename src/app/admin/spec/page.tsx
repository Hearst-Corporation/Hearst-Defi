import { redirect } from "next/navigation";

import { AdminPageShell } from "@/components/admin/admin-page-shell";
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
    <AdminPageShell
      titleLead="Product"
      titleAccent="Spec"
      contextLabel="Operations"
    >
      {/* EmptySurface seul = exception DS autorisée (pas de carte enveloppante). */}
      <EmptySurface
        variant="widget"
        message="No spec files found."
        detail="Add documents under /docs/spec/ to populate the specification library."
        className="min-h-32"
        ariaLabel="Specification library awaiting documents"
      />
    </AdminPageShell>
  );
}
