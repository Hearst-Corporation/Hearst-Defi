import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { DashboardAssetsBoard } from "@/components/admin/dashboard";
import { VaultTransition } from "@/components/admin/dashboard/vault-transition";
import { FixtureVaultPills } from "@/components/admin/fixture-vault-pills";
import { resolveDashboardPageInputs } from "@/lib/admin/dashboard-page-view";
import { requireAdmin } from "@/lib/auth/require-admin";
import { loadAdminOverview } from "@/lib/data/admin-overview";
import { loadCockpitPayload } from "@/lib/data/cockpit";
import { loadDashboardData } from "@/lib/data/dashboard";
import { loadRiskFramework } from "@/lib/data/risk-framework";
import { adminDashboardVaultHref } from "@/lib/vaults/dashboard-scope";
import { formatAdminDate } from "@/lib/vaults/product-display";

export const dynamic = "force-dynamic";

interface DashboardPageProps {
  searchParams: Promise<{ vault?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  await requireAdmin();
  const params = await searchParams;

  const [data, risk, overview, cockpit] = await Promise.all([
    loadDashboardData(params.vault),
    loadRiskFramework(),
    loadAdminOverview(),
    loadCockpitPayload(),
  ]);

  const page = resolveDashboardPageInputs(data, risk, overview);

  return (
    <div className="admin-doc-shell admin-doc-shell--compact">
      <div>
        <AdminPageHeader
          title="Dashboard"
          eyebrow={`${data.vaultMeta.name} · as of ${formatAdminDate(data.vault.asOf)}`}
          actionsLayout="stack"
          actions={
            <FixtureVaultPills
              activeVaultId={data.vaultMeta.id}
              resolveHref={adminDashboardVaultHref}
            />
          }
        />
      </div>

      <VaultTransition vaultId={data.vaultMeta.id}>
        <DashboardAssetsBoard
          data={page.data}
          risk={risk}
          proof={overview.proof}
          actions={overview.actions}
          totalActionRequired={overview.totalActionRequired}
          capitalUsdc={page.capitalUsdc}
          capitalProvenance={page.capitalProvenance}
          headlineApy={page.headlineApy}
          hasLiveKpis={page.hasLiveKpis}
          simulated={page.simulated}
          yieldPosture={page.yieldPosture}
          proofFresh={page.proofFresh}
          cockpit={cockpit}
        />
      </VaultTransition>
    </div>
  );
}
