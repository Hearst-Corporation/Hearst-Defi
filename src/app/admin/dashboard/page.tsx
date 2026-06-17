import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { DashboardAssetsBoard } from "@/components/admin/dashboard";
import { VaultTransition } from "@/components/admin/dashboard/vault-transition";
import { FixtureVaultPills } from "@/components/admin/fixture-vault-pills";
import { Card } from "@/components/ui/card";
import {
  PanelStatusAccent,
  PanelStatusSection,
} from "@/components/ui/panel-status";
import {
  resolveDashboardDataNotice,
  resolveDashboardPageInputs,
  type DashboardDataNotice,
} from "@/lib/admin/dashboard-page-view";
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

function DashboardDataNoticeBanner({
  notice,
}: {
  notice: DashboardDataNotice;
}) {
  if (notice.kind === "staging") {
    return (
      <PanelStatusAccent
        className="items-stretch border-l-(--ct-status-warning) mb-4"
        role="note"
      >
        <div className="admin-doc-stack admin-doc-stack--tight">
          <p className="body-sm ct-text-strong m-0">
            Dashboard is showing seeded vault KPIs.
          </p>
          <p className="body-xs ct-text-faint m-0">
            Source: {notice.snapshotSource}. Platform activity may be present,
            but vault-level numbers on this page are not yet live.
          </p>
        </div>
      </PanelStatusAccent>
    );
  }

  const title =
    notice.kind === "preview"
      ? `${notice.vaultName} is in preview mode.`
      : `Platform signals are ahead of ${notice.vaultName} KPI coverage.`;
  const detail =
    notice.kind === "preview"
      ? "Methodology defaults are visible so the final dashboard layout stays reviewable before live snapshots land."
      : "Proof, operations, or audit signals are already populated, but vault KPI telemetry is still partial on this page.";

  return (
    <PanelStatusAccent
      className="items-stretch border-l-(--ct-status-warning) mb-4"
      role="note"
    >
      <div className="admin-doc-stack admin-doc-stack--tight">
        <p className="body-sm ct-text-strong m-0">{title}</p>
        <p className="body-xs ct-text-faint m-0">{detail}</p>
      </div>
    </PanelStatusAccent>
  );
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
  const notice = resolveDashboardDataNotice(
    data,
    overview,
    cockpit,
    page.hasLiveKpis,
    page.preview,
  );

  return (
    <div className="admin-doc-shell admin-doc-shell--compact admin-doc-stack admin-doc-stack--relaxed">
      <AdminPageHeader
        title="Dashboard"
        eyebrow={`${data.vaultMeta.name} · as of ${formatAdminDate(data.vault.asOf)}`}
        description="Operator view of vault condition, pending actions, and platform health."
        className="dashboard-page-header"
        actionsLayout="stack"
        actions={
          <FixtureVaultPills
            activeVaultId={data.vaultMeta.id}
            resolveHref={adminDashboardVaultHref}
          />
        }
      />

      {notice ? (
        <DashboardDataNoticeBanner notice={notice} />
      ) : null}

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
