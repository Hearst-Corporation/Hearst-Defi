import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { DashboardAssetsBoard } from "@/components/admin/dashboard-assets-board";
import { FixtureVaultPills } from "@/components/admin/fixture-vault-pills";
import { adminDashboardVaultHref } from "@/lib/vaults/dashboard-scope";
import { Card } from "@/components/ui/card";
import {
  ProvenanceBadge,
  type Provenance,
} from "@/components/ui/provenance-badge";
import { requireAdmin } from "@/lib/auth/require-admin";
import { loadAdminOverview } from "@/lib/data/admin-overview";
import { loadCockpitPayload } from "@/lib/data/cockpit";
import { loadDashboardData } from "@/lib/data/dashboard";
import { loadRiskFramework } from "@/lib/data/risk-framework";

export const dynamic = "force-dynamic";

interface DashboardPageProps {
  searchParams: Promise<{ vault?: string }>;
}

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  await requireAdmin();
  const params = await searchParams;
  const requestedVault = params.vault;

  const [data, risk, overview, cockpit] = await Promise.all([
    loadDashboardData(requestedVault),
    loadRiskFramework(),
    loadAdminOverview(),
    loadCockpitPayload(),
  ]);
  const { vaultMeta } = data;
  const vault = data.vault;
  const preview = vaultMeta.livePreview;

  const headlineApy = preview ? vaultMeta.apyTarget : vault.apyRange;
  const apyMid = (headlineApy.low + headlineApy.high) / 2;
  const targetLow = vaultMeta.apyTarget.low;
  const targetHigh = vaultMeta.apyTarget.high;
  const yieldPosture =
    apyMid < targetLow
      ? "below target band"
      : apyMid > targetHigh
        ? "above target band"
        : "within target band";

  const reconciledData = {
    ...data,
    vault: { ...data.vault, riskScore: risk.composite },
  };

  const { custodyConfigured, custodyReservesUsdc, custodyProvenance } = overview.proof;
  const useCustody = custodyConfigured && custodyReservesUsdc > 0;
  const aumNumeric = useCustody ? custodyReservesUsdc : vault.aumUsdc;
  const capitalProvenance: Provenance = preview
    ? "estimated"
    : useCustody
      ? custodyProvenance
      : data.source === "db"
        ? "live"
        : "estimated";

  const proofFresh =
    overview.proof.miningFreshness === "live" && overview.proof.attestationsCount > 0;

  return (
    <div className="relative flex flex-col gap-4">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-20 z-0 overflow-hidden"
      >
        <div className="dash-ambient-orb dash-ambient-orb--primary" />
        <div className="dash-ambient-orb dash-ambient-orb--secondary" />
      </div>

      <div className="relative z-10">
        <AdminPageHeader
          title="Dashboard"
          eyebrow={`${vaultMeta.name} · as of ${dateFmt.format(vault.asOf)}`}
          actions={
            <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
              <FixtureVaultPills
                activeVaultId={vaultMeta.id}
                resolveHref={adminDashboardVaultHref}
              />
              {overview.totalActionRequired > 0 ? (
                <span className="body-xs ct-text-muted tabular">
                  {overview.totalActionRequired} tracked action
                  {overview.totalActionRequired === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>
          }
        />
      </div>

      <DashboardAssetsBoard
        data={reconciledData}
        risk={risk}
        proof={overview.proof}
        actions={overview.actions}
        totalActionRequired={overview.totalActionRequired}
        capitalUsdc={aumNumeric}
        capitalProvenance={capitalProvenance}
        headlineApy={headlineApy}
        yieldPosture={yieldPosture}
        proofFresh={proofFresh}
        cockpit={cockpit}
      />

      {preview ? (
        <Card className="relative z-10 border-[var(--ct-status-warning-border)] ct-status-warning-bg/20">
          <div className="flex items-center gap-3">
            <span className="text-micro font-bold uppercase tracking-widest ct-status-warning">
              Per-vault live snapshot pending
            </span>
            <ProvenanceBadge kind="estimated" />
          </div>
          <p className="mt-3 body-sm ct-text-muted max-w-3xl">
            {vaultMeta.name} live KPIs (capital, risk, yield) land with the Phase 3
            multi-vault schema. Capital and yield below are the {vaultMeta.name}
            methodology preset — the action queue and proof status remain live and
            platform-wide.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
