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
      <Card hoverOverlay={false}>
        <PanelStatusAccent
          className="items-stretch border-l-(--ct-status-warning)"
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
      </Card>
    );
  }

  const title =
    notice.kind === "preview"
      ? `${notice.vaultName} is in preview mode.`
      : `Platform signals are ahead of ${notice.vaultName} KPI coverage.`;
  const detail =
    notice.kind === "preview"
      ? "This shell is intentional: methodology defaults are visible so the final dashboard layout stays reviewable before live snapshots land."
      : "Proof, operations, or audit signals are already populated, but vault KPI telemetry is still partial on this page.";

  return (
    <Card hoverOverlay={false}>
      <PanelStatusAccent
        className="items-stretch border-l-(--ct-status-warning)"
        role="note"
      >
        <div className="admin-doc-stack admin-doc-stack--tight">
          <p className="body-sm ct-text-strong m-0">{title}</p>
          <p className="body-xs ct-text-faint m-0">{detail}</p>
          {notice.assumptions.length > 0 ? (
            <PanelStatusSection
              label="Current assumptions"
              aria-label="Dashboard preview assumptions"
            >
              <ul className="admin-doc-stack admin-doc-stack--micro m-0 pl-4 body-xs ct-text-faint">
                {notice.assumptions.map((assumption) => (
                  <li key={assumption}>{assumption}</li>
                ))}
              </ul>
            </PanelStatusSection>
          ) : null}
        </div>
      </PanelStatusAccent>
    </Card>
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
    <div className="admin-doc-shell admin-doc-shell--compact">
      <div>
        <AdminPageHeader
          title="Dashboard"
          eyebrow={`${data.vaultMeta.name} · as of ${formatAdminDate(data.vault.asOf)}`}
          description="Operator view of vault condition, pending actions, and platform health."
          actionsLayout="stack"
          actions={
            <FixtureVaultPills
              activeVaultId={data.vaultMeta.id}
              resolveHref={adminDashboardVaultHref}
            />
          }
        />
      </div>

      {notice ? <DashboardDataNoticeBanner notice={notice} /> : null}

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
