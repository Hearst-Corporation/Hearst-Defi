import Link from "next/link";

import { EmptyChartState } from "@/components/portfolio/empty-chart-state";
import { ApyRange } from "@/components/ui/apy-range";
import { Card } from "@/components/ui/card";
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import { allocationLabelFor, allocationStrokeFor } from "@/lib/allocation-colors";
import { cn } from "@/lib/cn";
import type { AdminActionItem, AdminProofStatus } from "@/lib/data/admin-overview";
import type { DashboardAllocation, DashboardData } from "@/lib/data/dashboard";
import type { RiskFrameworkData } from "@/lib/data/risk-framework";

interface DashboardAssetsBoardProps {
  data: DashboardData;
  risk: RiskFrameworkData;
  proof: AdminProofStatus;
  actions: AdminActionItem[];
  totalActionRequired: number;
  capitalUsdc: number;
  capitalProvenance: Provenance;
  headlineApy: { low: number; high: number };
  yieldPosture: string;
  proofFresh: boolean;
}

const usdCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
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
  proofFresh,
}: DashboardAssetsBoardProps) {
  const allocation = data.allocations;
  const allocationTotal = allocation.reduce((sum, item) => sum + item.pct, 0);
  const riskTone = risk.band === "high" ? "danger" : risk.band === "medium" ? "warning" : "success";
  const miningProvenance: Provenance = data.source === "db" ? "live" : "estimated";
  const proofProvenance: Provenance = proofFresh ? "attested" : "stale";

  // Honesty gate: an allocation orbit / capital stack is only a *real* asset map
  // when (a) the dashboard data came from a DB snapshot AND (b) there is actual
  // capital to allocate. A fallback/methodology preset rendered over $0 AUM is a
  // ghost chart — render an awaiting surface that replaces it instead (DS §9).
  const hasRealSnapshot = data.source === "db";
  const hasCapital = capitalUsdc > 0;
  const allocationLive = hasRealSnapshot && hasCapital && allocation.length > 0;

  return (
    <section className="dashboard-assets-board relative z-10" aria-label="Dashboard asset cockpit">
      <Card className="dashboard-assets-card dashboard-assets-card--hero">
        <div className="dashboard-assets-card__header">
          <div>
            <span className="dashboard-assets-eyebrow">Vault command main</span>
            <h2 className="dashboard-assets-title">Vault command map</h2>
          </div>
          <ProvenanceBadge kind={capitalProvenance} />
        </div>

        <div className="dashboard-assets-hero">
          {allocationLive ? (
            <div className="dashboard-assets-orbit" aria-label="Allocation orbital asset map">
              <AllocationOrbit allocations={allocation} />
              <div className="dashboard-assets-orbit__core">
                <span>AUM</span>
                <strong>{usdCompact.format(capitalUsdc)}</strong>
                <small>{allocationTotal.toFixed(0)}% mapped</small>
              </div>
            </div>
          ) : (
            <EmptyChartState
              round
              className="dashboard-assets-orbit"
              message="Allocation map appears after the first vault snapshot."
              ariaLabel="Allocation orbital asset map awaiting first snapshot"
            />
          )}

          <div className="dashboard-assets-command">
            <PerformanceChart data={data} headlineApy={headlineApy} />

            <div className="dashboard-assets-hero__metrics">
              <AssetStat label="APY range" provenance="estimated">
                <ApyRange low={headlineApy.low} high={headlineApy.high} precision={1} />
                <span>{yieldPosture}</span>
              </AssetStat>
              <AssetStat label="Risk score" provenance="estimated">
                <strong className={cn("tabular", toneClass(riskTone))}>
                  {risk.composite}
                  <span>/100</span>
                </strong>
                <span>{risk.bandLabel}</span>
              </AssetStat>
              <AssetStat label="Mining margin" provenance={miningProvenance}>
                <strong className="tabular">
                  {data.vault.miningMarginScore}
                  <span>/100</span>
                </strong>
                <span>{hashpriceLabel(data)}</span>
              </AssetStat>
              <AssetStat label="Proof status" provenance={proofProvenance}>
                <strong>{proofFresh ? "Current" : proof.attestationsCount > 0 ? "Stale" : "Pending"}</strong>
                <span>{proofSubtitle(proof)}</span>
              </AssetStat>
            </div>
          </div>
        </div>
      </Card>

      <Card className="dashboard-assets-card dashboard-assets-card--allocation">
        {allocationLive ? (
          <>
            <AssetCardHeader
              title="Capital stack"
              subtitle="Token-only allocation map"
              provenance="live"
            />
            <div className="dashboard-assets-stack">
              {allocation.map((item) => (
                <AllocationStackRow key={item.bucket} item={item} />
              ))}
            </div>
          </>
        ) : (
          <EmptyChartState
            className="dashboard-assets-stack"
            message="Capital stack appears once the first snapshot books real allocations."
            ariaLabel="Capital stack awaiting first snapshot"
          />
        )}
      </Card>

      <Card className="dashboard-assets-card dashboard-assets-card--risk">
        <AssetCardHeader title="Risk lens" subtitle="Five-dimension composite" provenance={risk.source === "db" ? "live" : risk.source === "partial" ? "partial" : "estimated"} />
        <div className="dashboard-assets-risk">
          {risk.dimensions.slice(0, 5).map((dimension) => (
            <div key={dimension.id} className="dashboard-assets-risk__row">
              <span>{dimension.label}</span>
              <div className="dashboard-assets-risk__track">
                <span
                  className={cn("dashboard-assets-risk__fill", toneClass(dimension.severity === "high" ? "danger" : dimension.severity === "medium" ? "warning" : "success"))}
                  style={{ width: `${Math.max(4, Math.min(100, dimension.score))}%` }}
                />
              </div>
              <strong>{dimension.score}</strong>
            </div>
          ))}
        </div>
      </Card>

      <Card className="dashboard-assets-card dashboard-assets-card--ops">
        <AssetCardHeader title="Ops queue" subtitle={`${totalActionRequired} tracked action${totalActionRequired === 1 ? "" : "s"}`} provenance="manual" />
        <div className="dashboard-assets-actions">
          {actions.slice(0, 4).map((action) => (
            <ActionAssetRow key={action.key} action={action} />
          ))}
        </div>
      </Card>
    </section>
  );
}

