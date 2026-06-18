import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { DashboardAssetsBoard } from "@/components/admin/dashboard";
import { FixtureVaultPills } from "@/components/admin/fixture-vault-pills";
import { resolveDashboardPageInputs } from "@/lib/admin/dashboard-page-view";
import { requireAdmin } from "@/lib/auth/require-admin";
import { loadAdminOverview } from "@/lib/data/admin-overview";
import { loadCockpitPayload } from "@/lib/data/cockpit";
import { loadDashboardData } from "@/lib/data/dashboard";
import { loadRiskFramework } from "@/lib/data/risk-framework";
import { adminDashboardVaultHref } from "@/lib/vaults/dashboard-scope";

/** Soft TTL — cross-request caches in loaders revalidate silently in the background. */
export const revalidate = 30;

interface DashboardPageProps {
  searchParams: Promise<{ vault?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  await requireAdmin();
  const params = await searchParams;

  const [data, risk, overview, cockpit] = await Promise.all([
    loadDashboardData(params.vault),
    loadRiskFramework(params.vault),
    loadAdminOverview(),
    loadCockpitPayload(),
  ]);

  const page = resolveDashboardPageInputs(data, risk, overview);

  return (
    <div className="admin-doc-shell admin-doc-shell--compact admin-doc-stack admin-doc-stack--dense">
      <AdminPageHeader
        title="Dashboard"
        className="dashboard-page-header"
        actionsLayout="stack"
        actions={
          <FixtureVaultPills
            activeVaultId={data.vaultMeta.id}
            resolveHref={adminDashboardVaultHref}
          />
        }
      />

      <DashboardAssetsBoard
        data={page.data}
        risk={risk}
        proof={overview.proof}
        capitalUsdc={page.capitalUsdc}
        headlineApy={page.headlineApy}
        hasLiveKpis={page.hasLiveKpis}
        simulated={page.simulated}
        yieldPosture={page.yieldPosture}
        proofFresh={page.proofFresh}
        cockpit={cockpit}
      />
    </div>
  );
}
