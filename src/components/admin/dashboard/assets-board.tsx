import { ActionQueue } from "@/components/admin/cockpit/action-queue";
import { AuditTrailRolling } from "@/components/admin/cockpit/audit-trail-rolling";
import { LiveMetrics } from "@/components/admin/cockpit/live-metrics";
import { LiveOps } from "@/components/admin/cockpit/live-ops";
import { RiskFrameworkSection } from "@/components/dashboard/risk-framework";
import { Card } from "@/components/ui/card";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import type { Provenance } from "@/components/ui/provenance-badge";
import {
  computeNavDelta,
  resolveApyProvenance,
  resolveProofProvenance,
  resolveRiskProvenance,
} from "@/lib/admin/dashboard-board-view";
import { buildDashboardHeroKpis } from "@/lib/admin/dashboard-hero-kpis";
import {
  resolveAllocationChartLive,
  resolveNavChartLive,
} from "@/lib/admin/dashboard-vault-signals";
import type { CockpitPayload } from "@/lib/data/cockpit";
import type { AdminActionItem, AdminProofStatus } from "@/lib/data/admin-overview";
import type { DashboardData } from "@/lib/data/dashboard";
import type { RiskFrameworkData } from "@/lib/data/risk-framework";

import { AllocationOrbit } from "./allocation-orbit";
import { DashboardKpiStrip } from "./kpi-strip";
import { NavSlot } from "./nav-slot";
import { VaultVitalsRing } from "./vault-vitals-ring";

export interface DashboardAssetsBoardProps {
  data: DashboardData;
  risk: RiskFrameworkData;
  proof: AdminProofStatus;
  actions: AdminActionItem[];
  totalActionRequired: number;
  capitalUsdc: number;
  capitalProvenance: Provenance;
  headlineApy: { low: number; high: number } | null;
  yieldPosture: string;
  hasLiveKpis: boolean;
  /** True when the payload comes from the demo builder — badges read "simulated". */
  simulated?: boolean;
  proofFresh: boolean;
  cockpit: CockpitPayload;
}

