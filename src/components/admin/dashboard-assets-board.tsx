import Link from "next/link";

import { ActionQueue } from "@/components/admin/cockpit/action-queue";
import { AuditTrailRolling } from "@/components/admin/cockpit/audit-trail-rolling";
import { LiveMetrics } from "@/components/admin/cockpit/live-metrics";
import { LiveOps } from "@/components/admin/cockpit/live-ops";
import { DashboardKpiStrip } from "@/components/admin/dashboard-kpi-strip";
import { EmptyChartState } from "@/components/portfolio/empty-chart-state";
import { Card } from "@/components/ui/card";
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import { allocationLabelFor, allocationStrokeFor } from "@/lib/allocation-colors";
import { cn } from "@/lib/cn";
import { adminNavLinks } from "@/lib/admin/nav-links";
import type { CockpitPayload, HeroKpi } from "@/lib/data/cockpit";
import type { AdminActionItem, AdminProofStatus } from "@/lib/data/admin-overview";
import type { DashboardAllocation, DashboardData, NavPoint } from "@/lib/data/dashboard";
import type { RiskFrameworkData } from "@/lib/data/risk-framework";

interface DashboardAssetsBoardProps {
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

const usdCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const usdFull = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

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
  const hasRealSnapshot = data.source === "db";
  const hasCapital = capitalUsdc > 0;
  const allocationLive = hasRealSnapshot && hasCapital && allocation.length > 0;

  const navPoints = data.timeseries.nav30d;
  const navLive = data.timeseries.source === "db" && navPoints.length >= 2;
  const navProvenance: Provenance = navLive ? "live" : "estimated";

  const riskProvenance: Provenance = hasLiveKpis
    ? risk.source === "db"
      ? "live"
      : risk.source === "partial"
        ? "partial"
        : "manual"
    : "manual";
  const apyProvenance: Provenance = hasLiveKpis
    ? "live"
    : data.vaultMeta.livePreview
      ? "estimated"
      : "manual";
  const miningProvenance: Provenance = hasLiveKpis ? "live" : "manual";
  const proofProvenance: Provenance = proofFresh ? "attested" : proof.attestationsCount > 0 ? "stale" : "manual";

  const heroKpis = buildHeroKpis({
    capitalUsdc,
    capitalProvenance,
    vaultName: data.vaultMeta.name,
    headlineApy,
    yieldPosture,
    apyProvenance,
    risk,
    riskProvenance,
    miningMarginScore: data.vault.miningMarginScore,
    miningSublabel: hashpriceLabel(data),
    miningProvenance,
    hasLiveKpis,
    proofFresh,
    proofProvenance,
    proof,
    totalActionRequired,
  });

  const lastNav = navLive ? (navPoints.at(-1)?.aum_usdc ?? 0) : null;
  const firstNav = navLive ? (navPoints[0]?.aum_usdc ?? 0) : null;
  const navDelta =
    lastNav !== null && firstNav !== null && firstNav !== 0
      ? ((lastNav - firstNav) / firstNav) * 100
      : null;

  const trackedActions = actions.filter((action) => action.tracked && action.href);

