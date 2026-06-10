import "@/app/(product)/charts-shared.css";

import { Suspense } from "react";

import { ActionQueue } from "@/components/admin/action-queue";
import { ActivityFeed } from "@/components/admin/activity-feed";
import { AdminBrief, type BriefItem } from "@/components/admin/admin-brief";
import { BtcTacticalCard } from "@/components/admin/btc-tactical-card";
import { CommandStrip, type CommandStripCell } from "@/components/admin/command-strip";
import { DashboardToolbar } from "@/components/admin/dashboard-toolbar";
import { ProofStatusCard } from "@/components/admin/proof-status-card";
import { AllocationDonut } from "@/components/dashboard/dashboard-charts";
import { MiningHealthSection } from "@/components/dashboard/mining-health";
import { RiskFrameworkSection } from "@/components/dashboard/risk-framework";
import { TimeseriesSection } from "@/components/dashboard/timeseries-section";
import { ApyRange } from "@/components/ui/apy-range";
import { Card } from "@/components/ui/card";
import { Metric } from "@/components/ui/metric";
import {
  ProvenanceBadge,
  type Provenance,
} from "@/components/ui/provenance-badge";
import { SkeletonCard } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/auth/require-admin";
import { allocationLabelFor, allocationStrokeFor } from "@/lib/allocation-colors";
import { loadAdminOverview } from "@/lib/data/admin-overview";
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

/** Formats a signed USDC delta, e.g. "+$1.2M" / "-$840.0K". */
function signedUsd(n: number): string {
  return `${n >= 0 ? "+" : "-"}${usdCompact.format(Math.abs(n))}`;
}

