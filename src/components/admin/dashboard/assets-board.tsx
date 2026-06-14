import { ActionQueue } from "@/components/admin/cockpit/action-queue";
import { AuditTrailRolling } from "@/components/admin/cockpit/audit-trail-rolling";
import { LiveMetrics } from "@/components/admin/cockpit/live-metrics";
import { LiveOps } from "@/components/admin/cockpit/live-ops";
import { DashboardKpiStrip } from "@/components/admin/dashboard-kpi-strip";
import type { Provenance } from "@/components/ui/provenance-badge";
import {
  computeNavDelta,
  isProofSlotEmpty,
  resolveApyProvenance,
  resolveProofProvenance,
  resolveRiskProvenance,
} from "@/lib/admin/dashboard-board-view";
import { buildDashboardHeroKpis } from "@/lib/admin/dashboard-hero-kpis";
import type { CockpitPayload } from "@/lib/data/cockpit";
import type { AdminActionItem, AdminProofStatus } from "@/lib/data/admin-overview";
import type { DashboardData } from "@/lib/data/dashboard";
import type { RiskFrameworkData } from "@/lib/data/risk-framework";

import { AllocationOrbit } from "./allocation-orbit";
import { CapitalStack } from "./capital-stack";
import { DashboardCommandCell } from "./command-cell";
import { DistributionPanel } from "./distribution-panel";
import { NavSlot } from "./nav-slot";
import { OperatorShortcuts } from "./operator-shortcuts";
import { ProofPulse } from "./proof-pulse";
import { RiskLens } from "./risk-lens";

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
  proofFresh: boolean;
  cockpit: CockpitPayload;
}

export function DashboardAssetsBoard({
  data,
  risk,
  proof,
  actions,
  totalActionRequired,
  capitalUsdc,
  capitalProvenance,
  headlineApy,
  yieldPosture,
  hasLiveKpis,
  proofFresh,
  cockpit,
}: DashboardAssetsBoardProps) {
  const allocation = data.allocations;
  const allocationTotal = allocation.reduce((sum, item) => sum + item.pct, 0);
  const allocationLive =
    data.source === "db" && capitalUsdc > 0 && allocation.length > 0;

  const navPoints = data.timeseries.nav30d;
  const navLive = data.timeseries.source === "db" && navPoints.length >= 2;
  const lastNav = navLive ? (navPoints.at(-1)?.aum_usdc ?? 0) : null;
  const firstNav = navLive ? (navPoints[0]?.aum_usdc ?? 0) : null;

  const riskProvenance = resolveRiskProvenance(hasLiveKpis, risk);
  const apyProvenance = resolveApyProvenance(hasLiveKpis, data.vaultMeta.livePreview);
  const miningProvenance: Provenance = hasLiveKpis ? "live" : "manual";
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
    proofFresh,
    proofProvenance,
    proof,
    totalActionRequired,
    data,
  });

  return (
    <div className="dashboard-command-board relative z-10 admin-doc-stack admin-doc-stack--relaxed">
      <section aria-label="Vault KPIs">
        <DashboardKpiStrip kpis={heroKpis} />
      </section>

      <div className="dashboard-command-row-a">
        <div className="dashboard-command-slot dashboard-command-slot--allocation">
          <AllocationOrbit
            live={allocationLive}
            allocations={allocation}
            capitalUsdc={capitalUsdc}
            allocationTotal={allocationTotal}
          />
        </div>
        <NavSlot
          navLive={navLive}
          navPoints={navPoints}
          lastNav={lastNav}
          navDelta={computeNavDelta(lastNav, firstNav)}
          navProvenance={navLive ? "live" : "estimated"}
        />
      </div>

      <div className="dashboard-command-row-b">
        <CapitalStack
          live={allocationLive}
          allocations={allocation}
          provenance={capitalProvenance}
        />
        <RiskLens risk={risk} riskProvenance={riskProvenance} />

        <DashboardCommandCell
          ready={data.latestDistribution !== null}
          emptyMessage="No distribution on file yet."
          emptyAriaLabel="Distribution awaiting first record"
        >
          {data.latestDistribution ? (
            <DistributionPanel distribution={data.latestDistribution} />
          ) : null}
        </DashboardCommandCell>

        <DashboardCommandCell
          ready={!isProofSlotEmpty(proof)}
          emptyMessage="Proof and custody records appear after the first attestation or reserve snapshot."
          emptyAriaLabel="Proof and custody awaiting first record"
        >
          <ProofPulse
            proof={proof}
            proofFresh={proofFresh}
            custodyUsdc={proof.custodyReservesUsdc}
          />
        </DashboardCommandCell>
      </div>

      <OperatorShortcuts actions={actions} />

      <section aria-label="Cockpit operations" className="dashboard-command-row-c">
        <ActionQueue items={cockpit.actionQueue} />
        <LiveMetrics vaults={cockpit.vaultMetrics} />
        <LiveOps
          inngestJobs={cockpit.inngestJobs}
          sentryStats={cockpit.sentryStats}
          onChainEvents={cockpit.onChainEvents}
        />
      </section>

      <section aria-label="Recent admin activity">
        <AuditTrailRolling entries={cockpit.auditTrail} />
      </section>
    </div>
  );
}
