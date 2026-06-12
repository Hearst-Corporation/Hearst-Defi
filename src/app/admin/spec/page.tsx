import { redirect } from "next/navigation";

import { getSpecIndex } from "@/lib/spec";

export default async function SpecIndexPage() {
  const entries = await getSpecIndex();
  const first = entries[0];
  if (first) {
    redirect(`/admin/spec/${first.slug}`);
  }
  return (
    <div className="body-sm ct-text-body">
      No spec files found in <code>/docs/spec/</code>.
    </div>
  );
}