function AssetCardHeader({
  title,
  subtitle,
  provenance,
}: {
  title: string;
  subtitle: string;
  provenance: Provenance;
}) {
  return (
    <div className="dashboard-assets-card__header">
      <div>
        <span className="dashboard-assets-eyebrow">{subtitle}</span>
        <h3 className="dashboard-assets-card__title">{title}</h3>
      </div>
      <ProvenanceBadge kind={provenance} />
    </div>
  );
}

function AssetStat({
  label,
  provenance,
  children,
}: {
  label: string;
  provenance: Provenance;
  children: React.ReactNode;
}) {
  return (
    <div className="dashboard-assets-stat">
      <div>
        <span>{label}</span>
        <ProvenanceBadge kind={provenance} />
      </div>
      {children}
    </div>
  );
}

function PerformanceChart({
  data,
  headlineApy,
}: {
  data: DashboardData;
  headlineApy: { low: number; high: number };
}) {
  const navPoints = data.timeseries.nav30d;
  const apyPoints = data.timeseries.apy30d;
  const navValues = navPoints.map((point) => point.aum_usdc);
  const apyLow = apyPoints.map((point) => point.apy_low);
  const apyHigh = apyPoints.map((point) => point.apy_high);
  const navPath = linePath(navValues);
  const apyLowPath = linePath(apyLow);
  const apyHighPath = linePath(apyHigh);
  const apyBand = bandPath(apyLow, apyHigh);
  const lastNav = navValues.at(-1) ?? data.vault.aumUsdc;
  const firstNav = navValues[0] ?? lastNav;
  const navDelta = firstNav === 0 ? 0 : ((lastNav - firstNav) / firstNav) * 100;
  const provenance: Provenance = data.timeseries.source === "db" ? "live" : "estimated";

  return (
    <div className="dashboard-assets-performance">
      <div className="dashboard-assets-performance__header">
        <div>
          <span className="dashboard-assets-eyebrow">Performance rail</span>
          <strong>{usdCompact.format(lastNav)}</strong>
        </div>
        <ProvenanceBadge kind={provenance} />
      </div>

      <div className="dashboard-assets-performance__chart">
        {navPath ? (
          <svg viewBox="0 0 240 112" role="img" aria-label="NAV and APY range trend">
            <defs>
              <linearGradient id="dashboard-performance-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--ct-accent)" stopOpacity="0.26" />
                <stop offset="100%" stopColor="var(--ct-accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <g aria-hidden="true" className="dashboard-assets-performance__grid">
              <line x1="0" x2="240" y1="28" y2="28" />
              <line x1="0" x2="240" y1="56" y2="56" />
              <line x1="0" x2="240" y1="84" y2="84" />
            </g>
            <path className="dashboard-assets-performance__area" d={`${navPath} L 240 112 L 0 112 Z`} />
            {apyBand ? <path className="dashboard-assets-performance__band" d={apyBand} /> : null}
            {apyHighPath ? <path className="dashboard-assets-performance__apy-high" d={apyHighPath} /> : null}
            {apyLowPath ? <path className="dashboard-assets-performance__apy-low" d={apyLowPath} /> : null}
            <path className="dashboard-assets-performance__nav" d={navPath} />
          </svg>
        ) : (
          <div className="dashboard-assets-performance__empty">
            <span>Waiting for first NAV series</span>
          </div>
        )}
      </div>

      <div className="dashboard-assets-performance__footer">
        {navPath ? (
          <span className={cn(navDelta >= 0 ? "ct-status-success" : "ct-status-danger")}>
            {navDelta >= 0 ? "+" : ""}
            {navDelta.toFixed(1)}% NAV
          </span>
        ) : (
          <span className="ct-text-faint">NAV trend pending</span>
        )}
        <span>
          APY <ApyRange low={headlineApy.low} high={headlineApy.high} precision={1} />
        </span>
      </div>
    </div>
  );
}

