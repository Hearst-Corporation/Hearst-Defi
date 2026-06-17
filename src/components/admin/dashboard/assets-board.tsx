import { ActionQueue } from "@/components/admin/cockpit/action-queue";
import { AuditTrailRolling } from "@/components/admin/cockpit/audit-trail-rolling";
import { LiveMetrics } from "@/components/admin/cockpit/live-metrics";
import { LiveOps } from "@/components/admin/cockpit/live-ops";
import { Card } from "@/components/ui/card";
import {
  computeNavDelta,
  resolveChartProvenance,
  resolveOperatorQueueProvenance,
  resolveProofProvenance,
  resolveRiskProvenance,
  resolveVaultSignalProvenance,
} from "@/lib/admin/dashboard-board-view";
import { buildDashboardKpiStrip } from "@/lib/admin/dashboard-kpi-strip";
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

/**
 * Layout scope:
 * - Vault-scoped (active pill): KPI strip, allocation orbit, NAV, risk summary.
 * - Platform-wide (not filtered by pill): operator queue, platform status, audit trail.
 *   LiveMetrics is filtered to `data.vaultMeta.id` only.
 */

interface DashboardAssetsBoardProps {
  data: DashboardData;
  risk: RiskFrameworkData;
  proof: AdminProofStatus;
  capitalUsdc: number;
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

  const vaultSignalProvenance = resolveVaultSignalProvenance(
    hasLiveKpis,
    data.vaultMeta.livePreview,
    simulated,
  );
  const stripKpis = buildDashboardKpiStrip({
    headlineApy,
    yieldPosture,
    apyProvenance: vaultSignalProvenance,
    risk,
    riskProvenance: resolveRiskProvenance(hasLiveKpis, risk, simulated),
    miningMarginScore: data.vault.miningMarginScore,
    miningProvenance: vaultSignalProvenance,
    proofFresh,
    proofProvenance: resolveProofProvenance(proofFresh, proof),
    proof,
    operatorQueueCount: cockpit.actionQueue.length,
    operatorQueueProvenance: resolveOperatorQueueProvenance(
      cockpit.actionQueue.length,
      simulated,
      hasLiveKpis,
      data.vaultMeta.livePreview,
    ),
    data,
  });

  const scopedVaultMetrics = cockpit.vaultMetrics.filter(
    (vault) => vault.vaultId === data.vaultMeta.id,
  );

  return (
    <div className="dashboard-command-board admin-doc-stack admin-doc-stack--relaxed">
      {/* ADR-013 exception: dense command-board merged card (strip + separators, not nested glass). */}
      <Card
        aria-label="Vault KPIs and charts"
        hoverOverlay={false}
        contentClassName="flex flex-col"
        className="dashboard-merged-card"
      >
        <section aria-label="Vault KPIs">
          <DashboardKpiStrip kpis={stripKpis} />
        </section>

        <div className="dashboard-command-row-a--hero dashboard-hero-card__analytics">
          <div className="dashboard-hero-card__slot dashboard-hero-card__slot--allocation dashboard-command-slot dashboard-command-slot--allocation">
            <AllocationOrbit
              allocations={allocation}
              capitalUsdc={capitalUsdc}
              allocationTotal={allocationTotal}
              provenance={resolveChartProvenance(simulated, allocationLive)}
            />
          </div>
          <div className="dashboard-hero-card__slot dashboard-hero-card__slot--nav">
            <NavSlot
              navPoints={navPoints}
              lastNav={lastNav}
              navDelta={computeNavDelta(lastNav, firstNav)}
              navProvenance={resolveChartProvenance(simulated, navLive)}
            />
          </div>
        </div>
      </Card>

      <section aria-label="Cockpit operations" className="dashboard-command-row-c dashboard-command-row-c--ops">
        <div className="dashboard-command-panel-card">
          <ActionQueue items={cockpit.actionQueue} />
        </div>
        <div className="dashboard-command-panel-card">
          <LiveMetrics vaults={scopedVaultMetrics} />
        </div>
        <div className="dashboard-command-panel-card">
          <LiveOps
            inngestJobs={cockpit.inngestJobs}
            sentryStats={cockpit.sentryStats}
            onChainEvents={cockpit.onChainEvents}
          />
        </div>
      </section>

      <section aria-label="Risk posture" className="dashboard-risk-zone">
        <DashboardRiskSummaryCard
          data={risk}
          hasLiveKpis={hasLiveKpis}
          simulated={simulated}
        />
      </section>

      <section aria-label="Recent admin activity" className="dashboard-audit-zone">
        <div className="dashboard-command-panel-card">
          <AuditTrailRolling entries={cockpit.auditTrail.slice(0, 5)} />
        </div>
      </section>
    </div>
  );
}
