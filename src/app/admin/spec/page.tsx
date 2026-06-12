import { redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { getSpecIndex } from "@/lib/spec";

export default async function SpecIndexPage() {
  const entries = await getSpecIndex();
  const first = entries[0];
  if (first) {
    redirect(`/admin/spec/${first.slug}`);
  }
  return (
    <div className="admin-doc-shell">
      <AdminPageHeader title="Spec" />
      <p className="body-sm ct-text-body">
        No spec files found in <code>/docs/spec/</code>.
      </p>
    </div>
  );
}
