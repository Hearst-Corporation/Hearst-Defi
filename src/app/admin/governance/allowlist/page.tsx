import Link from "next/link";
import { AllowlistBoard } from "@/components/admin/governance/allowlist-board";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { getAllAllowlistEntries } from "@/lib/governance/allowlist";

export const dynamic = "force-dynamic";

export default async function AllowlistPage() {
  const entries = await getAllAllowlistEntries();

  return (
    <AdminPageShell
      titleLead="Governance"
      titleAccent="Allowlist"
      contextLabel="Governance · Allowlist"
      lead={
        <Link
          href="/admin/governance"
          className="ct-metric-caption transition-colors hover:text-[var(--ct-text-strong)]"
          aria-label="Back to governance"
        >
          ← Governance
        </Link>
      }
    >
      <AllowlistBoard entries={entries} />
    </AdminPageShell>
  );
}
