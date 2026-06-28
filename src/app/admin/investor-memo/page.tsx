export const dynamic = "force-dynamic";

import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { MemoShell } from "@/components/memo/memo-shell";
import { VAULTS } from "@/lib/engine/vaults";
import { resolveFixtureVaultId } from "@/lib/vaults/dashboard-scope";

interface InvestorMemoPageProps {
  searchParams: Promise<{ vault?: string }>;
}

export default async function InvestorMemoPage({
  searchParams,
}: InvestorMemoPageProps) {
  const params = await searchParams;
  const vaultId = resolveFixtureVaultId(params.vault);
  const vault = VAULTS[vaultId];

  return (
    <AdminPageShell
      titleLead="Investor"
      titleAccent="Memo"
      contextLabel="Operations"
    >
      {/* MemoShell owns its toolbar + per-section Cards (its own surfaces).
          The page shell only provides the canon box/header — no extra card
          wrapper here, which would nest a card inside a card (anti-cage). */}
      <MemoShell vaultId={vaultId} vaultName={vault.label} />
    </AdminPageShell>
  );
}