export function DashboardAssetsBoard({
  data,
  risk,
  proof,
  actions: _actions,
  totalActionRequired,
  capitalUsdc,
  capitalProvenance,
  headlineApy,
  yieldPosture,
  hasLiveKpis,
  simulated,
  proofFresh,
  cockpit,
}: DashboardAssetsBoardProps) {
  const allocation = data.allocations;
  const allocationTotal = allocation.reduce((sum, item) => sum + item.pct, 0);
  const allocationLive = resolveAllocationChartLive(hasLiveKpis, data, capitalUsdc);

  const navPoints = data.timeseries.nav30d;
  const navLive = resolveNavChartLive(hasLiveKpis, data.timeseries);
  const lastNav = navLive ? (navPoints.at(-1)?.aum_usdc ?? 0) : null;
  const firstNav = navLive ? (navPoints[0]?.aum_usdc ?? 0) : null;

  const riskProvenance = resolveRiskProvenance(hasLiveKpis, risk, simulated);
  const apyProvenance = resolveApyProvenance(hasLiveKpis, data.vaultMeta.livePreview, simulated);
  const miningProvenance: Provenance = simulated ? "simulated" : hasLiveKpis ? "live" : "manual";
  const proofProvenance = resolveProofProvenance(proofFresh, proof);

  const heroKpis = buildDashboardHeroKpis({
    capitalUsdc,
    capitalProvenance,
    vaultName: data.vaultMeta.name,
    headlineApy,
    yieldPosture,
    apyProvenance,
    risk,
    riskProvenance,
    miningMarginScore: data.vault.miningMarginScore,
    miningProvenance,
    hasLiveKpis,
    simulated: simulated ?? false,
    proofFresh,
    proofProvenance,
    proof,
    totalActionRequired,
    data,
  });

  // Capital and Risk are both carried by the VaultVitalsRing (Capital at core,
  // Risk composite as caption) — filter them out of the support strip to avoid
  // showing each exactly once.
  const supportKpis = heroKpis.filter(
    (k) => k.label !== "Capital" && k.label !== "Risk",
  );

  return (
    <div className="admin-doc-stack admin-doc-stack--relaxed">
      {/* ── Hero card: KPI strip + 2-col vitals grid + allocation/nav banding ── */}
      <Card
        aria-label="Vault KPIs and charts"
        hoverOverlay={false}
        contentClassName="flex flex-col"
        className="dashboard-merged-card"
      >
        {/* KPI strip — APY, Mining, Proof, Admin queues (Capital + Risk live in the ring) */}
        <section aria-label="Vault KPIs">
          <DashboardKpiStrip kpis={supportKpis} />
        </section>

        {/* 2-col hero grid: VaultVitalsRing (left) + support KPIs (right) */}
        <div className="dashboard-vitals-hero">
          {/* Left: health ring — Capital at core, Composite risk as caption */}
          <div className="dashboard-vitals-hero__ring">
            <VaultVitalsRing
              composite={risk.composite}
              band={risk.band}
              bandLabel={risk.bandLabel}
              capitalUsdc={capitalUsdc}
              provenance={capitalProvenance}
              hasLiveKpis={hasLiveKpis}
            />
          </div>

          {/* Right: support stat-rows (APY, Mining, Proof, Admin queues) */}
          <div className="dashboard-vitals-hero__stats border-t md:border-t-0 md:border-l border-(--ct-border-soft)">
            {supportKpis.map((kpi) => (
              <div
                key={kpi.label}
                className="dashboard-vitals-stat-row border-b border-(--ct-border-soft) last:border-b-0"
              >
                <span className="stat-label uppercase tracking-wide text-(--ct-text-faint) text-[length:var(--ct-text-xs)]">
                  {kpi.label}
                </span>
                <span
                  className={[
                    "tabular font-[var(--ct-font-semibold)] text-[length:var(--ct-text-base)]",
                    kpi.alert
                      ? "ct-status-danger"
                      : kpi.accent
                        ? "ct-status-success"
                        : "ct-text-strong",
                  ].join(" ")}
                >
                  {kpi.value}
                </span>
                <span className="body-xs ct-text-faint truncate">{kpi.sublabel}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom band: Allocation orbit + NAV slot */}
        <div className="dashboard-command-row-a dashboard-command-row-a--hero dashboard-hero-card__analytics">
          <div className="dashboard-hero-card__slot dashboard-hero-card__slot--allocation dashboard-command-slot dashboard-command-slot--allocation">
            <AllocationOrbit
              allocations={allocation}
              capitalUsdc={capitalUsdc}
              allocationTotal={allocationTotal}
              provenance={simulated ? "simulated" : allocationLive ? "live" : "manual"}
            />
          </div>
          <div className="dashboard-hero-card__slot dashboard-hero-card__slot--nav border-t md:border-t-0 md:border-l border-(--ct-border-soft)">
            <NavSlot
              navPoints={navPoints}
              lastNav={lastNav}
              navDelta={computeNavDelta(lastNav, firstNav)}
              navProvenance={navLive ? "live" : "estimated"}
            />
          </div>
        </div>
      </Card>

      {/* ── Ops: 3 cards ── */}
      <section aria-label="Cockpit operations" className="dashboard-command-row-c dashboard-command-row-c--ops">
        <div className="dashboard-command-panel-card">
          <ActionQueue items={cockpit.actionQueue} />
        </div>
        <div className="dashboard-command-panel-card">
          <LiveMetrics vaults={cockpit.vaultMetrics} />
        </div>
        <div className="dashboard-command-panel-card">
          <LiveOps
            inngestJobs={cockpit.inngestJobs}
            sentryStats={cockpit.sentryStats}
            onChainEvents={cockpit.onChainEvents}
          />
        </div>
      </section>

      {/* ── Risk framework full-width waterfall ── */}
      <section aria-label="Risk framework" className="dashboard-risk-zone">
        <ErrorBoundary>
          <RiskFrameworkSection data={risk} view="waterfall" showComposite={false} />
        </ErrorBoundary>
      </section>

      {/* ── Audit trail ── */}
      <section aria-label="Recent admin activity" className="dashboard-audit-zone">
        <div className="dashboard-command-panel-card">
          <AuditTrailRolling entries={cockpit.auditTrail.slice(0, 5)} />
        </div>
      </section>
    </div>
  );
}
