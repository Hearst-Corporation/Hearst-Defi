import { DashboardAssetsBoard } from "@/components/admin/dashboard-assets-board";
import { DashboardToolbar } from "@/components/admin/dashboard-toolbar";
import { Card } from "@/components/ui/card";
import {
  ProvenanceBadge,
  type Provenance,
} from "@/components/ui/provenance-badge";
import { requireAdmin } from "@/lib/auth/require-admin";
import { loadAdminOverview } from "@/lib/data/admin-overview";
import { loadDashboardData } from "@/lib/data/dashboard";
import { loadRiskFramework } from "@/lib/data/risk-framework";
import { listAllVaults } from "@/lib/vaults/resolver";
import { vaultSlug, vaultLabel } from "@/lib/vaults/slug";

export const dynamic = "force-dynamic";

interface DashboardPageProps {
  searchParams: Promise<{ mode?: string; vault?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  await requireAdmin();
  const params = await searchParams;
  const mode: "simple" | "advanced" =
    params.mode === "advanced" ? "advanced" : "simple";
  const requestedVault = params.vault;

  const [data, risk, allVaultRefs, overview] = await Promise.all([
    loadDashboardData(requestedVault),
    loadRiskFramework(),
    listAllVaults({ status: "live-or-paused" }),
    loadAdminOverview(),
  ]);
  const { vault, vaultMeta } = data;
  const preview = vaultMeta.livePreview;

  const vaultOptions = allVaultRefs.map((ref) => ({
    id: vaultSlug(ref),
    label: vaultLabel(ref),
  }));

  // ── Headline APY (engine preset for preview vaults, live band otherwise) ──
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
  // ── Capital posture (custody reserves when scope pinned, else snapshot AUM) ──
  const { custodyConfigured, custodyReservesUsdc, custodyProvenance } =
    overview.proof;
  const useCustody = custodyConfigured && custodyReservesUsdc > 0;
  const aumNumeric = useCustody ? custodyReservesUsdc : vault.aumUsdc;
  const capitalProvenance: Provenance = preview
    ? "estimated"
    : useCustody
      ? custodyProvenance
      : data.source === "db"
        ? "live"
        : "estimated";
  // ── Proof posture ──
  const proofFresh =
    overview.proof.miningFreshness === "live" &&
    overview.proof.attestationsCount > 0;

  return (
    <div className="flex flex-col gap-12 relative">
      {/* Ambient glow for the dashboard */}
      <div
        aria-hidden="true"
        className="absolute -inset-20 z-0 pointer-events-none overflow-hidden"
      >
        <div className="dash-ambient-orb dash-ambient-orb--primary" />
        <div className="dash-ambient-orb dash-ambient-orb--secondary" />
      </div>

      <div className="relative z-10">
        <DashboardToolbar
          vaultName={vaultMeta.name}
          vaultId={vaultMeta.id}
          vaultIsPreset={preview}
          mode={mode}
          vaultOptions={vaultOptions}
        />
      </div>

      <DashboardAssetsBoard
        data={data}
        risk={risk}
        proof={overview.proof}
        actions={overview.actions}
        totalActionRequired={overview.totalActionRequired}
        capitalUsdc={aumNumeric}
        capitalProvenance={capitalProvenance}
        headlineApy={headlineApy}
        yieldPosture={yieldPosture}
        proofFresh={proofFresh}
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
