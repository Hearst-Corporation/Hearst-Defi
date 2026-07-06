/**
 * /portfolio/preview — SANDBOX, V4 vault-health console, recomposed on the Application UI V4 kit.
 *
 * ISOLATED. The live /portfolio is untouched; the design system + --ct-* tokens are NOT modified
 * (this folder only consumes them). Composition follows the kit's master pattern: console header +
 * ambient glow → one dominant hero (value chart + edge stat band) → acts separated by titled hairline
 * dividers → advisory as a one-line activity feed → exit + projection → a single footer disclaimer.
 * Chrome budget: ONE shadowed hero, every support surface is a bare hairline. Green (accent) +
 * heartbeat pulse are reserved for the one genuinely-Live value (hashprice). Kit = frames; HIS = charts.
 */
import Link from "next/link";
import type { ReactNode } from "react";

import {
  HcChartCard,
  HcCompositionRing,
  HcValueChart,
} from "@/components/dataviz/his";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { formatUsdFull } from "@/lib/vaults/product-display";

import "./_styles.css";
import { AdvisoryFeed } from "./_charts/advisory-feed";
import { HcBullet } from "./_charts/bullet";
import { HcHonestFan } from "./_charts/honest-fan";
import { HcMeter } from "./_charts/meter";
import { PocketCards } from "./_charts/pocket-cards";
import { HcProductionBars } from "./_charts/production-bars";
import { HcRiskDimensions } from "./_charts/risk-dimensions";
import { StatBand } from "./_charts/stat-band";
import { HcUptimeBand } from "./_charts/uptime-band";
import { YieldBridge } from "./_charts/yield-bridge";
import {
  ACCESS,
  COLLATERAL_BRIDGE,
  EFFICIENCY,
  ELECTRICITY,
  EXIT_PATHS,
  HEALTH,
  HEALTH_STATS,
  HERO_STATS,
  POCKETS,
  POCKET_CARDS,
  PRODUCTION,
  PROJECTION,
  RISK_DIMENSIONS,
  SAFETY,
  SAFETY_TICKS,
  SIGNALS,
  TAKEPROFIT_TICKS,
  UPTIME_SEGMENTS,
  VALUE_POINTS,
  VAULT,
} from "./_data/mock";

export const metadata = {
  title: "Vault preview — V4 (sandbox)",
  description: "Per-client V4 vault-health console. Mock data, B2B/KYC-gated.",
};

/** Bare-hairline support surface (no shadow — the chrome budget reserves elevation for the hero). */
const SUPPORT = "rounded-2xl border border-[var(--ct-border)] bg-surface-card overflow-hidden";
const HERO_SHADOW = "var(--ct-shadow-depth), var(--ct-glass-bevel-subtle)";

function formatUsdK(n: number): string {
  return `$${Math.round(n / 1000).toLocaleString("en-US")}k`;
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--ct-border-soft)] bg-[var(--ct-surface-inset)] px-2 py-0.5">
      <span className="ct-bento-label">{label}</span>
      <span className="text-[length:var(--ct-text-xs)] ct-text-strong tabular-nums">{value}</span>
    </span>
  );
}

