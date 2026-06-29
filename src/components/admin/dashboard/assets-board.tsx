
import { cn } from "@/lib/cn";
import { ActionQueue } from "@/components/admin/cockpit/action-queue";
import { AuditTrailRolling } from "@/components/admin/cockpit/audit-trail-rolling";
import { LiveMetrics } from "@/components/admin/cockpit/live-metrics";
import { LiveOps } from "@/components/admin/cockpit/live-ops";
import { BentoHeader, BentoPanel } from "@/components/catalyst/bento";
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
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
  buildOverviewClustersView,
  type AllocationProvenance,
} from "@/lib/admin/overview-clusters-view";
import { resolveSystemReadiness } from "@/lib/admin/dashboard-readiness-view";
import {
  resolveAllocationChartLive,
  resolveNavChartLive,
} from "@/lib/admin/dashboard-vault-signals";
import type { CockpitPayload } from "@/lib/data/cockpit";
import type { AdminProofStatus } from "@/lib/data/admin-overview";
import type { DashboardData } from "@/lib/data/dashboard";
import type { OverviewClusters } from "@/lib/data/overview-clusters";
import type { PlatformTotals } from "@/lib/data/platform-totals";
import type { RiskFrameworkData } from "@/lib/data/risk-framework";

import { AdminLeafLink } from "./cockpit-panel-header";

import { AllocationOrbit } from "./allocation-orbit";
import { AdminKpiStripPanel } from "./admin-kpi-strip-panel";
import { NavSlot } from "./nav-slot";
import { PlatformOverviewBand } from "./platform-overview-band";
import { DashboardRiskSummaryCard } from "./risk-summary-card";
import { DashboardRecentEvents } from "./dashboard-recent-events";
import { SystemReadinessModule } from "./system-readiness";
import { MarketPricesPanel } from "./market-prices-panel";

/**
 * Layout scope:
 * - Vault-scoped (active pill): KPI strip, allocation orbit, NAV, risk summary.
 * - Platform-wide (not filtered by pill): operator queue, platform status, audit trail.
 *   LiveMetrics is filtered to `data.vaultMeta.id` only.
 *
 * Bento canon (mirrors src/app/(product)/portfolio/page.tsx): the page wraps this
 * board in the grey surface; here every module is a black BentoPanel with a
 * hairline border, micro uppercase headers and the single accent (--ct-accent).
 */

interface DashboardAssetsBoardProps {
  data: DashboardData;
  risk: RiskFrameworkData;
  proof: AdminProofStatus;
  capitalUsdc: number;
  headlineApy: { low: number; high: number } | null;
  yieldPosture: string;
  hasLiveKpis: boolean;
  /** Seed timeline (`daily-seed`) — preview KPIs/charts with simulated badge. */
  hasSeedPreview?: boolean;
  showVaultAnalytics?: boolean;
  /** True when the payload comes from the demo builder — badges read "simulated". */
  simulated?: boolean;
  proofFresh: boolean;
  cockpit: CockpitPayload;
  /** Platform totals (investors + invested capital) for the overview band. */
  platformTotals: PlatformTotals;
  /** Platform-wide cluster aggregates for the executive overview band. */
  overviewClusters: OverviewClusters;
}

/** Status pill (dot + label) for a panel header — accent-green when "ok". */
function PaneStatus({
  label,
  tone = "ok",
}: {
  label: string;
  tone?: "ok" | "watch" | "alert";
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded border border-[var(--ct-border)] bg-[var(--ct-status-neutral-soft)] px-1.5 py-0.5 leading-none">
      <span
        className={cn(
          "size-[5px] rounded-full",
          tone === "ok" && "bg-[var(--ct-accent)]",
          tone === "watch" && "bg-[var(--ct-status-warning)]",
          tone === "alert" && "bg-[var(--ct-status-danger)]",
        )}
        aria-hidden
      />
      <span
        className={cn(
          "ct-bento-label",
          tone === "ok" && "text-[var(--ct-accent)]",
          tone === "watch" && "text-[var(--ct-status-warning)]",
          tone === "alert" && "text-[var(--ct-status-danger)]",
        )}
      >
        {label}
      </span>
    </span>
  );
}

