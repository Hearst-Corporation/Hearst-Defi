import Link from "next/link";

import { AllowlistBoard } from "@/components/admin/governance/allowlist-board";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { getAllAllowlistEntries } from "@/lib/governance/allowlist";

export const dynamic = "force-dynamic";

export default async function AllowlistPage() {
  const entries = await getAllAllowlistEntries();

  return (
    <div className="admin-doc-shell">
      <AdminPageHeader
        titleLead="Allowlist"
        contextLabel="Governance · Allowlist"
        lead={
          <Link
            href="/admin/governance"
            className="body-sm ct-link-accent"
            aria-label="Back to governance"
          >
            ← Governance
          </Link>
        }
      />
      <section className="admin-doc-stack admin-doc-stack--actions" aria-label="Allowlist">
        <AllowlistBoard entries={entries} />
      </section>
    </div>
  );
}
