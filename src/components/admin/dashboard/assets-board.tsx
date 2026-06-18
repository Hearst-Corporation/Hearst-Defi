import { cn } from "@/lib/cn";
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
import { AdminCockpitPanelHeader, AdminLeafLink } from "./cockpit-panel-header";
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

  const riskProvenance = resolveRiskProvenance(hasLiveKpis, risk, simulated);

  const scopedVaultMetrics = cockpit.vaultMetrics.filter(
    (vault) => vault.vaultId === data.vaultMeta.id,
  );

  return (
    <div className="dashboard-cockpit dashboard-cockpit--fit">

      {/* ── Row 1: KPI strip + charts ── */}
      <div
        className={cn(
          "dashboard-cockpit-row dashboard-cockpit-row--kpi",
          // No live charts → size to content (KPI strip + note) so the row does
          // not stretch into a giant empty void; the freed height goes to ops/lower.
          !hasLiveKpis && "dashboard-cockpit-row--kpi-compact",
        )}
      >
        <div className="dashboard-cockpit-cell">
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

            {hasLiveKpis ? (
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
            ) : (
              <section
                aria-label="Vault analytics awaiting live data"
                className="dashboard-awaiting-analytics px-4 pb-4"
              >
                <p className="body-sm ct-text-muted m-0" role="status">
                  Capital allocation and NAV trends appear once live vault data is
                  connected. KPI strip above shows honest placeholders until then.
                </p>
              </section>
            )}
          </Card>
        </div>
      </div>

      {/* ── Row 2: Ops trio (ActionQueue | LiveMetrics | LiveOps) ── */}
      <div className="dashboard-cockpit-row dashboard-cockpit-row--ops">
        {/* Operator queue panel — single flat graphite surface, header in trail */}
        <div className="dashboard-cockpit-cell">
          <div className="dashboard-cockpit-panel">
            <AdminCockpitPanelHeader
              title="Operator queue"
              trailing={<AdminLeafLink href="/admin/monitoring" />}
            />
            <ActionQueue items={cockpit.actionQueue} />
          </div>
        </div>

        {/* Vault health panel */}
        <div className="dashboard-cockpit-cell">
          <div className="dashboard-cockpit-panel">
            <AdminCockpitPanelHeader
              title="Vault health"
              trailing={<AdminLeafLink href="/admin/monitoring" />}
            />
            <LiveMetrics vaults={scopedVaultMetrics} />
          </div>
        </div>

        {/* Platform status panel */}
        <div className="dashboard-cockpit-cell">
          <div className="dashboard-cockpit-panel">
            <AdminCockpitPanelHeader
              title="Platform status"
              trailing={<AdminLeafLink href="/admin/monitoring" />}
            />
            <LiveOps
              inngestJobs={cockpit.inngestJobs}
              sentryStats={cockpit.sentryStats}
              onChainEvents={cockpit.onChainEvents}
            />
          </div>
        </div>
      </div>

      {/* ── Row 3: Risk posture + Audit trail ── */}
      <div className="dashboard-cockpit-row dashboard-cockpit-row--lower">
        {/* Risk posture panel — single flat graphite surface, no nested Card */}
        <div className="dashboard-cockpit-cell">
          <div className="dashboard-cockpit-panel">
            <AdminCockpitPanelHeader
              title="Risk posture"
              trailing={<AdminLeafLink href="/admin/vaults" />}
              provenance={riskProvenance}
            />
            <DashboardRiskSummaryCard
              data={risk}
              hasLiveKpis={hasLiveKpis}
              simulated={simulated}
            />
          </div>
        </div>

        {/* Audit trail panel — no nested command-panel-card wrapper */}
        <div className="dashboard-cockpit-cell">
          <div className="dashboard-cockpit-panel">
            <AdminCockpitPanelHeader
              title="Audit trail"
              trailing={<AdminLeafLink href="/admin/audit" />}
            />
            <AuditTrailRolling entries={cockpit.auditTrail.slice(0, 5)} />
          </div>
        </div>
      </div>

    </div>
  );
}
