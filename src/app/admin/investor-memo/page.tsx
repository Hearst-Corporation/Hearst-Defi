export const dynamic = "force-dynamic";

import {
  AdminPageShell,
  AdminSectionCard,
} from "@/components/admin/admin-page-shell";
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
      {/* Canon start pattern (#051): the first content block reads as a welded
          AdminSectionCard (outer frame + section header). MemoShell owns its
          toolbar + per-section Cards INSIDE this frame — so we use a TITLE-ONLY
          card to provide the canon frame without nesting a second padded border
          around its surfaces (anti cage-in-cage). */}
      <AdminSectionCard
        ariaLabel="Investor memo"
        title="Investor memo"
        subtitle="Compose and review the investor-facing memo sections for this vault."
      >
        <div className="p-5">
          <MemoShell vaultId={vaultId} vaultName={vault.label} />
        </div>
      </AdminSectionCard>
    </AdminPageShell>
  );
}
