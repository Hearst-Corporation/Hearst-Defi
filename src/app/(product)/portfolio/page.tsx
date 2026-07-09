/**
 * /portfolio — the investor's REAL RICH V4 vault-health console.
 *
 * Same cockpit composition as /portfolio/preview (console access ribbon → ONE
 * shadowed hero → acts opened by titled hairline dividers → advisory feed → exit
 * + projection → one footer disclaimer), but wired end-to-end on the signed-in
 * investor's own persisted data via `loadPortfolioCockpit` — NOT the sandbox
 * mock (this page imports NONE of ./preview/_data). It starts at ZERO (no
 * position) and fills in after the first subscription.
 *
 * THREE HONESTY TIERS, each carried on its own badge:
 *   • REAL      — deposit, deployed value, accrued, yield paid, NAV history,
 *                 distributions, lock-up, status, APY range, take-profit progress.
 *   • ESTIMATED — DERIVED from the real deposit, labelled "target allocation":
 *                 the 3 pockets (40/37/23), collateral, safety margin.
 *   • PILOT     — operational figures with no attested source yet (mining
 *                 production, hashrate, uptime, efficiency, risk, agent signals,
 *                 orchestration). Illustrative sample values, ALWAYS badged
 *                 Estimated/Simulated + "pilot — awaiting attested feed". A Data
 *                 Quality advisory row states this plainly. At zero → empty.
 *
 * No fabricated Live badge, no flat degenerate NAV curve (guarded when the series
 * has <2 distinct days). Token-only (--ct-*), changes none. The V4 charts under
 * ./preview/_charts/* are data-agnostic and reused directly.
 */
import Link from "next/link";
import type { ReactNode } from "react";

import { ApyRange } from "@/components/catalyst/apy-range";
import { HcBarChart, HcValueChart } from "@/components/dataviz/his";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { getSession } from "@/lib/auth/session";
import { loadPortfolioCockpit } from "@/lib/data/portfolio-cockpit";
import { isDemoAccount } from "@/lib/demo/allowlist";
import {
  formatUsdDetailed,
  formatUsdFull,
} from "@/lib/vaults/product-display";

import "./preview/_styles.css";
import { AdvisoryFeed } from "./preview/_charts/advisory-feed";
import { AgentCanvas } from "./preview/_charts/agent-canvas";
import { AssetBadge } from "./preview/_charts/asset-badge";
import { AssetRing } from "./preview/_charts/asset-ring";
import { HcBullet } from "./preview/_charts/bullet";
import { ExitPaths } from "./preview/_charts/exit-paths";
import { HcHonestFan } from "./preview/_charts/honest-fan";
import { HcMeter } from "./preview/_charts/meter";
import { PocketCards } from "./preview/_charts/pocket-cards";
import { HcProductionBars } from "./preview/_charts/production-bars";
import { HcRiskDimensions } from "./preview/_charts/risk-dimensions";
import { StatBand } from "./preview/_charts/stat-band";
import { HcUptimeBand, orderedUptime } from "./preview/_charts/uptime-band";
import { ASSET_COLOR, POCKET_ASSET } from "./preview/_data/brand";
import { DemoTimelineControl } from "./demo-timeline-control";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Portfolio",
  description:
    "Your Hearst Yield Vault position — vault health, pockets, yield, NAV history and advisory.",
};

/** Bare-hairline support surface (no shadow — the chrome budget reserves elevation for the hero). */
const SUPPORT =
  "rounded-2xl border border-[var(--ct-border)] bg-surface-card overflow-hidden";
const HERO_SHADOW = "var(--ct-shadow-depth), var(--ct-glass-bevel-subtle)";

/**
 * Tooltip for the pockets / collateral / safety badges. They carry the
 * "estimated" chrome, but they are a DETERMINISTIC target split of the real
 * deposit — NOT a forward projection. This override keeps the honesty tier
 * honest (the default "estimated" copy would wrongly say "projection").
 */