/** Titled hairline divider — opens an act without boxing it in a card (kills cage-in-cage). */
function TitledDivider({ title, trailing }: { title: string; trailing?: ReactNode }) {
  return (
    <div className="flex items-center gap-4 pt-2">
      <h2 className="ct-section-title shrink-0">{title}</h2>
      <span aria-hidden="true" className="h-px flex-1" style={{ background: "var(--ct-border-soft)" }} />
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

export default function PortfolioPreviewPage() {
  const pocketTotal = POCKETS.reduce((s, p) => s + p.value, 0);

  return (
    <div className="dark flex flex-col rounded-2xl bg-surface-page [--gutter:theme(spacing.8)] mb-8">
      <div className="flex flex-col gap-y-8 p-5 lg:p-6">
        {/* S0 — access ribbon (one line of chips, no paragraph) */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[length:var(--ct-text-nano)] font-bold uppercase tracking-widest"
            style={{ borderColor: "var(--ct-status-warning-border)", color: "var(--ct-status-warning)", background: "var(--ct-status-warning-soft)" }}
          >
            Sandbox · V4
          </span>
          <MetaChip label="KYC" value={ACCESS.kycStatus} />
          <MetaChip label="Class" value={ACCESS.shareClass} />
          <MetaChip label="Access" value="B2B · qualified" />
          <span className="ml-auto">
            <Link href="/portfolio" className="text-[length:var(--ct-text-nano)] uppercase tracking-widest ct-text-muted transition-colors hover:text-[var(--ct-accent)]">
              Live portfolio →
            </Link>
          </span>
        </div>

        {/* S1 — HERO: the one dominant band (glow + console header + value chart + edge stat band) */}
        <section
          className="relative overflow-hidden rounded-2xl border border-[var(--ct-border)] bg-surface-card"
          style={{ boxShadow: HERO_SHADOW }}
          aria-label="Vault value"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 left-1/4 h-64 w-[min(680px,80%)] opacity-[0.07]"
            style={{ background: "radial-gradient(ellipse at center, var(--ct-accent) 0%, transparent 70%)" }}
          />
          <div className="relative z-10 flex flex-col">
            <div className="flex flex-wrap items-start justify-between gap-3 p-5 lg:p-6">
              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="ct-bento-label">Hearst Yield Vault · V4 · 1 vault = 1 client</span>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h1 className="h1 shrink-0">
                    Vault <span className="h1-accent">Health</span>
                  </h1>
                  <span className="ct-metric-value text-[length:var(--ct-text-2xl)] tabular-nums">
                    {formatUsdFull(VAULT.deployedValueUsdc)}
                  </span>
                  <span className="text-[length:var(--ct-text-sm)] font-semibold ct-text-body tabular-nums">
                    {VAULT.totalChange}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <MetaChip label="Your hashrate" value={VAULT.allocatedHashrate} />
                  <MetaChip label="Take-profit" value={`${VAULT.takeProfitProgressPct}% → +24%`} />
                </div>
              </div>
              <span
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[length:var(--ct-text-nano)] uppercase tracking-widest ct-text-body"
                style={{ borderColor: "var(--ct-border-soft)" }}
              >
                <span
                  aria-hidden="true"
                  className="hyv-pulse inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: "var(--ct-accent)", color: "var(--ct-accent)" }}
                />
                Active
              </span>
            </div>
            <div className="px-5 lg:px-6">
              <HcValueChart points={VALUE_POINTS} height={210} aria-label="Vault value trend" />
            </div>
            <div className="mt-4 border-t border-[var(--ct-border-soft)]">
              <StatBand items={HERO_STATS} />
            </div>
          </div>
        </section>

        {/* ── Act: Vault health ─────────────────────────────────────────────── */}
        <TitledDivider title="Vault health" trailing={<ProvenanceBadge kind="estimated" variant="compact" />} />
        <div className={SUPPORT}>
          <StatBand items={HEALTH_STATS} />
          <div className="flex flex-col gap-3 border-t border-[var(--ct-border-soft)] p-5">
            <div className="flex items-center justify-between">
              <span className="ct-bento-label">Distance to liquidation · 55 / 45 / 40 / 20</span>
              <span className="ct-metric-caption text-[length:var(--ct-text-nano)]">vs LLTV {HEALTH.lltvLivePct}% · deterministic · no kill-switch</span>
            </div>
            <HcMeter value={SAFETY.value} max={SAFETY.max} ticks={SAFETY_TICKS} gradient aria-label="Safety margin scale" />
          </div>
        </div>

        <section className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-5">
          <HcChartCard title="Capital · 3 pockets" subtitle="B1 mining power 35–45% · B2 wBTC · B3 USDC" source="estimated" state="ready" height={180} aria-label="Pocket allocation">
            <div className="flex h-full items-center">
              <HcCompositionRing segments={[...POCKETS]} centerLabel="Deployed" centerValue={formatUsdFull(pocketTotal)} bars aria-label="Pocket ring" />
            </div>
          </HcChartCard>
          <div className={`${SUPPORT} flex flex-col`}>
            <CardHeader title="Pockets breakdown" trailing={<ProvenanceBadge kind="estimated" variant="compact" />} />
            <div className="flex flex-1 p-4">
              <PocketCards pockets={POCKET_CARDS} format={formatUsdFull} />
            </div>
          </div>
        </section>

        {/* ── Act: Mining engine ────────────────────────────────────────────── */}
        <TitledDivider title="Mining engine · your allocated power" />
        <section className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-5">
          <div className={SUPPORT}>
            <CardHeader title="cbBTC produced · daily conversion" trailing={<ProvenanceBadge kind="simulated" variant="compact" />} />
            <div className="flex flex-col gap-4 p-5">
              <HcProductionBars data={PRODUCTION} height={190} aria-label="cbBTC produced monthly" />
              <div className="grid grid-cols-1 gap-4 border-t border-[var(--ct-border-soft)] pt-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="ct-bento-label">Uptime by cause</span>
                    <ProvenanceBadge kind="estimated" variant="compact" />
                  </div>
                  <HcUptimeBand segments={UPTIME_SEGMENTS} aria-label="Machine uptime by cause" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="ct-bento-label">Efficiency · {EFFICIENCY.value} J/TH</span>
                    <span className="ct-metric-caption text-[length:var(--ct-text-nano)]">target {EFFICIENCY.target}</span>
                  </div>
                  <HcBullet
                    value={EFFICIENCY.max - EFFICIENCY.value}
                    max={EFFICIENCY.max}
                    target={EFFICIENCY.max - EFFICIENCY.target}
                    ranges={[EFFICIENCY.max - EFFICIENCY.ranges[1], EFFICIENCY.max - EFFICIENCY.ranges[0]]}
                    tone="neutral"
                    aria-label={`Efficiency ${EFFICIENCY.value} J/TH`}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className={`${SUPPORT} flex flex-col`}>
            <div className="flex items-start justify-between gap-3 border-b border-[var(--ct-border-soft)] px-5 py-4">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="ct-bento-label">Mining → collateral bridge</span>
                <span className="ct-metric-caption text-[length:var(--ct-text-nano)] leading-snug">
                  Gross − electricity (repaid to Hearst) + farming → net cbBTC to collateral
                </span>
              </div>
              <ProvenanceBadge kind="estimated" variant="compact" />
            </div>
            <div className="flex flex-1 flex-col p-5">
              <YieldBridge steps={[...COLLATERAL_BRIDGE]} format={formatUsdK} aria-label="Mining to collateral bridge" />
            </div>
            <div className="border-t border-[var(--ct-border-soft)] px-5 py-3">
              <span className="ct-metric-caption text-[length:var(--ct-text-nano)] leading-snug">
                Elec advanced by Hearst, reimbursed on cbBTC produced · net burn {ELECTRICITY.netBurn} · runway {ELECTRICITY.runwayMonths}mo.
              </span>
            </div>
          </div>
        </section>

        {/* ── Act: Advisory & exit ──────────────────────────────────────────── */}
        <TitledDivider title="Agent advisory · deterministic rebalancing" trailing={
          <span className="inline-flex items-center gap-1.5 text-[length:var(--ct-text-nano)] uppercase tracking-widest ct-text-muted">
            <span aria-hidden="true" className="hyv-pulse inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--ct-accent)", color: "var(--ct-accent)" }} />
            Live · Chainlink
          </span>
        } />
        <div className={SUPPORT}>
          <div className="grid grid-cols-1 gap-px bg-[var(--ct-border-soft)] lg:grid-cols-[minmax(220px,0.7fr)_1.3fr]">
            <div className="flex flex-col gap-2 bg-surface-card p-5">
              <div className="flex items-baseline justify-between">
                <span className="ct-bento-label">Take-profit → +24%</span>
                <span className="ct-metric-value text-[length:var(--ct-text-lg)] tabular-nums">{VAULT.takeProfitProgressPct}%</span>
              </div>
              <HcMeter value={VAULT.takeProfitProgressPct} max={100} ticks={TAKEPROFIT_TICKS} tone="accent" aria-label="Take-profit progress" />
            </div>
            <div className="flex flex-col gap-2 bg-surface-card p-5">
              <span className="ct-bento-label">Risk dimensions</span>
              <HcRiskDimensions dims={RISK_DIMENSIONS} />
            </div>
          </div>
          <div className="border-t border-[var(--ct-border-soft)] p-5">
            <AdvisoryFeed signals={SIGNALS} />
          </div>
        </div>

        <section className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-5">
          <div className={SUPPORT}>
            <CardHeader title="Exit paths" />
            <div className="grid grid-cols-1 gap-px bg-[var(--ct-border-soft)] sm:grid-cols-3">
              {EXIT_PATHS.map((e) => (
                <div key={e.label} className="flex flex-col gap-2 bg-surface-card p-4">
                  <span
                    aria-hidden="true"
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{
                      background:
                        e.tone === "accent" ? "var(--ct-accent)" : e.tone === "warning" ? "var(--ct-status-warning)" : "var(--ct-text-muted)",
                    }}
                  />
                  <span className="ct-metric-value text-[length:var(--ct-text-sm)]">{e.label}</span>
                  <span className="ct-metric-caption text-[length:var(--ct-text-nano)] leading-snug">{e.detail}</span>
                </div>
              ))}
            </div>
          </div>
          <HcChartCard title="Deployed-value projection" subtitle="p5 / p50 / p95 · median muted, never green-as-guaranteed" source="estimated" state="ready" height={180} aria-label="Projection fan">
            <HcHonestFan bands={PROJECTION} unit="%" seedLabel="hyv-v4-2026-06" height={180} aria-label="Projection fan" />
          </HcChartCard>
        </section>

        {/* single global disclaimer */}
        <p className="ct-metric-caption text-[length:var(--ct-text-nano)] leading-snug">
          Sandbox · mock/estimated data (only hashprice would be Live) · per-client vault, KYC-gated B2B / qualified ·
          capital best-effort, never guaranteed · deterministic Chainlink advisory recommends a review, never executes.
        </p>
      </div>
    </div>
  );
}