/** BentoHeader specialised for the ops/lower panes: title + status + leaf link + provenance. */
function PaneHeader({
  title,
  status,
  statusTone,
  href,
  provenance,
}: {
  title: string;
  status?: string;
  statusTone?: "ok" | "watch" | "alert";
  href?: string;
  provenance?: Provenance;
}) {
  // Custom header (not BentoHeader) so the title and its trailing controls
  // (status badge + "View full" + provenance) WRAP instead of overlapping when
  // the pane is narrow and the title runs onto two lines. Reproduces the canon
  // .ct-bento-panel-header chrome (p-5 + bottom hairline) with flex-wrap, a
  // min-w-0 title, and a shrink-0 trailing group that drops below the title.
  return (
    <div className="ct-bento-panel-header flex flex-wrap items-end justify-between gap-x-4 gap-y-1.5">
      <h3 className="ct-bento-card-title min-w-0">{title}</h3>
      <div className="flex shrink-0 items-center gap-2 pb-0.5">
        {status ? <PaneStatus label={status} tone={statusTone} /> : null}
        {href ? <AdminLeafLink href={href} /> : null}
        {provenance ? <ProvenanceBadge kind={provenance} variant="strip" /> : null}
      </div>
    </div>
  );
}

export function DashboardAssetsBoard({
  data,
  risk,
  proof,
  capitalUsdc,
  headlineApy,
  yieldPosture,
  hasLiveKpis,
  hasSeedPreview = false,
  showVaultAnalytics: showVaultAnalyticsProp,
  simulated,
  proofFresh,
  cockpit,
  platformTotals,
  overviewClusters,
}: DashboardAssetsBoardProps) {
  const showVaultAnalytics = showVaultAnalyticsProp ?? (hasLiveKpis || hasSeedPreview);
  const chartSeedPreview = hasSeedPreview && !hasLiveKpis;

  const allocation = data.allocations;
  const allocationTotal = allocation.reduce((sum, item) => sum + item.pct, 0);
  const allocationLive = resolveAllocationChartLive(
    hasLiveKpis,
    hasSeedPreview,
    data,
    capitalUsdc,
  );

  // Dominant allocation bucket for the KPI strip (the donut shows the full split).
  const topAllocation =
    allocation.length > 0
      ? allocation.reduce((max, cur) => (cur.pct > max.pct ? cur : max))
      : null;

  const navPoints = data.timeseries.nav30d;
  const navLive = resolveNavChartLive(hasLiveKpis, hasSeedPreview, data.timeseries);
  const lastNav = navLive ? (navPoints.at(-1)?.aum_usdc ?? 0) : null;
  const firstNav = navLive ? (navPoints[0]?.aum_usdc ?? 0) : null;

  const vaultSignalProvenance = resolveVaultSignalProvenance(
    hasLiveKpis,
    data.vaultMeta.livePreview,
    simulated,
    hasSeedPreview,
  );

  // Dominant-allocation provenance — shared by the vault strip and the overview
  // band's Exposure cluster (mirrors the donut's live/seed/estimated read).
  const allocationProvenance: AllocationProvenance = allocationLive
    ? chartSeedPreview
      ? "simulated"
      : "live"
    : "estimated";

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
    topAllocation: topAllocation
      ? { bucket: topAllocation.bucket, pct: topAllocation.pct }
      : null,
    allocationProvenance,
  });

  // Executive platform-overview band — platform-wide totals (all vaults),
  // consolidated from the dedicated admin pages into 4 clusters.
  const overviewView = buildOverviewClustersView({
    totals: platformTotals,
    clusters: overviewClusters,
    allocations: allocation,
    allocationProvenance,
  });

  const riskProvenance = resolveRiskProvenance(hasLiveKpis, risk, simulated);

  const scopedVaultMetrics = cockpit.vaultMetrics.filter(
    (vault) => vault.vaultId === data.vaultMeta.id,
  );

  const readiness = resolveSystemReadiness({
    risk,
    scopedVaultMetrics,
    data,
    hasLiveKpis,
  });

  return (
    <div className="flex flex-col gap-5">

      {/* ── System readiness (full-width operator header, owns its surface) ── */}
      <SystemReadinessModule view={readiness} />

      {/* ── Platform overview — executive totals across all vaults ── */}
      <BentoPanel aria-label="Platform overview panel">
        <PlatformOverviewBand view={overviewView} allocations={allocation} />
      </BentoPanel>

      {/* ── KPI strip + charts ── */}
      <BentoPanel aria-label="Vault KPIs and charts">
        {/* Canon KPI strip via AdminKpiStripPanel (embedded): grey inset
            surface + centred cells + welded bottom hairline, like every other
            admin strip. A bare DashboardKpiStrip is transparent + left-aligned,
            which left APY/Risk/Mining/… sitting on the black panel, mis-centred. */}
        <section aria-label="Vault KPIs">
          <AdminKpiStripPanel kpis={stripKpis} embedded />
        </section>

        {showVaultAnalytics ? (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] bg-surface-inset">
            <div className="flex flex-col p-5 lg:px-6 border-b border-[var(--ct-border-soft)] lg:border-b-0 lg:border-r">
              <AllocationOrbit
                allocations={allocation}
                capitalUsdc={capitalUsdc}
                allocationTotal={allocationTotal}
                provenance={resolveChartProvenance(
                  simulated,
                  allocationLive,
                  chartSeedPreview,
                )}
              />
            </div>
            <div className="flex flex-col p-5 lg:px-6">
              <NavSlot
                navPoints={navPoints}
                lastNav={lastNav}
                navDelta={computeNavDelta(lastNav, firstNav)}
                navProvenance={resolveChartProvenance(
                  simulated,
                  navLive,
                  chartSeedPreview,
                )}
              />
            </div>
            {chartSeedPreview ? (
              <p
                className="ct-metric-caption col-span-full px-5 lg:px-6 pb-4"
                role="status"
              >
                Seed snapshot — simulated preview, not live production telemetry.
              </p>
            ) : null}
          </div>
        ) : (
          <section
            aria-label="Vault analytics awaiting live data"
            className="flex items-center justify-center px-8 py-10 text-center bg-surface-inset"
          >
            <p className="ct-metric-value max-w-[45ch] font-normal leading-relaxed text-[var(--ct-text-secondary)]" role="status">
              Capital allocation and NAV trends appear once a live vault snapshot
              is connected. KPI strip above shows honest placeholders until then.
            </p>
          </section>
        )}

        {data.recentEvents.length > 0 ? (
          <section aria-label="Recent vault activity" className="border-t border-[var(--ct-border-soft)]">
            <BentoHeader as="h3" title="Recent activity" subtitle="Rebalance log" />
            <div className="p-5">
              <DashboardRecentEvents events={data.recentEvents} />
            </div>
          </section>
        ) : null}
      </BentoPanel>

      {/* ── Market prices — BTC / ETH spot (Binance) ── */}
      <MarketPricesPanel />

      {/* ── Ops trio — three independent panels (Portfolio canon) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <BentoPanel>
          <PaneHeader
            title="Operator queue"
            status="Active"
            statusTone="ok"
            href="/admin/monitoring"
          />
          <div className="p-5">
            <ActionQueue items={cockpit.actionQueue} />
          </div>
        </BentoPanel>

        <BentoPanel>
          <PaneHeader
            title="Vault health"
            status="Monitoring"
            statusTone="ok"
            href="/admin/monitoring"
          />
          <div className="p-5">
            <LiveMetrics vaults={scopedVaultMetrics} />
          </div>
        </BentoPanel>

        <BentoPanel>
          <PaneHeader
            title="Platform status"
            status="Live"
            statusTone="ok"
            href="/admin/monitoring"
          />
          <LiveOps
            inngestJobs={cockpit.inngestJobs}
            sentryStats={cockpit.sentryStats}
            onChainEvents={cockpit.onChainEvents}
          />
        </BentoPanel>
      </div>

      {/* ── Risk posture + Audit trail — two independent panels (Portfolio canon) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <BentoPanel>
          <PaneHeader
            title="Risk posture"
            status="Guarded"
            statusTone="ok"
            href="/admin/vaults"
            provenance={riskProvenance}
          />
          <DashboardRiskSummaryCard
            data={risk}
            hasLiveKpis={hasLiveKpis}
            simulated={simulated}
          />
        </BentoPanel>

        <BentoPanel>
          <PaneHeader
            title="Audit trail"
            status="Logging"
            statusTone="ok"
            href="/admin/audit"
          />
          <div className="p-5">
            <AuditTrailRolling entries={cockpit.auditTrail.slice(0, 5)} />
          </div>
        </BentoPanel>
      </div>

    </div>
  );
}