const DERIVED_ALLOCATION_TIP =
  "Derived — target allocation computed deterministically from your real deposit, not a forward projection.";

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--ct-border-soft)] bg-[var(--ct-surface-inset)] px-2 py-0.5">
      <span className="ct-bento-label">{label}</span>
      <span className="text-[length:var(--ct-text-xs)] ct-text-strong tabular-nums">
        {value}
      </span>
    </span>
  );
}

/** Titled hairline divider — opens an act without boxing it in a card. */
function TitledDivider({ title, trailing }: { title: string; trailing?: ReactNode }) {
  return (
    <div className="flex items-center gap-4 pt-2">
      <h2 className="ct-section-title shrink-0">{title}</h2>
      <span
        aria-hidden="true"
        className="h-px flex-1"
        style={{ background: "var(--ct-border-soft)" }}
      />
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}

function CardHeader({ title, trailing }: { title: string; trailing?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--ct-border-soft)] px-5 py-4">
      <span className="ct-bento-label">{title}</span>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}

const DISTRIB_DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const MONTH_YEAR = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});

export default async function PortfolioPage() {
  const [d, session] = await Promise.all([loadPortfolioCockpit(), getSession()]);
  const isDemo = isDemoAccount(session?.email);

  // ── FULL COCKPIT — ONE render path for EVERY state (zero → funded → matured) ─
  // At zero the loader (emptyCockpit) returns the same full view-model with REAL
  // figures at $0, empty real history, and the same Simulated-badged PILOT tiers
  // the funded view shows. No stripped empty card: an investor without a deposit
  // sees the complete console filled with zero / pending values, so they can read
  // exactly what they'll get after subscribing. `hasPosition` only toggles honesty
  // details (Subscribe CTA + "not funded yet" note vs the Active pulse / NAV curve).
  const zero = !d.hasPosition;
  const hasApy = d.apyLow !== null && d.apyHigh !== null;
  const yieldBars =
    d.yieldHistory?.months
      .filter((m) => m.status !== "projected")
      .map((m) => ({
        label: MONTH_YEAR.format(new Date(m.monthMs)),
        value: m.realizedUsdc,
      })) ?? [];

  // Next-payout range — anchored to the REALIZED run-rate, not the theoretical
  // APY-on-principal figure. Showing an $8k–$16k APY projection next to ~$2.3k
  // months of actually-paid distributions on the SAME chart reads as a 4–6×
  // overstatement. Instead we build a ±15% band around the mean of the months
  // that actually paid, so the projection sits in the same scale as the bars it
  // extends. Falls back to the theoretical APY range only when nothing has been
  // paid yet (no run-rate to observe).
  const paidMonths =
    d.yieldHistory?.months.filter((m) => m.status === "paid" && m.realizedUsdc > 0) ?? [];
  const runRateMean =
    paidMonths.length > 0
      ? paidMonths.reduce((s, m) => s + m.realizedUsdc, 0) / paidMonths.length
      : 0;
  const nextPayout =
    runRateMean > 0
      ? { lo: runRateMean * 0.85, hi: runRateMean * 1.15, basis: "run-rate" as const }
      : d.yieldHistory
        ? { lo: d.yieldHistory.nextPayoutLo, hi: d.yieldHistory.nextPayoutHi, basis: "apy" as const }
        : null;

  // Per-asset ring segments (green / orange / blue) — matches the pocket identity.
  const pocketRing = d.pockets.map((p, i) => ({
    label: p.label,
    value: p.valueUsdc,
    color: ASSET_COLOR[POCKET_ASSET[i] ?? "hearst"],
  }));
  const onlinePct =
    d.uptimeSegments.find((s) => s.cause === "online")?.pct ?? 0;
  const uptimeCauses = orderedUptime(d.uptimeSegments).filter(
    (s) => s.cause !== "online",
  );

  return (
    <div className="dark flex flex-col rounded-2xl bg-surface-page [--gutter:theme(spacing.8)] mb-8">
      <div className="flex flex-col gap-y-8 p-5 lg:p-6">
        {isDemo ? <DemoTimelineControl /> : null}

        {/* S0 — access ribbon (real KYC + share class + APY range) */}
        <div className="flex flex-wrap items-center gap-2">
          <MetaChip label="KYC" value={d.kycStatus ?? "pending"} />
          {d.shareClass ? <MetaChip label="Class" value={d.shareClass} /> : null}
          <MetaChip label="Access" value="B2B · qualified" />
          {hasApy ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--ct-border-soft)] bg-[var(--ct-surface-inset)] px-2 py-0.5">
              <span className="ct-bento-label">Target APY</span>
              <ApyRange
                low={d.apyLow!}
                high={d.apyHigh!}
                className="text-[length:var(--ct-text-xs)] ct-text-strong"
              />
            </span>
          ) : null}
        </div>

        {/* S1 — HERO: the one dominant band (glow + console header + NAV chart + stat band) */}
        <section
          className="relative overflow-hidden rounded-2xl border border-[var(--ct-border)] bg-surface-card"
          style={{ boxShadow: HERO_SHADOW }}
          aria-label="Vault value"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 left-1/4 h-64 w-[min(680px,80%)] opacity-[0.07]"
            style={{
              background:
                "radial-gradient(ellipse at center, var(--ct-accent) 0%, transparent 70%)",
            }}
          />
          <div className="relative z-10 flex flex-col">
            <div className="flex flex-wrap items-start justify-between gap-3 p-5 lg:p-6">
              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="ct-bento-label">Hearst Yield Vault · 1 vault = 1 client</span>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h1 className="h1 shrink-0">
                    Vault <span className="h1-accent">Health</span>
                  </h1>
                  <span className="ct-metric-value text-[length:var(--ct-text-2xl)] tabular-nums">
                    {formatUsdFull(d.deployedValueUsdc)}
                  </span>
                  {!zero ? (
                    <span className="text-[length:var(--ct-text-sm)] font-semibold ct-text-body tabular-nums">
                      {d.totalChangeText}
                    </span>
                  ) : null}
                  {/* The dominant figure is a mark-to-book Estimate — badge it in
                      place so the provenance of the headline number is never
                      ambiguous (non-negotiable #2). */}
                  <ProvenanceBadge kind="estimated" />
                </div>
                {zero ? (
                  <span className="ct-metric-caption text-[length:var(--ct-text-sm)] leading-snug">
                    No capital deployed yet. Your deposit, pockets, yield and NAV
                    history fill in here after your first subscription — the panels
                    below preview what this console will track.
                  </span>
                ) : null}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <MetaChip label="Deposit" value={formatUsdFull(d.depositUsdc)} />
                  <MetaChip
                    label="Take-profit"
                    value={`${d.takeProfitProgressPct}% → +24%`}
                  />
                  {d.positionsCount > 1 ? (
                    <MetaChip label="Positions" value={String(d.positionsCount)} />
                  ) : null}
                </div>
              </div>
              {zero ? (
                <Link
                  href="/vaults"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--ct-accent)] bg-[var(--ct-accent)] px-3.5 py-1.5 text-[length:var(--ct-text-xs)] font-semibold text-[var(--ct-bg-deep)] transition-colors hover:bg-[color-mix(in_srgb,var(--ct-accent)_88%,var(--ct-bg-deep))]"
                >
                  Subscribe to a vault →
                </Link>
              ) : (
                <span
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[length:var(--ct-text-nano)] uppercase tracking-widest ct-text-body"
                  style={{ borderColor: "var(--ct-border-soft)" }}
                >
                  {d.isActive ? (
                    <span
                      aria-hidden="true"
                      className="hyv-pulse inline-block h-1.5 w-1.5 rounded-full"
                      style={{ background: "var(--ct-accent)", color: "var(--ct-accent)" }}
                    />
                  ) : null}
                  {d.isActive ? "Active" : (d.lifecycle ?? "—")}
                </span>
              )}
            </div>
            {d.navImmature ? (
              <div className="mx-5 mb-1 flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--ct-border-soft)] bg-[var(--ct-surface-inset)] px-5 py-10 text-center lg:mx-6">
                <span className="ct-metric-value text-[length:var(--ct-text-xl)] tabular-nums">
                  {formatUsdFull(d.deployedValueUsdc)}
                </span>
                <span className="ct-metric-caption max-w-md text-[length:var(--ct-text-nano)] leading-snug">
                  NAV history builds as your position matures and distributions
                  settle — the value trend appears here once there is more than a
                  single day of prints.
                </span>
              </div>
            ) : (
              <div className="px-5 lg:px-6">
                <HcValueChart
                  points={d.navPoints}
                  height={210}
                  aria-label="Vault value over time"
                />
              </div>
            )}
            <div className="mt-4 border-t border-[var(--ct-border-soft)]">
              <StatBand items={d.heroStats} />
            </div>
          </div>
        </section>

        {/* ── Act: Vault health ─────────────────────────────────────────────── */}
        <TitledDivider
          title="Vault health"
          trailing={
            <ProvenanceBadge
              kind="estimated"
              variant="compact"
              description={DERIVED_ALLOCATION_TIP}
            />
          }
        />
        <div className={SUPPORT}>
          <StatBand items={d.healthStats} />
          {/* The safety gauge is a LIVE-margin reading — only draw it while the
              vault is live. On a matured / closed position there is no live
              collateral to margin, so a "62% healthy" gauge would be false. */}
          {d.safetyIsLive ? (
            <div className="flex flex-col gap-3 border-t border-[var(--ct-border-soft)] p-5">
              <div className="flex items-center justify-between">
                <span className="ct-bento-label">Distance to liquidation · 55 / 45 / 40 / 20</span>
                <span className="ct-metric-caption text-[length:var(--ct-text-nano)]">
                  vs LLTV {d.lltvLivePct}% · pilot · deterministic · no kill-switch
                </span>
              </div>
              <HcMeter
                value={d.safetyMarginPct}
                max={80}
                ticks={d.safetyTicks}
                gradient
                aria-label="Safety margin scale (pilot)"
              />
            </div>
          ) : (
            <div className="border-t border-[var(--ct-border-soft)] p-5">
              <span className="ct-metric-caption text-[length:var(--ct-text-nano)] leading-snug">
                {zero
                  ? "Not funded yet — there is no live collateral position to margin. Collateral, debt and the distance-to-liquidation gauge activate on your first subscription."
                  : `No live safety margin on a ${d.lifecycle} vault — there is no active collateral position to margin. The figures above are historical.`}
              </span>
            </div>
          )}
        </div>

        <section className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-5">
          <div className={`${SUPPORT} flex flex-col`}>
            <CardHeader
              title="Capital · 3 pockets · target allocation"
              trailing={
                <ProvenanceBadge
                  kind="estimated"
                  variant="compact"
                  description={DERIVED_ALLOCATION_TIP}
                />
              }
            />
            <div className="flex flex-1 items-center gap-5 p-5">
              <AssetRing
                segments={pocketRing}
                centerLabel="Deposit"
                centerValue={formatUsdFull(d.pocketTotalUsdc)}
                size={156}
                thickness={20}
                aria-label="Pocket allocation ring"
              />
              <ul className="flex flex-1 flex-col gap-2.5">
                {d.pockets.map((p) => (
                  <li key={p.label} className="flex items-center gap-2">
                    <AssetBadge asset={p.asset} size={16} />
                    <span className="min-w-0 flex-1 truncate text-[length:var(--ct-text-xs)] ct-text-body">
                      {p.label}
                    </span>
                    <span className="ct-metric-value text-[length:var(--ct-text-sm)] tabular-nums">
                      {p.pct}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className={`${SUPPORT} flex flex-col`}>
            <CardHeader
              title="Pockets breakdown"
              trailing={
                <ProvenanceBadge
                  kind="estimated"
                  variant="compact"
                  description={DERIVED_ALLOCATION_TIP}
                />
              }
            />
            <div className="flex flex-1 p-4">
              <PocketCards pockets={d.pockets} format={formatUsdFull} />
            </div>
          </div>
        </section>

        {/* ── Act: Lock-up ──────────────────────────────────────────────────── */}
        <TitledDivider
          title="Lock-up"
          trailing={<ProvenanceBadge kind="attested" variant="compact" />}
        />
        <div className={SUPPORT}>
          <div className="flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between">
              <span className="ct-bento-label">Soft lock-up progress</span>
              <span className="ct-metric-caption text-[length:var(--ct-text-nano)] tabular-nums">
                {d.lockupDays > 0
                  ? d.lockupRemainingDays > 0
                    ? `${d.lockupElapsedDays} / ${d.lockupDays} days · ${d.lockupRemainingDays} remaining`
                    : `Soft lock-up cleared (${d.lockupElapsedDays} days held)`
                  : `${d.lockupElapsedDays} days held`}
              </span>
            </div>
            {d.lockupDays > 0 ? (
              <HcMeter
                value={Math.min(d.lockupElapsedDays, d.lockupDays)}
                max={d.lockupDays}
                ticks={d.lockupTicks}
                tone="accent"
                aria-label="Soft lock-up progress"
              />
            ) : (
              <span className="ct-metric-caption text-[length:var(--ct-text-nano)] leading-snug">
                No soft lock-up on this position.
              </span>
            )}
          </div>
        </div>

        {/* ── Act: Mining engine (pilot) ────────────────────────────────────── */}
        <TitledDivider
          title="Mining engine · allocated power · pilot"
          trailing={<ProvenanceBadge kind="simulated" variant="compact" />}
        />
        <section className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-5">
          <div className={SUPPORT}>
            <CardHeader
              title="cbBTC produced · daily conversion · pilot"
              trailing={<ProvenanceBadge kind="simulated" variant="compact" />}
            />
            <div className="flex flex-col gap-4 p-5">
              <HcProductionBars
                data={d.production}
                height={190}
                aria-label="cbBTC produced monthly (pilot sample)"
              />
              <div className="flex flex-col gap-3 border-t border-[var(--ct-border-soft)] pt-4">
                <div className="flex items-center justify-between">
                  <span className="ct-bento-label">Operational health · pilot</span>
                  <ProvenanceBadge kind="estimated" variant="compact" />
                </div>

                {/* Availability */}
                <div className="flex flex-col gap-1.5">
                  <div className="grid grid-cols-[4.75rem_minmax(0,1fr)_5.25rem] items-center gap-x-4">
                    <span className="text-[length:var(--ct-text-micro)] ct-text-muted">Availability</span>
                    <HcUptimeBand
                      segments={d.uptimeSegments}
                      bandOnly
                      aria-label="Machine uptime by cause (pilot)"
                    />
                    <span className="justify-self-end whitespace-nowrap text-right">
                      <span className="text-[length:var(--ct-text-sm)] font-medium ct-text-strong tabular-nums">
                        {onlinePct.toFixed(1)}%
                      </span>
                      <span className="ml-1 text-[length:var(--ct-text-nano)] ct-text-muted">online</span>
                    </span>
                  </div>
                  <div className="grid grid-cols-[4.75rem_minmax(0,1fr)_5.25rem] gap-x-4">
                    <div className="col-start-2 col-end-3 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      {uptimeCauses.map((s) => (
                        <span key={s.cause} className="inline-flex items-center gap-1.5">
                          <span aria-hidden="true" className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: s.dot }} />
                          <span className="text-[length:var(--ct-text-nano)] ct-text-muted">{s.label}</span>
                          <span className="text-[length:var(--ct-text-nano)] ct-text-body tabular-nums">{s.pct.toFixed(1)}%</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Efficiency */}
                <div className="flex flex-col gap-1.5">
                  <div className="grid grid-cols-[4.75rem_minmax(0,1fr)_5.25rem] items-center gap-x-4">
                    <span className="text-[length:var(--ct-text-micro)] ct-text-muted">Efficiency</span>
                    <HcBullet
                      value={d.efficiency.value}
                      min={18}
                      max={d.efficiency.max}
                      target={d.efficiency.target}
                      ranges={[d.efficiency.ranges[0], d.efficiency.ranges[1]]}
                      tone={d.efficiency.value <= d.efficiency.target ? "accent" : "warning"}
                      aria-label={`Efficiency ${d.efficiency.value} J/TH, target ${d.efficiency.target} (pilot)`}
                    />
                    <span className="justify-self-end whitespace-nowrap text-right">
                      <span className="text-[length:var(--ct-text-sm)] font-medium ct-text-strong tabular-nums">
                        {d.efficiency.value}
                      </span>
                      <span className="ml-1 text-[length:var(--ct-text-nano)] ct-text-muted">J/TH</span>
                    </span>
                  </div>
                  <div className="grid grid-cols-[4.75rem_minmax(0,1fr)_5.25rem] gap-x-4">
                    <div className="col-start-2 col-end-3 flex items-center justify-between text-[length:var(--ct-text-nano)] ct-text-muted">
                      <span>18 best</span>
                      <span>target {d.efficiency.target} · lower is better</span>
                      <span>30</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className={`${SUPPORT} flex flex-col`}>
            <CardHeader
              title="Agent orchestration · pilot"
              trailing={<ProvenanceBadge kind="simulated" variant="compact" />}
            />
            <AgentCanvas
              nodes={d.orchestration.nodes}
              edges={d.orchestration.edges}
              latest={d.orchestration.latest}
            />
          </div>
        </section>

        {/* ── Act: Advisory & exit (pilot) ──────────────────────────────────── */}
        <TitledDivider
          title="Agent advisory · deterministic rebalancing · pilot"
          trailing={<ProvenanceBadge kind="simulated" variant="compact" />}
        />
        <div className={SUPPORT}>
          <div className="grid grid-cols-1 gap-px bg-[var(--ct-border-soft)] lg:grid-cols-[minmax(220px,0.7fr)_1.3fr]">
            <div className="flex flex-col gap-3 bg-surface-card p-5">
              <div className="flex items-baseline justify-between">
                <span className="ct-bento-label">Take-profit → +24%</span>
                <span className="ct-metric-value text-[length:var(--ct-text-lg)] tabular-nums">
                  {d.takeProfitProgressPct}%
                </span>
              </div>
              <HcMeter
                value={d.takeProfitProgressPct}
                max={100}
                ticks={d.takeProfitTicks}
                tone="accent"
                aria-label="Take-profit progress"
              />
              <span className="ct-metric-caption mt-auto text-[length:var(--ct-text-nano)] leading-snug">
                Vault expires when deployed ≥ deposit ×1.24 → capital returned
                +24%. A maximum duration, not a fixed term. Progress is real; the
                projection band is a pilot model.
              </span>
            </div>
            <div className="flex flex-col gap-2 bg-surface-card p-5">
              <span className="ct-bento-label">Risk dimensions · pilot</span>
              <HcRiskDimensions dims={d.riskDimensions} />
            </div>
          </div>
          <div className="border-t border-[var(--ct-border-soft)] p-5">
            <AdvisoryFeed signals={d.signals} />
          </div>
        </div>

        <section className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-5">
          <div className={`${SUPPORT} flex flex-col`}>
            <CardHeader
              title="Exit paths"
              trailing={<ProvenanceBadge kind="manual" variant="compact" />}
            />
            <ExitPaths paths={d.exitPaths} />
          </div>
          <div className={`${SUPPORT} flex flex-col`}>
            <CardHeader
              title="Deployed-value projection · pilot"
              trailing={<ProvenanceBadge kind="estimated" variant="compact" />}
            />
            <div className="p-5">
              <HcHonestFan
                bands={d.projection}
                unit="%"
                seedLabel="hyv-pilot-2026"
                height={180}
                aria-label="Projection fan (pilot)"
              />
            </div>
          </div>
        </section>

        {/* ── Act: Yield & distributions (real) ─────────────────────────────── */}
        <TitledDivider
          title="Yield & distributions"
          trailing={<ProvenanceBadge kind="attested" variant="compact" />}
        />
        <section className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-5">
          <div className={`${SUPPORT} flex flex-col`}>
            <CardHeader
              title="Distributions paid · by month"
              trailing={
                <span className="ct-metric-caption text-[length:var(--ct-text-nano)] tabular-nums">
                  {formatUsdFull(d.distributedUsdc)} paid to date
                </span>
              }
            />
            <div className="p-5">
              <HcBarChart
                bars={yieldBars}
                height={190}
                highlightLast
                emptyMessage="No distributions paid yet"
                aria-label="Monthly distributions paid"
              />
              {nextPayout ? (
                <p className="ct-metric-caption mt-4 border-t border-[var(--ct-border-soft)] pt-4 text-[length:var(--ct-text-nano)] leading-snug">
                  Next monthly payout projected at{" "}
                  <span className="tabular-nums ct-text-body">
                    {formatUsdDetailed(nextPayout.lo)}
                  </span>{" "}
                  –{" "}
                  <span className="tabular-nums ct-text-body">
                    {formatUsdDetailed(nextPayout.hi)}
                  </span>{" "}
                  {nextPayout.basis === "run-rate"
                    ? "— a range around your realized distribution run-rate, not guaranteed."
                    : "under stated assumptions (target APY on principal, before any distribution has settled) — a range, not guaranteed."}
                </p>
              ) : null}
            </div>
          </div>
          <div className={`${SUPPORT} flex flex-col`}>
            <CardHeader title="Distribution history" />
            {d.distributions.length > 0 ? (
              <ul className="flex flex-col">
                {d.distributions.map((dist) => (
                  <li
                    key={dist.id}
                    className="flex items-center justify-between gap-3 border-b border-[var(--ct-border-soft)] px-5 py-3.5 last:border-b-0"
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="text-[length:var(--ct-text-sm)] font-medium ct-text-strong tabular-nums">
                        {formatUsdDetailed(dist.amountUsdc)}
                      </span>
                      <span className="ct-metric-caption text-[length:var(--ct-text-nano)]">
                        {DISTRIB_DATE.format(dist.paidAt)}
                        {dist.vaultName ? ` · ${dist.vaultName}` : ""}
                      </span>
                    </div>
                    <ProvenanceBadge kind="attested" variant="compact" />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-1 items-center justify-center p-8">
                <span className="ct-metric-caption text-center text-[length:var(--ct-text-nano)] leading-snug">
                  No distributions yet. Paid USDC distributions will be listed
                  here as they settle.
                </span>
              </div>
            )}
          </div>
        </section>

        {/* single global disclaimer */}
        <p className="ct-metric-caption text-[length:var(--ct-text-nano)] leading-snug">
          Financial figures (deposit, value, accrued, yield paid, NAV, distributions)
          reflect your own account only. Pockets, collateral and safety margin are
          Estimated target allocations derived from your deposit. Mining, risk and
          agent panels are pilot / sample data awaiting an attested feed, not
          attested records. Distributions shown are what was actually paid; forward
          figures are projections shown as a range under stated assumptions, not
          guaranteed.
        </p>
      </div>
    </div>
  );
}
