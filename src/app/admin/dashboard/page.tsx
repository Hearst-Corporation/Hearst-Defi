import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { DashboardAssetsBoard } from "@/components/admin/dashboard-assets-board";
import { FixtureVaultPills } from "@/components/admin/fixture-vault-pills";
import { Card } from "@/components/ui/card";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
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
            <>
              <FixtureVaultPills
                activeVaultId={data.vaultMeta.id}
                resolveHref={adminDashboardVaultHref}
              />
              {overview.totalActionRequired > 0 ? (
                <span className="body-xs ct-text-muted tabular">
                  {overview.totalActionRequired} tracked action
                  {overview.totalActionRequired === 1 ? "" : "s"}
                </span>
              ) : null}
            </>
          }
        />
      </div>

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
        yieldPosture={page.yieldPosture}
        proofFresh={page.proofFresh}
        cockpit={cockpit}
      />

      {page.preview ? (
        <Card className="relative z-10 border-(--ct-status-warning-border) ct-status-warning-bg/20">
          <div className="admin-doc-inline-row admin-doc-inline-row--actions">
            <span className="stat-label ct-status-warning">
              Per-vault live snapshot pending
            </span>
            <ProvenanceBadge kind="estimated" />
          </div>
          <p className="mt-3 body-sm ct-text-muted max-w-3xl">
            {data.vaultMeta.name} live KPIs (capital, risk, yield) land with the Phase 3
            multi-vault schema. Capital and yield below are the {data.vaultMeta.name}
            methodology preset — the action queue and proof status remain live and
            platform-wide.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
