import "@/app/(product)/charts-shared.css";

import { Suspense } from "react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ActivityFeed } from "@/components/admin/activity-feed";
import { AdvancedModeToggle } from "@/components/admin/advanced-mode-toggle";
import { BtcTacticalCard } from "@/components/admin/btc-tactical-card";
import { VaultSelector } from "@/components/admin/vault-selector";
import { AllocationDonut } from "@/components/dashboard/dashboard-charts";
import { MiningHealthSection } from "@/components/dashboard/mining-health";
import { RiskFrameworkSection } from "@/components/dashboard/risk-framework";
import { ApyRange } from "@/components/ui/apy-range";
import { Metric } from "@/components/ui/metric";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { SkeletonCard } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/auth/require-admin";
import { allocationLabelFor, allocationStrokeFor } from "@/lib/allocation-colors";
import { loadCustody } from "@/lib/data/custody";
import { loadAdvancedMetrics } from "@/lib/data/advanced-metrics";
import { loadDashboardData } from "@/lib/data/dashboard";
import { loadRiskFramework } from "@/lib/data/risk-framework";
import { listAllVaults } from "@/lib/vaults/resolver";
import { vaultSlug, vaultLabel } from "@/lib/vaults/slug";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

const usdCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

// ---------------------------------------------------------------------------
// Yield source breakdown — methodology v1.0 target contributions. Estimated
interface DashboardPageProps {
  searchParams: Promise<{ mode?: string; vault?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  await requireAdmin();
  const params = await searchParams;
  const mode: "simple" | "advanced" =
    params.mode === "advanced" ? "advanced" : "simple";
  const requestedVault = params.vault;

  const [data, custody, risk, allVaultRefs] = await Promise.all([
    loadDashboardData(requestedVault),
    loadCustody(),
    loadRiskFramework(),
    listAllVaults({ status: "live-or-paused" }),
  ]);
  const { vault, vaultMeta } = data;

  // Selector catalog = 3 engine fixtures + every live/paused VaultDeployment
  // wired through the resolver. Surfaces wizard-created vaults in the rail
  // (resolves the schism between Prisma deployments and engine fixtures).
  const vaultOptions = allVaultRefs.map((ref) => ({
    id: vaultSlug(ref),
    label: vaultLabel(ref),
  }));

  // Donut segments — canonical SVG convention (C=100): dashArray = pct, offset
  // is the running cumulative so each arc starts where the previous ended.
  const allocSegments = data.allocations.map((a, i) => ({
    bucket: a.bucket,
    pct: a.pct,
    valueUsdc: a.valueUsdc,
    dashArray: `${a.pct} ${100 - a.pct}`,
    dashOffset: -data.allocations
      .slice(0, i)
      .reduce((sum, prev) => sum + prev.pct, 0),
  }));

  // Risk score band label — re-using the same compositeBand semantics surfaced
  // by `loadRiskFramework()` keeps the hero and the framework section aligned.
  const riskBandLabel = risk.bandLabel;

  // Next distribution: derive from latestDistribution.paid_at when available;
  // otherwise fall back to a "—" placeholder. We never fabricate a date.
  const nextDist = data.latestDistribution;
  const nextDistLabel =
    nextDist.paid_at !== null ? dateFmt.format(nextDist.paid_at) : "—";
  const nextDistAmount =
    nextDist.amount_usdc > 0
      ? `~${usdCompact.format(nextDist.amount_usdc)}`
      : nextDist.status;

  // 30d AUM delta sublabel for the AUM card.
  const aumSublabel =
    custody.configured
      ? "USDC reserves · Fireblocks"
      : vault.delta30dUsdc !== 0
        ? `${vault.delta30dUsdc >= 0 ? "+" : ""}${usdCompact.format(vault.delta30dUsdc)} (30d)`
        : "Fireblocks scope not pinned";

  // Vault APY range shown in the hero — ALWAYS from the engine preset for the
  // selected vault. ADR-006 #9: when live snapshots are not yet per-vault, we
  // surface the vault's OWN apy target instead of reusing the Yield snapshot's
  // numbers. For Yield itself the snapshot range and the engine range converge
  // once the seeded data is in sync.
  const headlineApy = vaultMeta.livePreview
    ? vaultMeta.apyTarget
    : vault.apyRange;

  return (
    <div className="flex flex-col h-full min-h-120 gap-12 relative">
      {/* Ambient glow for the dashboard */}
      <div aria-hidden="true" className="absolute -inset-20 z-0 pointer-events-none overflow-hidden">
        <div style={{
          position: "absolute", borderRadius: "50%",
          width: "60vw", height: "60vw",
          top: "20%", left: "30%",
          transform: "translate(-50%, -50%)",
          background: "var(--ct-accent)", filter: "blur(150px)", opacity: 0.04,
        }} />
        <div style={{
          position: "absolute", borderRadius: "50%",
          width: "50vw", height: "50vw",
          bottom: "10%", right: "10%",
          transform: "translate(50%, 50%)",
          background: "var(--ct-accent)", filter: "blur(130px)", opacity: 0.03,
        }} />
      </div>

      <div className="flex flex-col gap-6 relative z-10">
        <AdminPageHeader
          title="Dashboard"
          actions={
            <div className="flex flex-wrap items-center gap-3 relative z-10">
              <VaultSelector
                active={vaultMeta.id}
                options={vaultOptions}
                preserveParams={
                  mode === "advanced" ? { mode: "advanced" } : undefined
                }
              />
              <AdvancedModeToggle active={mode} />
            </div>
          }
        />

        <div className="flex flex-wrap items-baseline justify-between gap-3 relative z-10">
          <h2 className="text-xl font-light tracking-tight text-[var(--ct-text-primary)]">
            <span className="font-semibold text-[var(--ct-text-strong)]">{vaultMeta.name}</span>
            <span className="ml-2 text-micro font-bold uppercase tracking-widest text-[var(--ct-text-muted)] opacity-50">Vault Overview</span>
          </h2>
        </div>
      </div>

      {/* Section 1 — Hero (Overview & History) */}
      <section aria-label="Vault overview" className="flex flex-col gap-6 relative z-10">
        <div className="shrink-0">
          {vaultMeta.livePreview ? (
            <div className="dash-cell dash-cell-premium border-[var(--ct-status-warning-border)] bg-[var(--ct-status-warning-soft)]/20 p-8">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-micro font-bold uppercase tracking-widest text-[var(--ct-status-warning)]">
                  Per-vault live snapshot pending
                </span>
                <ProvenanceBadge kind="estimated" />
              </div>
              <p className="body-sm text-[var(--ct-text-muted)] max-w-3xl">
                {vaultMeta.name} live KPIs (AUM, risk score, mining margin,
                stressed APY) land with Phase 3 multi-vault DB schema. The numbers
                below are the {vaultMeta.name} methodology preset only — not the
                Hearst Yield Vault timeline relabelled.
              </p>
              <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <Metric
                  label="APY range"
                  provenance="estimated"
                  value={
                    <ApyRange
                      low={headlineApy.low}
                      high={headlineApy.high}
                      precision={1}
                    />
                  }
                  sublabel={`${vaultMeta.name} · methodology preset`}
                />
                <Metric
                  label="Next distribution"
                  provenance="estimated"
                  value={<span className="text-2xl tracking-tight">{nextDistLabel}</span>}
                  sublabel={nextDistAmount}
                />
              </div>
            </div>
          ) : (
            // Container-responsive: cards wrap to fewer columns when the centre
            // panel narrows (e.g. chat rail open) instead of clipping badges and
            // KPI units. auto-fit collapses empty tracks so 5 cards always fill
            // the row. min 200px keeps the longest header ("Next distribution" +
            // provenance badge) inside its card.
            <div className="grid gap-6 grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))]">
              <Metric
                label="AUM"
                provenance={custody.provenance}
                value={usdCompact.format(
                  custody.configured && custody.totalUsdcReserves > 0
                    ? custody.totalUsdcReserves
                    : vault.aumUsdc,
                )}
                sublabel={aumSublabel}
                tooltip="Assets Under Management. Total USDC equivalent of all vault holdings, marked to market."
              />
              <Metric
                label="APY range"
                provenance="estimated"
                value={
                  <ApyRange
                    low={headlineApy.low}
                    high={headlineApy.high}
                    precision={1}
                  />
                }
                sublabel="forward 12m · conditional"
                tooltip={`Forward 12m projected APY range for ${vaultMeta.name}, sourced from its methodology preset (allocation targets × asset-class yield assumptions). Not guaranteed. Methodology v1.0.`}
              />
              <Metric
                label="Stressed APY"
                provenance="estimated"
                value={
                  <ApyRange
                    low={vault.stressedApyRange.low}
                    high={vault.stressedApyRange.high}
                    precision={1}
                  />
                }
                sublabel="Bear + mining compression"
                tooltip="Projected APY under combined Bear scenario (BTC −40%, hashprice −30%). Conditional projection. Range = ±15% of the projection bear (méthodologie v1.0)."
              />
              <Metric
                label="Risk score"
                provenance="estimated"
                value={
                  <span className="tabular">
                    {vault.riskScore}
                    <span className="text-[0.6em] font-medium opacity-80 ml-1 text-[var(--ct-text-faint)]">
                      /100
                    </span>
                  </span>
                }
                sublabel={riskBandLabel}
                tooltip="Composite score (Market, Mining, Liquidity, Smart Contract, Counterparty). Lower = lower risk."
              />
              <Metric
                label="Next distribution"
                provenance="estimated"
                value={<span className="text-2xl tracking-tight">{nextDistLabel}</span>}
                sublabel={nextDistAmount}
                tooltip="Next monthly USDC distribution. Estimate from current mining margin + base yield accrual."
              />
            </div>
          )}
        </div>

      </section>

      {/* Section 2 — Engine & Allocation */}
      <section className="flex flex-col gap-6 relative z-10 border-t border-[var(--ct-border-soft)] pt-12">
        <div className="grid items-start grid-cols-1 lg:grid-cols-12 gap-6 shrink-0">
          <div className={cn("lg:col-span-4 flex flex-col", allocSegments.length > 0 && "h-full")}>
            <article className={cn("dash-cell dash-cell-premium flex flex-col p-6", allocSegments.length > 0 && "h-full")} aria-label="Allocation breakdown">
              <div className="dash-label relative z-10">
                <span className="text-micro font-bold uppercase tracking-widest text-[var(--ct-text-muted)]">Allocation breakdown</span>
                {/* A3 — never claim "Live" over an empty/fallback allocation. */}
                <ProvenanceBadge kind={allocSegments.length === 0 ? "stale" : "live"} />
              </div>

              {allocSegments.length === 0 ? (
                <p className="mt-4 body-sm text-[var(--ct-text-muted)] italic">No allocation data yet.</p>
              ) : (
                <div className="flex flex-col gap-8 mt-6 flex-1 relative z-10">
                  <div className="h-48 w-48 mx-auto shrink-0">
                    <AllocationDonut
                      segments={allocSegments}
                      ariaLabel="Allocation breakdown by bucket"
                    />
                  </div>
                  <ul className="flex flex-col gap-3">
                    {allocSegments.map((s) => (
                      <li
                        key={s.bucket}
                        className="flex items-center justify-between gap-3 body-sm"
                      >
                        <span className="flex items-center gap-2">
                          <span
                            aria-hidden
                            className="inline-block h-2 w-2 shrink-0 rounded-full"
                            style={{ background: allocationStrokeFor(s.bucket) }}
                          />
                          <span className="text-[var(--ct-text-body)]">{allocationLabelFor(s.bucket)}</span>
                        </span>
                        <span className="tabular text-[var(--ct-text-muted)] font-medium">
                          {s.pct.toFixed(0)}% · {usdCompact.format(s.valueUsdc)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          </div>

          <div className="lg:col-span-8 flex flex-col h-full">
            <Suspense fallback={<SkeletonCard />}>
              <MiningHealthSection
                miningHealth={{
                  marginScore: vault.miningMarginScore,
                  hashpriceTrendPct: data.hashpriceTrendPct,
                  opConfidence: data.operationalConfidence,
                  provenance: data.source === "db" ? "live" : "estimated",
                }}
                hashprice={
                  data.miningOps.hashprice
                    ? {
                        usd_per_th_day: data.miningOps.hashprice.usd_per_th_day,
                        stale: data.miningOps.hashprice.stale,
                      }
                    : null
                }
              />
            </Suspense>
          </div>
        </div>
      </section>

      {/* Section 3 — Risk & Tactical */}
      <section className="flex flex-col gap-6 relative z-10 border-t border-[var(--ct-border-soft)] pt-12">
        <div className="grid items-start grid-cols-1 lg:grid-cols-2 gap-6 shrink-0">
          <div className="h-full">
            <RiskFrameworkSection data={risk} />
          </div>
          <div className="h-full">
            <BtcTacticalCard data={data} />
          </div>
        </div>
      </section>

      {/* Section 4 — Activity & Advanced */}
      <section className="flex flex-col gap-6 relative z-10 border-t border-[var(--ct-border-soft)] pt-12">
        <div className="w-full shrink-0">
          <ActivityFeed events={data.recentEvents} />
        </div>

        {mode === "advanced" && !vaultMeta.livePreview ? (
          <div className="w-full shrink-0">
            <Suspense
              fallback={
                <section aria-label="Advanced metrics">
                  <SkeletonCard />
                </section>
              }
            >
              <AdvancedMetricsSection />
            </Suspense>
          </div>
        ) : null}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Advanced metrics — institutional ratios. Hidden behind ?mode=advanced.
// ---------------------------------------------------------------------------

async function AdvancedMetricsSection() {
  const m = await loadAdvancedMetrics();
  const provenance = m.provenance === "estimated" ? "estimated" : "partial";

  const pct1 = new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  return (
    <section aria-label="Advanced metrics" className="space-y-6 relative z-10">
      <div className="flex items-center gap-3">
        <span className="text-micro font-bold uppercase tracking-widest text-[var(--ct-text-muted)]">Advanced metrics</span>
        <div className="h-px flex-1 bg-[var(--ct-border-soft)]/50" />
      </div>

      <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,190px),1fr))]">
        <Metric
          label="Sharpe"
          provenance={provenance}
          value={m.available ? m.sharpe.toFixed(2) : "—"}
          sublabel={m.available ? `${m.monthsUsed} months` : "Insufficient history"}
          tooltip="Sharpe ratio: excess return per unit of total volatility. Methodology v1.0."
        />
        <Metric
          label="Sortino"
          provenance={provenance}
          value={m.available ? m.sortino.toFixed(2) : "—"}
          sublabel={m.available ? `${m.monthsUsed} months` : "Insufficient history"}
          tooltip="Sortino ratio: excess return per unit of downside volatility."
        />
        <Metric
          label="VaR 95%"
          provenance={provenance}
          value={m.available ? pct1.format(m.varDecimal) : "—"}
          sublabel="Monthly, 95% confidence"
          tooltip="Value-at-Risk at 95% confidence over a one-month horizon."
        />
        <Metric
          label="Max drawdown"
          provenance={provenance}
          value={m.available ? pct1.format(m.maxDrawdownDecimal) : "—"}
          sublabel="Peak-to-trough"
          tooltip="Largest peak-to-trough decline in the available NAV series."
        />
      </div>

      <article className="dash-cell dash-cell-premium">
        <div className="dash-label relative z-10">
          <span className="text-micro font-bold uppercase tracking-widest text-[var(--ct-text-muted)]">DeFi positions &amp; fee accrual</span>
        </div>
        <ul className="flex flex-col mt-6 relative z-10 divide-y divide-[var(--ct-border-soft)]/50">
          <DefiRow
            label="Top DeFi positions"
            tooltip="On-chain DeFi position discovery pending; live feed lands with Phase 3 vault."
          >
            <PendingValue />
          </DefiRow>
          <DefiRow
            label="Fee accrual MTD"
            tooltip="Fee accrual table pending; daily accrual rolled into next distribution."
          >
            <PendingValue />
          </DefiRow>
          <DefiRow
            label="NAV per share"
            tooltip="Share supply pending Phase 3 vault deployment."
          >
            <PendingValue />
          </DefiRow>
        </ul>
        <p className="mt-auto pt-6 body-xs text-[var(--ct-text-faint)] italic leading-[var(--ct-leading-relaxed)] opacity-70 relative z-10">
          Estimated from methodology v1.0 anchors. Conditional projection — not guaranteed.
        </p>
      </article>
    </section>
  );
}

interface DefiRowProps {
  label: string;
  tooltip?: string;
  children: React.ReactNode;
}

function DefiRow({ label, tooltip, children }: DefiRowProps) {
  return (
    <li className="flex items-baseline justify-between gap-3 py-2.5 first:pt-0 last:pb-0 border-t border-[var(--ct-border-soft)] first:border-t-0">
      <span className="body-sm ct-text-muted" title={tooltip}>
        {label}
      </span>
      <span className="body-sm ct-text-strong tabular text-right inline-flex items-baseline gap-2">
        {children}
      </span>
    </li>
  );
}

function PendingValue() {
  return (
    <>
      <span className="ct-text-muted">—</span>
      <ProvenanceBadge kind="manual" />
    </>
  );
}

