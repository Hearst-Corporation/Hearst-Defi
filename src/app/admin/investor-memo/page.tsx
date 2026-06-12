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
      <AdminPageHeader title="Investor Memo" />

      <MemoShell vaultId={vaultId} vaultName={vault.label} />

      <footer className="border-t ct-border-soft pt-6">
        <p className="body-xs">
          Generated on demand from live vault data. Every export is logged with
          its methodology version. Projections are conditional on the stated
          assumptions and not guaranteed. Past performance does not predict
          future results.
        </p>
      </footer>
    </div>
  );
}
