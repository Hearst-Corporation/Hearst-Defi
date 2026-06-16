import { ActionQueue } from "@/components/admin/cockpit/action-queue";
import { AuditTrailRolling } from "@/components/admin/cockpit/audit-trail-rolling";
import { LiveMetrics } from "@/components/admin/cockpit/live-metrics";
import { LiveOps } from "@/components/admin/cockpit/live-ops";
import { Card } from "@/components/ui/card";
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

  return (
    <div className="dashboard-command-board relative z-10 admin-doc-stack admin-doc-stack--relaxed">
      <Card
        aria-label="Vault KPIs and charts"
        hoverOverlay={false}
        className="dashboard-merged-card dashboard-hero-card"
        contentClassName="dashboard-hero-card__content"
      >
        <section aria-label="Vault KPIs" className="dashboard-hero-card__kpis">
          <DashboardKpiStrip kpis={heroKpis} />
        </section>

        <div className="dashboard-command-row-a dashboard-command-row-a--hero">
          <div className="dashboard-hero-card__slot dashboard-hero-card__slot--allocation dashboard-command-slot dashboard-command-slot--allocation">
            <AllocationOrbit
              allocations={allocation}
              capitalUsdc={capitalUsdc}
              allocationTotal={allocationTotal}
              provenance={simulated ? "simulated" : allocationLive ? "live" : "manual"}
            />
          </div>
          <div className="dashboard-hero-card__slot dashboard-hero-card__slot--nav">
            <NavSlot
              navPoints={navPoints}
              lastNav={lastNav}
              navDelta={computeNavDelta(lastNav, firstNav)}
              navProvenance={navLive ? "live" : "estimated"}
            />
          </div>
        </div>
      </Card>

      <section aria-label="Cockpit operations" className="dashboard-command-row-c ct-card--etched ct-glass-panel dashboard-merged-card gap-0!">
        <div className="p-4 lg:p-5">
          <ActionQueue items={cockpit.actionQueue} />
        </div>
        <div className="p-4 lg:p-5 border-t lg:border-t-0 lg:border-l border-(--ct-border-soft)">
          <LiveMetrics vaults={cockpit.vaultMetrics} />
        </div>
        <div className="p-4 lg:p-5 border-t lg:border-t-0 lg:border-l border-(--ct-border-soft)">
          <LiveOps
            inngestJobs={cockpit.inngestJobs}
            sentryStats={cockpit.sentryStats}
            onChainEvents={cockpit.onChainEvents}
          />
        </div>
      </section>

      <section aria-label="Recent admin activity">
        <AuditTrailRolling entries={cockpit.auditTrail} />
      </section>
    </div>
  );
}
