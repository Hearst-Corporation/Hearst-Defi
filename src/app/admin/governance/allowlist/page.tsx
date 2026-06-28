import Link from "next/link";

import { AllowlistBoard } from "@/components/admin/governance/allowlist-board";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { getAllAllowlistEntries } from "@/lib/governance/allowlist";

export const dynamic = "force-dynamic";

export default async function AllowlistPage() {
  const entries = await getAllAllowlistEntries();

  return (
    <div className="dark flex flex-col rounded-2xl border border-white/10 bg-surface-page mb-8">
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        <AdminPageHeader
          titleLead="Governance"
          titleAccent="Allowlist"
          contextLabel="Governance · Allowlist"
          lead={
            <Link
              href="/admin/governance"
              className="text-[#A7FB90] transition-colors hover:text-[#A7FB90]/80"
              aria-label="Back to governance"
            >
              ← Governance
            </Link>
          }
        />
        <AllowlistBoard entries={entries} />
      </div>
    </div>
  );
}
