import { ActionQueue } from "@/components/admin/cockpit/action-queue";
import { AuditTrailRolling } from "@/components/admin/cockpit/audit-trail-rolling";
import { LiveMetrics } from "@/components/admin/cockpit/live-metrics";
import { LiveOps } from "@/components/admin/cockpit/live-ops";
import { Card } from "@/components/ui/card";
import type { Provenance } from "@/components/ui/provenance-badge";
import {
  computeNavDelta,
  resolveAllocationProvenance,
  resolveApyProvenance,
  resolveMiningProvenance,
  resolveNavProvenance,
  resolveOperatorQueueCount,
  resolveProofProvenance,
  resolveRiskProvenance,
} from "@/lib/admin/dashboard-board-view";
import { buildDashboardHeroKpis } from "@/lib/admin/dashboard-hero-kpis";
import {
  resolveAllocationChartLive,
  resolveNavChartLive,
} from "@/lib/admin/dashboard-vault-signals";
import type { CockpitPayload } from "@/lib/data/cockpit";
import type { AdminProofStatus } from "@/lib/data/admin-overview";
import type { DashboardData } from "@/lib/data/dashboard";
import type { RiskFrameworkData } from "@/lib/data/risk-framework";

import { AllocationOrbit } from "./allocation-orbit";
import { DashboardKpiStrip } from "./kpi-strip";
import { NavSlot } from "./nav-slot";
import { DashboardRiskSummaryCard } from "./risk-summary-card";

interface DashboardAssetsBoardProps {
  data: DashboardData;
  risk: RiskFrameworkData;
  proof: AdminProofStatus;
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
  const miningProvenance = resolveMiningProvenance(
    hasLiveKpis,
    data.vaultMeta.livePreview,
    simulated,
  );
  const proofProvenance = resolveProofProvenance(proofFresh, proof);
  const operatorQueueCount = resolveOperatorQueueCount(cockpit.actionQueue);

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
    operatorQueueCount,
    data,
  });

  // Capital already lives in the allocation donut core; keep Risk in the strip
  // so the hero avoids stacking two circular widgets above the analytics row.
  const supportKpis = heroKpis.filter((k) => k.label !== "Capital");

  return (
    <div className="dashboard-command-board admin-doc-stack admin-doc-stack--relaxed">
      {/* ADR-013 exception: dense command-board merged card (strip + separators, not nested glass). */}
      <Card
        aria-label="Vault KPIs and charts"
        hoverOverlay={false}
        contentClassName="flex flex-col"
        className="dashboard-merged-card"
      >
        {/* KPI strip — keep risk visible here; capital stays in the allocation donut core. */}
        <section aria-label="Vault KPIs">
          <DashboardKpiStrip kpis={supportKpis} />
        </section>

        {/* Bottom band: Allocation orbit + NAV slot */}
        <div className="dashboard-command-row-a dashboard-command-row-a--hero dashboard-hero-card__analytics">
          <div className="dashboard-hero-card__slot dashboard-hero-card__slot--allocation dashboard-command-slot dashboard-command-slot--allocation">
            <AllocationOrbit
              allocations={allocation}
              capitalUsdc={capitalUsdc}
              allocationTotal={allocationTotal}
              provenance={resolveAllocationProvenance(simulated, allocationLive)}
            />
          </div>
          <div className="dashboard-hero-card__slot dashboard-hero-card__slot--nav border-t md:border-t-0 md:border-l border-(--ct-border-soft)">
            <NavSlot
              navPoints={navPoints}
              lastNav={lastNav}
              navDelta={computeNavDelta(lastNav, firstNav)}
              navProvenance={resolveNavProvenance(simulated, navLive)}
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

      {/* ── Risk posture summary — compact dashboard-specific replacement for the broken waterfall ── */}
      <section aria-label="Risk posture" className="dashboard-risk-zone">
        <DashboardRiskSummaryCard
          data={risk}
          hasLiveKpis={hasLiveKpis}
          simulated={simulated}
        />
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