interface DashboardPageProps {
  searchParams: Promise<{ mode?: string; vault?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  await requireAdmin();
  const params = await searchParams;
  const mode: "simple" | "advanced" =
    params.mode === "advanced" ? "advanced" : "simple";
  const requestedVault = params.vault;

  const [data, risk, allVaultRefs, overview] = await Promise.all([
    loadDashboardData(requestedVault),
    loadRiskFramework(),
    listAllVaults({ status: "live-or-paused" }),
    loadAdminOverview(),
  ]);
  const { vault, vaultMeta } = data;
  const preview = vaultMeta.livePreview;

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

  // ── Headline APY (engine preset for preview vaults, live band otherwise) ──
  const headlineApy = preview ? vaultMeta.apyTarget : vault.apyRange;
  const apyMid = (headlineApy.low + headlineApy.high) / 2;
  const targetLow = vaultMeta.apyTarget.low;
  const targetHigh = vaultMeta.apyTarget.high;
  const yieldPosture =
    apyMid < targetLow
      ? "below target band"
      : apyMid > targetHigh
        ? "above target band"
        : "within target band";
  const yieldWithin = yieldPosture === "within target band";

  // ── Capital posture (custody reserves when scope pinned, else snapshot AUM) ──
  const { custodyConfigured, custodyReservesUsdc, custodyProvenance } =
    overview.proof;
  const useCustody = custodyConfigured && custodyReservesUsdc > 0;
  const aumNumeric = useCustody ? custodyReservesUsdc : vault.aumUsdc;
  const capitalProvenance: Provenance = preview
    ? "estimated"
    : useCustody
      ? custodyProvenance
      : data.source === "db"
        ? "live"
        : "estimated";
  const aumSublabel = useCustody
    ? "USDC reserves · Fireblocks"
    : vault.delta30dUsdc !== 0
      ? `${signedUsd(vault.delta30dUsdc)} (30d)`
      : "Fireblocks scope not pinned";

  // ── Platform status ──
  const platformLive = data.source === "db";
  const platformValue = platformLive
    ? "Live"
    : data.source === "partial"
      ? "Partial"
      : "No data";
  const platformProvenance: Provenance = platformLive ? "live" : "partial";

  // ── Proof posture ──
  const proofFresh =
    overview.proof.miningFreshness === "live" &&
    overview.proof.attestationsCount > 0;
  const proofValue = proofFresh
    ? "Current"
    : overview.proof.attestationsCount > 0
      ? "Stale"
      : "Pending";
  const proofSub = overview.proof.lastMiningAttestationAt
    ? `Last ${dateFmt.format(overview.proof.lastMiningAttestationAt)}`
    : "No attestation yet";

  // Risk inputs are a methodology composite, never a live feed — always estimated.
  const riskProvenance: Provenance = "estimated";

  const commandCells: CommandStripCell[] = [
    {
      label: "Platform",
      value: platformValue,
      sublabel: platformLive ? "All feeds nominal" : "Some feeds on fallback",
      provenance: platformProvenance,
      tooltip:
        "Live when every dashboard feed resolved from real rows; Partial when one or more degraded to a methodology fallback.",
    },
    {
      label: "Capital deployed",
      value: usdCompact.format(aumNumeric),
      sublabel: preview ? "Yield timeline · preview" : aumSublabel,
      provenance: capitalProvenance,
      tooltip:
        "Assets under management — USDC reserves under custody when the Fireblocks scope is pinned, otherwise the latest vault snapshot AUM.",
    },
    {
      label: "Yield posture",
      value: <ApyRange low={headlineApy.low} high={headlineApy.high} precision={1} />,
      sublabel: preview ? "methodology preset · preview" : yieldPosture,
      provenance: "estimated",
      tooltip: `Forward 12m projected APY range vs the ${targetLow.toFixed(1)}–${targetHigh.toFixed(1)}% methodology target band. Not guaranteed.`,
    },
    {
      label: "Risk posture",
      value: (
        <span className="tabular">
          {vault.riskScore}
          <span className="ml-1 text-micro font-medium opacity-80 ct-text-faint">
            /100
          </span>
        </span>
      ),
      sublabel: risk.bandLabel,
      provenance: riskProvenance,
      tooltip:
        "Composite risk score (Market, Mining, Liquidity, Smart Contract, Counterparty). Lower = lower risk.",
    },
    {
      label: "Proof status",
      value: proofValue,
      sublabel: proofSub,
      provenance: proofFresh ? "attested" : "stale",
      tooltip:
        "Current when the latest mining attestation is within its 35-day freshness window; Pending when none is on file.",
    },
    {
      label: "Action required",
      value: <span className="tabular">{overview.totalActionRequired}</span>,
      sublabel:
        overview.totalActionRequired > 0 ? "items to review" : "queue clear",
      provenance: "manual",
      tooltip:
        "Open items across KYC, distributions, subscription documents and governance that need an admin decision.",
    },
  ];

  // ── Admin brief — honest readout from real signals (priority order, max 5) ──
  const briefItems: BriefItem[] = [];

  briefItems.push(
    overview.totalActionRequired > 0
      ? {
          tone: "attention",
          text: `${overview.totalActionRequired} item${overview.totalActionRequired > 1 ? "s" : ""} await admin action across KYC, distributions, documents and governance.`,
        }
      : {
          tone: "positive",
          text: "No items awaiting admin action — the queue is clear.",
        },
  );

  briefItems.push({
    tone:
      risk.band === "low"
        ? "positive"
        : risk.band === "high"
          ? "attention"
          : "neutral",
    text: `Composite risk holds at ${risk.composite}/100 — ${risk.bandLabel} band.`,
  });

  briefItems.push({
    tone: yieldWithin ? "positive" : "attention",
    text: `Projected APY band ${headlineApy.low.toFixed(1)}–${headlineApy.high.toFixed(1)}% — ${yieldPosture}.`,
  });

  briefItems.push(
    vault.delta30dUsdc !== 0
      ? {
          tone: vault.delta30dUsdc > 0 ? "positive" : "attention",
          text: `Capital ${vault.delta30dUsdc > 0 ? "grew" : "contracted"} ${signedUsd(vault.delta30dUsdc)} over the trailing 30 days.`,
        }
      : {
          tone: "neutral",
          text: "Capital held flat over the trailing window — no net subscription or redemption recorded.",
        },
  );

  briefItems.push(
    proofFresh
      ? {
          tone: "positive",
          text: `Mining evidence is current — ${overview.proof.attestationsCount} attestation${overview.proof.attestationsCount > 1 ? "s" : ""} on file.`,
        }
      : {
          tone: "attention",
          text: overview.proof.lastMiningAttestationAt
            ? "Latest mining attestation is past its freshness window — refresh evidence."
            : "No mining attestation on file yet — evidence pending.",
        },
  );

  return (
    <div className="flex flex-col gap-12 relative">
      {/* Ambient glow for the dashboard */}
      <div
        aria-hidden="true"
        className="absolute -inset-20 z-0 pointer-events-none overflow-hidden"
      >
        <div className="dash-ambient-orb dash-ambient-orb--primary" />
        <div className="dash-ambient-orb dash-ambient-orb--secondary" />
      </div>

      <div className="relative z-10">
        <DashboardToolbar
          vaultName={vaultMeta.name}
          vaultId={vaultMeta.id}
          vaultIsPreset={preview}
          mode={mode}
          vaultOptions={vaultOptions}
        />
      </div>

      {preview ? (
        <Card className="relative z-10 border-[var(--ct-status-warning-border)] ct-status-warning-bg/20">
          <div className="flex items-center gap-3">
            <span className="text-micro font-bold uppercase tracking-widest ct-status-warning">
              Per-vault live snapshot pending
            </span>
            <ProvenanceBadge kind="estimated" />
          </div>
          <p className="mt-3 body-sm ct-text-muted max-w-3xl">
            {vaultMeta.name} live KPIs (capital, risk, yield) land with the Phase 3
            multi-vault schema. Capital and yield below are the {vaultMeta.name}
            methodology preset — the action queue and proof status remain live and
            platform-wide.
          </p>
        </Card>
      ) : null}

      {/* Zone 1 — Executive command strip */}
      <section aria-label="Executive command strip" className="relative z-10">
        <CommandStrip cells={commandCells} />
      </section>

      {/* Zone 2 — Admin brief */}
      <section aria-label="Admin brief" className="relative z-10">
        <AdminBrief items={briefItems} />
      </section>

      {/* Zone 3 — Capital & Yield */}
      <section
        aria-label="Capital and yield"
        className="flex flex-col gap-6 relative z-10 border-t border-[var(--ct-border-soft)] pt-12"
      >
        <SectionHeader
          title="Capital & Yield"
          subtitle="Net asset value and projected APY band, trailing 30 days."
          provenance={data.timeseries.source === "fallback" ? "estimated" : "live"}
        />
        <TimeseriesSection data={data.timeseries} />

        <div className="grid items-start grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 flex flex-col">
            <Card
              className={cn("flex flex-col", allocSegments.length > 0 && "h-full")}
              aria-label="Allocation breakdown"
            >
              <div className="dash-label relative z-10">
                <span className="text-micro font-bold uppercase tracking-widest ct-text-muted">
                  Capital allocation
                </span>
                {/* Never claim "Live" over an empty/fallback allocation. */}
                <ProvenanceBadge kind={allocSegments.length === 0 ? "stale" : "live"} />
              </div>

              {allocSegments.length === 0 ? (
                <p className="mt-4 body-sm ct-text-muted italic">
                  No allocation data yet.
                </p>
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
                          <span className="ct-text-body">
                            {allocationLabelFor(s.bucket)}
                          </span>
                        </span>
                        <span className="tabular ct-text-muted font-medium">
                          {s.pct.toFixed(0)}% · {usdCompact.format(s.valueUsdc)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          </div>

          <div className="lg:col-span-7 flex flex-col h-full">
            <BtcTacticalCard data={data} />
          </div>
        </div>
      </section>

      {/* Zone 4 — Risk & Stress */}
      <section
        aria-label="Risk and stress"
        className="flex flex-col gap-6 relative z-10 border-t border-[var(--ct-border-soft)] pt-12"
      >
        <SectionHeader
          title="Risk & Stress"
          subtitle="Risk attribution by dimension, with the bear-scenario stressed return."
          aside={
            <StressInline
              low={vault.stressedApyRange.low}
              high={vault.stressedApyRange.high}
            />
          }
        />
        <RiskFrameworkSection data={risk} view="bars" />
      </section>

      {/* Zone 5 — Proof, Mining & Evidence */}
      <section
        aria-label="Proof, mining and evidence"
        className="flex flex-col gap-6 relative z-10 border-t border-[var(--ct-border-soft)] pt-12"
      >
        <SectionHeader
          title="Proof, Mining & Evidence"
          subtitle="Operational mining health and audit-ready attestation status."
          provenance={proofFresh ? "attested" : "stale"}
        />
        <div className="grid items-start grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7">
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
          <div className="lg:col-span-5">
            <ProofStatusCard proof={overview.proof} />
          </div>
        </div>
      </section>

      {/* Zone 6 — Investor operations */}
      <section
        aria-label="Investor operations"
        className="flex flex-col gap-6 relative z-10 border-t border-[var(--ct-border-soft)] pt-12"
      >
        <SectionHeader
          title="Investor Operations"
          subtitle="What needs an admin decision next, and the latest engine activity."
          provenance="live"
        />
        <div className="grid items-start grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 h-full">
            <ActionQueue
              items={overview.actions}
              totalActionRequired={overview.totalActionRequired}
            />
          </div>
          <div className="lg:col-span-7 h-full">
            <ActivityFeed events={data.recentEvents} />
          </div>
        </div>
      </section>

      {/* Zone 7 — Advanced metrics (opt-in, live vault only) */}
      {mode === "advanced" && !preview ? (
        <section
          aria-label="Advanced metrics"
          className="flex flex-col gap-6 relative z-10 border-t border-[var(--ct-border-soft)] pt-12"
        >
          <Suspense fallback={<SkeletonCard />}>
            <AdvancedMetricsSection />
          </Suspense>
        </section>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section header — strong title + explanatory subtitle + optional provenance.
// ---------------------------------------------------------------------------

function SectionHeader({
  title,
  subtitle,
  provenance,
  aside,
}: {
  title: string;
  subtitle: string;
  provenance?: Provenance;
  /** Right-aligned content (e.g. a compact stat). Takes precedence over `provenance`. */
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="h2">{title}</h2>
        <p className="body-sm ct-text-muted">{subtitle}</p>
      </div>
      {aside ?? (provenance ? <ProvenanceBadge kind={provenance} /> : null)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stress posture — compact bear-scenario stressed APY range (always a range, #1).
// Lives in the Risk section header (no standalone empty card).
// ---------------------------------------------------------------------------

function StressInline({ low, high }: { low: number; high: number }) {
  return (
    <div
      className="flex shrink-0 items-center gap-3"
      title="Stressed return under the combined Bear scenario (BTC −40% · hashprice −30% · ±15% band). Conditional projection — not guaranteed. Methodology v1.0."
    >
      <div className="flex flex-col items-end gap-0.5">
        <span className="stat-label ct-text-muted">Stressed APY · Bear</span>
        <ApyRange
          className="text-lg font-semibold leading-none ct-text-strong"
          low={low}
          high={high}
          precision={1}
        />
      </div>
      <ProvenanceBadge kind="estimated" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Advanced metrics — institutional ratios. Hidden behind ?mode=advanced.
// ---------------------------------------------------------------------------

async function AdvancedMetricsSection() {
  const m = await loadAdvancedMetrics();
  const provenance: Provenance = m.provenance === "estimated" ? "estimated" : "partial";

  const pct1 = new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  return (
    <>
      <SectionHeader
        title="Advanced Metrics"
        subtitle="Institutional risk-adjusted ratios from the trailing NAV series."
        provenance={provenance}
      />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 items-start">
        <Metric
          variant="dashboard"
          label="Sharpe"
          provenance={provenance}
          value={m.available ? m.sharpe.toFixed(2) : "—"}
          sublabel={m.available ? `${m.monthsUsed} months` : "Insufficient history"}
          tooltip="Sharpe ratio: excess return per unit of total volatility. Methodology v1.0."
        />
        <Metric
          variant="dashboard"
          label="Sortino"
          provenance={provenance}
          value={m.available ? m.sortino.toFixed(2) : "—"}
          sublabel={m.available ? `${m.monthsUsed} months` : "Insufficient history"}
          tooltip="Sortino ratio: excess return per unit of downside volatility."
        />
        <Metric
          variant="dashboard"
          label="VaR 95%"
          provenance={provenance}
          value={m.available ? pct1.format(m.varDecimal) : "—"}
          sublabel="Monthly, 95% confidence"
          tooltip="Value-at-Risk at 95% confidence over a one-month horizon."
        />
        <Metric
          variant="dashboard"
          label="Max drawdown"
          provenance={provenance}
          value={m.available ? pct1.format(m.maxDrawdownDecimal) : "—"}
          sublabel="Peak-to-trough"
          tooltip="Largest peak-to-trough decline in the available NAV series."
        />
      </div>

      <Card>
        <div className="dash-label relative z-10">
          <span className="text-micro font-bold uppercase tracking-widest ct-text-muted">
            DeFi positions &amp; fee accrual
          </span>
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
        <p className="mt-auto pt-6 body-xs ct-text-faint italic leading-[var(--ct-leading-relaxed)] opacity-70 relative z-10">
          Estimated from methodology v1.0 anchors. Conditional projection — not guaranteed.
        </p>
      </Card>
    </>
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