function AllocationOrbit({ allocations }: { allocations: DashboardAllocation[] }) {
  const slices = allocations.reduce<
    Array<DashboardAllocation & { dashArray: string; dashOffset: number }>
  >((acc, item) => {
    const offset = acc.reduce((sum, prev) => sum + prev.pct, 0);
    return [
      ...acc,
      {
        ...item,
        dashArray: `${item.pct} ${100 - item.pct}`,
        dashOffset: -offset,
      },
    ];
  }, []);

  return (
    <svg viewBox="0 0 42 42" role="img" aria-label="Vault allocation orbit">
      <defs>
        <radialGradient id="asset-orbit-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--ct-accent)" stopOpacity="0.45" />
          <stop offset="42%" stopColor="var(--ct-accent)" stopOpacity="0.1" />
          <stop offset="100%" stopColor="var(--ct-bg-deep)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="21" cy="21" r="19" fill="url(#asset-orbit-core)" />
      <circle className="dashboard-assets-orbit__track" cx="21" cy="21" r="15.9155" />
      <circle className="dashboard-assets-orbit__track dashboard-assets-orbit__track--outer" cx="21" cy="21" r="19.0986" />
      <g transform="rotate(-90 21 21)">
        {slices.map((slice) => (
          <circle
            key={slice.bucket}
            className="dashboard-assets-orbit__slice"
            cx="21"
            cy="21"
            r="15.9155"
            stroke={allocationStrokeFor(slice.bucket)}
            strokeDasharray={slice.dashArray}
            strokeDashoffset={slice.dashOffset}
          />
        ))}
      </g>
    </svg>
  );
}

function AllocationStackRow({ item }: { item: DashboardAllocation }) {
  // Show the booked value only — never synthesise `AUM × preset%`, which would
  // present a methodology preset as a measured allocation (Admin Honesty).
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
        <span style={{ width: `${Math.max(2, Math.min(100, item.pct))}%`, background: allocationStrokeFor(item.bucket) }} />
      </div>
      <strong>{item.pct.toFixed(0)}%</strong>
      <small>{hasValue ? usdCompact.format(item.valueUsdc) : "—"}</small>
    </div>
  );
}

function ActionAssetRow({ action }: { action: AdminActionItem }) {
  const row = (
    <div className="dashboard-assets-actions__row">
      <div>
        <span className={cn("dashboard-assets-actions__count", action.count > 0 && action.tracked && "dashboard-assets-actions__count--hot")}>
          {action.tracked ? action.count : "n/a"}
        </span>
      </div>
      <div>
        <strong>{action.label}</strong>
        <span>{action.hint}</span>
      </div>
    </div>
  );

  if (!action.href) return row;
  return (
    <Link href={action.href} className="dashboard-assets-actions__link">
      {row}
    </Link>
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

const CHART_W = 240;
const CHART_H = 112;
const CHART_PAD = 8;

function linePath(values: number[]): string | null {
  const points = chartPoints(values);
  if (points.length === 0) return null;
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
}

function bandPath(low: number[], high: number[]): string | null {
  const lowPoints = chartPoints(low, [...low, ...high]);
  const highPoints = chartPoints(high, [...low, ...high]);
  if (lowPoints.length === 0 || highPoints.length === 0) return null;
  const top = highPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
  const bottom = [...lowPoints]
    .reverse()
    .map((point) => `L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
  return `${top} ${bottom} Z`;
}

function chartPoints(
  values: number[],
  domainValues: number[] = values,
): Array<{ x: number; y: number }> {
  if (values.length === 0) return [];
  const finiteDomain = domainValues.filter((value) => Number.isFinite(value));
  const min = Math.min(...finiteDomain);
  const max = Math.max(...finiteDomain);
  const span = max - min || 1;
  const innerH = CHART_H - CHART_PAD * 2;
  const innerW = CHART_W - CHART_PAD * 2;
  return values.map((value, index) => {
    const x =
      values.length === 1
        ? CHART_W / 2
        : CHART_PAD + (index / (values.length - 1)) * innerW;
    const y = CHART_PAD + innerH - ((value - min) / span) * innerH;
    return { x, y };
  });
}