  return (
    <div className="dashboard-command-board relative z-10 flex flex-col gap-4">
      <section aria-label="Vault KPIs">
        <DashboardKpiStrip kpis={heroKpis} />
      </section>

      <div className="dashboard-command-row-a">
        <div className="dashboard-command-slot dashboard-command-slot--allocation">
          <AllocationOrbitCss
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
          navDelta={navDelta}
          navProvenance={navProvenance}
        />

        <Card className="dashboard-command-slot dashboard-command-slot--proof">
          <ProofPulse proof={proof} proofFresh={proofFresh} custodyUsdc={proof.custodyReservesUsdc} />
        </Card>
      </div>

      <div className="dashboard-command-row-b">
        {allocationLive ? (
          <Card className="dashboard-command-cell">
            <CellHeader title="Capital stack" provenance="live" />
            <div className="dashboard-assets-stack">
              {allocation.map((item) => (
                <AllocationStackRow key={item.bucket} item={item} />
              ))}
            </div>
          </Card>
        ) : (
          <EmptyChartState
            className="dashboard-command-cell min-h-32"
            message="Capital stack appears once the first snapshot books real allocations."
            ariaLabel="Capital stack awaiting first snapshot"
          />
        )}

        {risk.dimensions.length > 0 ? (
          <Card className="dashboard-command-cell">
            <CellHeader title="Risk lens" provenance={riskProvenance} />
            <div className="dashboard-assets-risk">
              {risk.dimensions.slice(0, 5).map((dimension) => (
                <div key={dimension.id} className="dashboard-assets-risk__row">
                  <span>{dimension.label}</span>
                  <div className="dashboard-assets-risk__track">
                    <span
                      className={cn(
                        "dashboard-assets-risk__fill",
                        toneClass(
                          dimension.severity === "high"
                            ? "danger"
                            : dimension.severity === "medium"
                              ? "warning"
                              : "success",
                        ),
                      )}
                      style={{ width: `${Math.max(4, Math.min(100, dimension.score))}%` }}
                    />
                  </div>
                  <strong className="tabular">{dimension.score}</strong>
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <EmptyChartState
            className="dashboard-command-cell min-h-32"
            message="Risk lens appears once mining and vault snapshots are on file."
            ariaLabel="Risk lens awaiting data"
          />
        )}

        {data.latestDistribution ? (
          <Card className="dashboard-command-cell">
            <DistributionPanel distribution={data.latestDistribution} />
          </Card>
        ) : (
          <EmptyChartState
            className="dashboard-command-cell min-h-32"
            message="No distribution on file yet."
            ariaLabel="Distribution awaiting first record"
          />
        )}
      </div>

      {trackedActions.length > 0 ? (
        <Card className="dashboard-command-cell" aria-label="Operator queue counts">
          <h2 className="h3 mb-3">Operator queues</h2>
          <ul className="flex flex-col gap-2" role="list">
            {trackedActions.map((action) => (
              <li key={action.key}>
                <Link href={action.href!} className="dashboard-command-queue-link">
                  <span className="dashboard-command-queue-link__count">{action.count}</span>
                  <span>
                    <strong>{action.label}</strong>
                    <span className="block body-xs ct-text-muted">{action.hint}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <section
        aria-label="Cockpit operations"
        className="dashboard-command-row-c grid gap-4 lg:grid-cols-3"
      >
        <ActionQueue items={cockpit.actionQueue} />
        <LiveMetrics vaults={cockpit.vaultMetrics} />
        <LiveOps
          inngestJobs={cockpit.inngestJobs}
          sentryStats={cockpit.sentryStats}
          onChainEvents={cockpit.onChainEvents}
        />
      </section>

      <section aria-label="Audit trail">
        <AuditTrailRolling entries={cockpit.auditTrail} />
      </section>
    </div>
  );
}

function heroProvenance(kind: Provenance): HeroKpi["provenance"] {
  return kind === "partial" ? "estimated" : kind;
}

function buildHeroKpis(input: {
  capitalUsdc: number;
  capitalProvenance: Provenance;
  vaultName: string;
  headlineApy: { low: number; high: number } | null;
  yieldPosture: string;
  apyProvenance: Provenance;
  risk: RiskFrameworkData;
  riskProvenance: Provenance;
  miningMarginScore: number;
  miningSublabel: string;
  miningProvenance: Provenance;
  hasLiveKpis: boolean;
  proofFresh: boolean;
  proofProvenance: Provenance;
  proof: AdminProofStatus;
  totalActionRequired: number;
}): HeroKpi[] {
  const riskTone =
    input.risk.band === "high" ? "danger" : input.risk.band === "medium" ? "warning" : "success";
  const apyValue =
    input.headlineApy !== null && input.headlineApy.low > 0 && input.headlineApy.high > 0
      ? `${input.headlineApy.low.toFixed(1)}–${input.headlineApy.high.toFixed(1)}%`
      : "—";

  return [
    {
      label: "Capital",
      value: input.capitalUsdc > 0 ? usdCompact.format(input.capitalUsdc) : "—",
      sublabel: input.vaultName,
      provenance: heroProvenance(input.capitalProvenance),
    },
    {
      label: "APY",
      value: apyValue,
      sublabel: input.yieldPosture,
      provenance: heroProvenance(input.apyProvenance),
    },
    {
      label: "Risk",
      value:
        input.hasLiveKpis && input.risk.composite > 0
          ? `${input.risk.composite}/100`
          : "—",
      sublabel:
        input.hasLiveKpis && input.risk.composite > 0
          ? input.risk.bandLabel
          : "awaiting snapshot",
      provenance: heroProvenance(input.riskProvenance),
      alert: riskTone === "danger",
    },
    {
      label: "Mining",
      value:
        input.hasLiveKpis && input.miningMarginScore > 0
          ? `${input.miningMarginScore}/100`
          : "—",
      sublabel: input.miningSublabel,
      provenance: heroProvenance(input.miningProvenance),
      alert: input.hasLiveKpis && input.miningMarginScore > 0 && input.miningMarginScore < 15,
    },
    {
      label: "Proof",
      value: input.proofFresh ? "Current" : input.proof.attestationsCount > 0 ? "Stale" : "Pending",
      sublabel: proofSubtitle(input.proof),
      provenance: heroProvenance(input.proofProvenance),
    },
    {
      label: "Queues",
      value: String(input.totalActionRequired),
      sublabel: input.totalActionRequired === 1 ? "tracked action" : "tracked actions",
      provenance: "manual",
      alert: input.totalActionRequired > 0,
    },
  ];
}

/** NAV slot — empty = single awaiting surface (DS §9); live = active card + chart. */
function NavSlot({
  navLive,
  navPoints,
  lastNav,
  navDelta,
  navProvenance,
}: {
  navLive: boolean;
  navPoints: NavPoint[];
  lastNav: number | null;
  navDelta: number | null;
  navProvenance: Provenance;
}) {
  if (!navLive) {
    return (
      <div className="dashboard-command-slot dashboard-command-slot--nav">
        <EmptyChartState
          className="dashboard-command-nav-empty"
          message="NAV trend appears after seven days of booked snapshots."
        />
      </div>
    );
  }

  return (
    <Card className="dashboard-command-slot dashboard-command-slot--nav">
      <div className="dashboard-command-performance">
        <div className="dashboard-command-performance__header">
          <div>
            <span className="eyebrow">NAV · 30d</span>
            <strong className="stat-value tabular block mt-1">
              {lastNav !== null && lastNav > 0 ? usdCompact.format(lastNav) : "—"}
            </strong>
          </div>
          <ProvenanceBadge kind={navProvenance} />
        </div>

        <NavBarChart points={navPoints} />

        {navDelta !== null ? (
          <div className="dashboard-command-performance__footer">
            <span
              className={cn(
                "body-xs font-semibold tabular",
                navDelta >= 0 ? "ct-status-success" : "ct-status-danger",
              )}
            >
              {navDelta >= 0 ? "+" : ""}
              {navDelta.toFixed(1)}% NAV · 30d
            </span>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function CellHeader({ title, provenance }: { title: string; provenance: Provenance }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <h2 className="h3">{title}</h2>
      <ProvenanceBadge kind={provenance} />
    </div>
  );
}

/** CSS conic-gradient orbit — no SVG. */
function AllocationOrbitCss({
  live,
  allocations,
  capitalUsdc,
  allocationTotal,
}: {
  live: boolean;
  allocations: DashboardAllocation[];
  capitalUsdc: number;
  allocationTotal: number;
}) {
  if (!live) {
    return (
      <EmptyChartState
        round
        className="dashboard-orbit-empty"
        message="Allocation map appears after the first vault snapshot."
      />
    );
  }

  const gradient = conicGradientFromAllocations(allocations);

  return (
    <div className="dashboard-orbit dashboard-orbit--live" aria-label="Vault allocation map">
      <div className="dashboard-orbit__visual">
        <div className="dashboard-orbit__track" aria-hidden />
        <div
          className="dashboard-orbit__ring"
          style={{ "--dashboard-orbit-gradient": gradient } as React.CSSProperties}
          aria-hidden
        />
        <div className="dashboard-orbit__core">
          <span>AUM</span>
          <strong className="tabular">{usdCompact.format(capitalUsdc)}</strong>
          <small>{allocationTotal.toFixed(0)}% mapped</small>
        </div>
      </div>
      <ul className="dashboard-orbit__legend" aria-label="Allocation legend">
        {allocations.map((item) => (
          <li key={item.bucket}>
            <span
              className="dashboard-orbit__legend-dot"
              style={{ background: allocationStrokeFor(item.bucket) }}
              aria-hidden
            />
            <span>{allocationLabelFor(item.bucket)}</span>
            <span className="tabular">{item.pct.toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function conicGradientFromAllocations(allocations: DashboardAllocation[]): string {
  let cumul = 0;
  const stops = allocations
    .filter((item) => item.pct > 0)
    .map((item) => {
      const start = cumul;
      cumul += item.pct;
      return `${allocationStrokeFor(item.bucket)} ${start}% ${cumul}%`;
    });
  if (stops.length === 0) {
    return `conic-gradient(var(--ct-surface-3) 0% 100%)`;
  }
  return `conic-gradient(from -90deg, ${stops.join(", ")})`;
}

/** CSS bar chart from real NAV points — no SVG. */
function NavBarChart({ points }: { points: NavPoint[] }) {
  const values = points.map((point) => point.aum_usdc);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || max || 1;

  return (
    <div
      className="dashboard-nav-bars"
      style={{ "--dashboard-nav-bar-count": String(points.length) } as React.CSSProperties}
      role="img"
      aria-label="NAV trend over 30 days"
    >
      {points.map((point) => {
        const normalized = max === min ? 1 : (point.aum_usdc - min) / span;
        const heightPct = Math.max(10, Math.round(normalized * 100));
        return (
          <div key={point.date} className="dashboard-nav-bars__cell">
            <div
              className="dashboard-nav-bars__bar"
              style={{ height: `${heightPct}%` }}
              title={`${point.date}: ${usdFull.format(point.aum_usdc)}`}
            />
          </div>
        );
      })}
    </div>
  );
}

function ProofPulse({
  proof,
  proofFresh,
  custodyUsdc,
}: {
  proof: AdminProofStatus;
  proofFresh: boolean;
  custodyUsdc: number;
}) {
  return (
    <div className="dashboard-proof-pulse">
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow">Proof & custody</span>
        <ProvenanceBadge kind={proofFresh ? "attested" : proof.attestationsCount > 0 ? "stale" : "manual"} />
      </div>
      <ul className="mt-2 flex flex-col gap-1.5 body-xs" role="list">
        <li>
          <Link href={adminNavLinks.proofCenter()} className="ct-text-accent hover:underline">
            Proof Center
          </Link>
          <span className="ct-text-muted">
            {" "}
            · {proof.proofsTotal} proof{proof.proofsTotal === 1 ? "" : "s"} on file
          </span>
        </li>
        <li>
          <Link href={adminNavLinks.proofs()} className="ct-text-accent hover:underline">
            Mining attestations
          </Link>
          <span className="ct-text-muted">
            {" "}
            · {proof.attestationsCount} on file
            {proof.lastMiningAttestationAt
              ? ` · last ${dateFmt.format(proof.lastMiningAttestationAt)}`
              : ""}
          </span>
        </li>
        <li className="ct-text-muted">
          Custody reserves
          {proof.custodyConfigured && custodyUsdc > 0 ? (
            <>
              {" · "}
              {usdCompact.format(custodyUsdc)}
              {" · "}
              <ProvenanceBadge kind={proof.custodyProvenance} />
            </>
          ) : (
            <span> · Not configured</span>
          )}
        </li>
      </ul>
    </div>
  );
}

function DistributionPanel({
  distribution,
}: {
  distribution: NonNullable<DashboardData["latestDistribution"]>;
}) {
  const provenance: Provenance = distribution.synthesized ? "estimated" : distribution.status === "paid" ? "live" : "manual";

  return (
    <>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="h3">Distribution</h2>
          <p className="body-xs ct-text-muted mt-1">
            <Link href={adminNavLinks.distributions()} className="ct-text-accent hover:underline">
              Open distributions
            </Link>
          </p>
        </div>
        <ProvenanceBadge kind={provenance} />
      </div>
      <dl className="flex flex-col gap-2 body-sm">
        <div className="flex justify-between gap-2">
          <dt className="ct-text-muted">Period</dt>
          <dd className="tabular ct-text-strong">{distribution.period}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="ct-text-muted">Amount</dt>
          <dd className="tabular ct-text-strong">
            {distribution.amount_usdc > 0 ? usdFull.format(distribution.amount_usdc) : "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="ct-text-muted">Status</dt>
          <dd className="capitalize ct-text-strong">{distribution.status}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="ct-text-muted">Paid</dt>
          <dd className="ct-text-strong">
            {distribution.paid_at ? dateFmt.format(distribution.paid_at) : "—"}
          </dd>
        </div>
      </dl>
      {distribution.synthesized ? (
        <p className="mt-3 body-xs ct-text-faint">Indicative projection — not a committed payout.</p>
      ) : null}
    </>
  );
}

function AllocationStackRow({ item }: { item: DashboardAllocation }) {
  const hasValue = item.valueUsdc > 0;
  return (
    <div className="dashboard-assets-stack__row">
      <div>
        <span
          aria-hidden
          className="dashboard-assets-stack__dot"
          style={{ background: allocationStrokeFor(item.bucket) }}
        />
        <span>{allocationLabelFor(item.bucket)}</span>
      </div>
      <div className="dashboard-assets-stack__bar">
        <span
          style={{
            width: `${Math.max(2, Math.min(100, item.pct))}%`,
            background: allocationStrokeFor(item.bucket),
          }}
        />
      </div>
      <strong className="tabular">{item.pct.toFixed(0)}%</strong>
      <small>{hasValue ? usdCompact.format(item.valueUsdc) : "—"}</small>
    </div>
  );
}

function toneClass(tone: "success" | "warning" | "danger"): string {
  if (tone === "danger") return "ct-status-danger";
  if (tone === "warning") return "ct-status-warning";
  return "ct-status-success";
}

function hashpriceLabel(data: DashboardData): string {
  const hashprice = data.miningOps.hashprice;
  if (!hashprice) return "Hashprice pending";
  return `$${hashprice.usd_per_th_day.toFixed(3)} / TH / day`;
}

function proofSubtitle(proof: AdminProofStatus): string {
  if (proof.lastMiningAttestationAt) {
    return `Last ${dateFmt.format(proof.lastMiningAttestationAt)}`;
  }
  return proof.proofsTotal > 0 ? `${proof.proofsTotal} proofs on file` : "No attestation yet";
}
