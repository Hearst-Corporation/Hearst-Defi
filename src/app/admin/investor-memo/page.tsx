export const dynamic = "force-dynamic";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { MemoShell } from "@/components/memo/memo-shell";
import { VAULTS, VAULT_YIELD } from "@/lib/engine/vaults";
import type { VaultId } from "@/lib/engine/types";

interface InvestorMemoPageProps {
  searchParams: Promise<{ vault?: string }>;
}

function resolveVaultId(raw: string | undefined): VaultId {
  if (raw === "yield" || raw === "defensive" || raw === "btc-plus") return raw;
  return VAULT_YIELD.id;
}

export default async function InvestorMemoPage({
  searchParams,
}: InvestorMemoPageProps) {
  const params = await searchParams;
  const vaultId = resolveVaultId(params.vault);
  const vault = VAULTS[vaultId];

  return (
    <div className="admin-doc-shell">
      <AdminPageHeader
        title="Investor Memo"
        description="Generate a structured investor-facing memo from the selected vault assumptions and current operating posture."
      />

      <MemoShell vaultId={vaultId} vaultName={vault.label} />
    </div>
  );
}
