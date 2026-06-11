import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { DashboardAssetsBoard } from "@/components/admin/dashboard-assets-board";
import { Card } from "@/components/ui/card";
import {
  ProvenanceBadge,
  type Provenance,
} from "@/components/ui/provenance-badge";
import { requireAdmin } from "@/lib/auth/require-admin";
import { loadAdminOverview } from "@/lib/data/admin-overview";
import { loadDashboardData } from "@/lib/data/dashboard";
import { loadRiskFramework } from "@/lib/data/risk-framework";

export const dynamic = "force-dynamic";

interface DashboardPageProps {
  searchParams: Promise<{ vault?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  await requireAdmin();
  const params = await searchParams;
  const requestedVault = params.vault;

  const [data, risk, overview] = await Promise.all([
    loadDashboardData(requestedVault),
    loadRiskFramework(),
    loadAdminOverview(),
  ]);
  const { vaultMeta } = data;
  const vault = data.vault;
  const preview = vaultMeta.livePreview;

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
  // ── Risk score — single source of truth ──────────────────────────────────────
  // `loadRiskFramework()` computes the composite from live engine inputs (or
  // engine fallback inputs when the DB is empty). `loadDashboardData()` falls
  // back to METHODOLOGY_ANCHORS.RISK_SCORE (a stale constant = 38) when no
  // VaultSnapshot exists, which diverges from the engine computation (~47).
  // Reconcile here: replace vault.riskScore with risk.composite so every
  // downstream component reading data.vault.riskScore gets the same value that
  // the "Risk score" stat card displays from risk.composite.
  const reconciledData = {
    ...data,
    vault: { ...data.vault, riskScore: risk.composite },
  };

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
        <AdminPageHeader title="Dashboard" />
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
