export const dynamic = "force-dynamic";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { MemoShell } from "@/components/memo/memo-shell";
import { VAULTS } from "@/lib/engine/vaults";
import { resolveAdminVaultId } from "@/lib/vaults/dashboard-scope";

interface InvestorMemoPageProps {
  searchParams: Promise<{ vault?: string }>;
}

export default async function InvestorMemoPage({
  searchParams,
}: InvestorMemoPageProps) {
  const params = await searchParams;
  const vaultId = resolveAdminVaultId(params.vault);
  const vault = VAULTS[vaultId];

  return (
    <div className="admin-doc-shell">
      <AdminPageHeader
        titleLead="Investor"
        titleAccent="Memo"
        contextLabel="Operations"
      />

      <MemoShell vaultId={vaultId} vaultName={vault.label} />
    </div>
  );
}
