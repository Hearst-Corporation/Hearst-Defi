import Link from "next/link";

import { AllowlistBoard } from "@/components/admin/governance/allowlist-board";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getAllAllowlistEntries } from "@/lib/governance/allowlist";

export const dynamic = "force-dynamic";

export default async function AllowlistPage() {
  await requireAdmin();
  const entries = await getAllAllowlistEntries();

  return (
    <div className="admin-doc-shell">
      <AdminPageHeader
        title="Allowlist"
        lead={
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/governance">← Governance</Link>
          </Button>
        }
      />
      <AllowlistBoard entries={entries} />
    </div>
  );
}
