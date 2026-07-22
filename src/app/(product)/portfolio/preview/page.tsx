/**
 * /portfolio/preview — SANDBOX / RESEARCH surface, V4 vault-health console.
 *
 * ⚠️ NOT A SERIES 1 INVESTOR SURFACE (Option B, release cutover).
 * This page intentionally exposes the leverage-model vocabulary — borrow / LTV / LLTV /
 * Morpho / liquidation / collateral loan — which is the SEPARATE research model, NOT the
 * shipped product. Series 1 (Hearst Mining Note, v3.0) is BTC-accumulation only: no borrow,
 * no LTV, no liquidation. Those terms are BANNED on any investor-facing Series 1 surface and
 * are asserted against by `src/lib/guards/wording-series1.ts`. This route stays valid as a
 * sandbox — DO NOT delete it — but it must never be linked from, or promoted to, an investor
 * Series 1 surface. It is scoped sandbox: mock data, KYC/B2B-gated, badged "Sandbox · V4".
 *
 * ISOLATED. The live /portfolio is untouched; the design system + --ct-* tokens are NOT modified
 * (this folder only consumes them). Composition follows the kit's master pattern: console header +
 * ambient glow → one dominant hero (value chart + edge stat band) → acts separated by titled hairline
 * dividers → advisory as a one-line activity feed → exit + projection → a single footer disclaimer.
 * Chrome budget: ONE shadowed hero, every support surface is a bare hairline. Green (accent) +
 * heartbeat pulse are reserved for the one genuinely-Live value (hashprice). Kit = frames; HIS = charts.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { getSession } from "@/lib/auth/session";

import {
  HcChartCard,
  HcValueChart,
} from "@/components/dataviz/his";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { formatUsdFull } from "@/lib/vaults/product-display";

import "./_styles.css";
import { AdvisoryFeed } from "./_charts/advisory-feed";
import { AgentCanvas } from "./_charts/agent-canvas";
import { AssetBadge } from "./_charts/asset-badge";
import { AssetRing } from "./_charts/asset-ring";
import { HcBullet } from "./_charts/bullet";
import { ExitPaths } from "./_charts/exit-paths";
import { HcHonestFan } from "./_charts/honest-fan";
import { HcMeter } from "./_charts/meter";
import { PocketCards } from "./_charts/pocket-cards";
import { HcProductionBars } from "./_charts/production-bars";
import { HcRiskDimensions } from "./_charts/risk-dimensions";
import { StatBand } from "./_charts/stat-band";
import { HcUptimeBand, orderedUptime } from "./_charts/uptime-band";
import { ASSET_COLOR, HEARST_WORDMARK, POCKET_ASSET } from "./_data/brand";
import {
  ACCESS,
  EFFICIENCY,
  EXIT_PATHS,
  HEALTH,
  HEALTH_STATS,
  HERO_STATS,
  ORCHESTRATION,
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

export const metadata: Metadata = {
  title: "Research sandbox — legacy V4 model",
  description:
    "Research-only console with mock data. Separate from the Series 1 investor product.",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

/** Bare-hairline support surface (no shadow — the chrome budget reserves elevation for the hero). */
const SUPPORT = "rounded-2xl border border-[var(--ct-border)] bg-surface-card overflow-hidden";
const HERO_SHADOW = "var(--ct-shadow-depth), var(--ct-glass-bevel-subtle)";

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

export default async function PortfolioPreviewPage() {
  // GATE — this sandbox exposes the SEPARATE leverage-research vocabulary
  // (borrow / LTV / LLTV / Morpho / collateral) which is banned on every
  // Series 1 investor surface. The file header claimed this route was gated;
  // it was not, so an investor could reach it directly. Non-admins now get a
  // 404: the research surface stays available to the team without ever being
  // an investor-reachable page.
  const session = await getSession();
  if (session?.role !== "admin") notFound();

  const pocketTotal = POCKETS.reduce((s, p) => s + p.value, 0);
  // Per-asset ring segments (green / orange / blue) — matches the pocket-card identity colours.
  const pocketRing = POCKETS.map((p, i) => ({
    label: p.label,
    value: p.value,
    color: ASSET_COLOR[POCKET_ASSET[i] ?? "hearst"],
  }));
  const onlinePct = UPTIME_SEGMENTS.find((s) => s.cause === "online")?.pct ?? 0;
  const uptimeCauses = orderedUptime(UPTIME_SEGMENTS).filter((s) => s.cause !== "online");

  return (
    <div className="dark flex flex-col rounded-2xl bg-surface-page [--gutter:theme(spacing.8)] mb-8">
      <div className="flex flex-col gap-y-8 p-5 lg:p-6">
        {/* S0 — access ribbon (Hearst letterhead + one line of chips) */}
        <div className="flex flex-wrap items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={HEARST_WORDMARK.src}
            alt={HEARST_WORDMARK.alt}
            className="mr-1 shrink-0"
            style={{ height: 16, width: "auto", display: "block" }}
          />
          <span
            className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[length:var(--ct-text-nano)] font-bold uppercase tracking-widest"
            style={{ borderColor: "var(--ct-status-warning-border)", color: "var(--ct-status-warning)", background: "var(--ct-status-warning-soft)" }}
          >
            Research sandbox · V4
          </span>
          <MetaChip label="KYC" value={ACCESS.kycStatus} />
          <MetaChip label="Class" value={ACCESS.shareClass} />
          <MetaChip label="Access" value="B2B · qualified" />
          <span className="ml-auto">
            <Link
              href="/portfolio"
              className="rounded-sm text-[length:var(--ct-text-nano)] uppercase tracking-widest ct-text-muted transition-colors hover:text-[var(--ct-accent)] focus-visible:outline-none ct-focus-ring"
            >
              Live portfolio →
            </Link>
          </span>
        </div>

        <div
          role="note"
          className="rounded-xl border border-[var(--ct-status-warning-border)] bg-[var(--ct-status-warning-soft)] px-4 py-3 text-[length:var(--ct-text-xs)] text-[var(--ct-status-warning)]"
        >
          Research-only sandbox with mock data — not a Series 1 investor surface.
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
              {/* Position status — NOT a Live value, so no green + no heartbeat pulse
                  (green + pulse are reserved for the one genuinely-Live signal). */}
              <span
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[length:var(--ct-text-nano)] uppercase tracking-widest ct-text-body"
                style={{ borderColor: "var(--ct-border-soft)" }}
              >
                <span
                  aria-hidden="true"
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: "var(--ct-text-muted)" }}
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
          <HcChartCard title="Capital · 3 pockets" subtitle="B1 mining power · B2 wBTC · B3 USDC" source="estimated" state="ready" height={180} aria-label="Pocket allocation">
            <div className="flex h-full items-center gap-5">
              <AssetRing
                segments={pocketRing}
                centerLabel="Deployed"
                centerValue={formatUsdFull(pocketTotal)}
                size={156}
                thickness={20}
                aria-label="Pocket allocation ring"
              />
              <ul className="flex flex-1 flex-col gap-2.5">
                {POCKET_CARDS.map((p) => (
                  <li key={p.label} className="flex items-center gap-2">
                    <AssetBadge asset={p.asset} size={16} />
                    <span className="min-w-0 flex-1 truncate text-[length:var(--ct-text-xs)] ct-text-body">{p.label}</span>
                    <span className="ct-metric-value text-[length:var(--ct-text-sm)] tabular-nums">{p.pct}%</span>
                  </li>
                ))}
              </ul>
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
              {/* Operational health — availability + efficiency, one aligned spec-sheet.
                  Both bars are the middle cell of the SAME 3-col grid template → identical x/width. */}
              <div className="flex flex-col gap-3 border-t border-[var(--ct-border-soft)] pt-4">
                <div className="flex items-center justify-between">
                  <span className="ct-bento-label">Operational health</span>
                  <ProvenanceBadge kind="estimated" variant="compact" />
                </div>

                {/* Availability */}
                <div className="flex flex-col gap-1.5">
                  <div className="grid grid-cols-[4.75rem_minmax(0,1fr)_5.25rem] items-center gap-x-4">
                    <span className="text-[length:var(--ct-text-micro)] ct-text-muted">Availability</span>
                    <HcUptimeBand segments={UPTIME_SEGMENTS} bandOnly aria-label="Machine uptime by cause" />
                    <span className="justify-self-end whitespace-nowrap text-right">
                      <span className="text-[length:var(--ct-text-sm)] font-medium ct-text-strong tabular-nums">{onlinePct.toFixed(1)}%</span>
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
                      value={EFFICIENCY.value}
                      min={18}
                      max={EFFICIENCY.max}
                      target={EFFICIENCY.target}
                      ranges={[EFFICIENCY.ranges[0], EFFICIENCY.ranges[1]]}
                      tone={EFFICIENCY.value <= EFFICIENCY.target ? "accent" : "warning"}
                      aria-label={`Efficiency ${EFFICIENCY.value} J/TH, target ${EFFICIENCY.target}`}
                    />
                    <span className="justify-self-end whitespace-nowrap text-right">
                      <span className="text-[length:var(--ct-text-sm)] font-medium ct-text-strong tabular-nums">{EFFICIENCY.value}</span>
                      <span className="ml-1 text-[length:var(--ct-text-nano)] ct-text-muted">J/TH</span>
                    </span>
                  </div>
                  <div className="grid grid-cols-[4.75rem_minmax(0,1fr)_5.25rem] gap-x-4">
                    <div className="col-start-2 col-end-3 flex items-center justify-between text-[length:var(--ct-text-nano)] ct-text-muted">
                      <span>18 best</span>
                      <span>target {EFFICIENCY.target} · lower is better</span>
                      <span>30</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className={`${SUPPORT} flex flex-col`}>
            <CardHeader
              title="Agent orchestration"
              trailing={<ProvenanceBadge kind="simulated" variant="compact" />}
            />
            <AgentCanvas
              nodes={ORCHESTRATION.nodes}
              edges={ORCHESTRATION.edges}
              latest={ORCHESTRATION.latest}
            />
          </div>
        </section>

        {/* ── Act: Advisory & exit ──────────────────────────────────────────── */}
        <TitledDivider title="Agent advisory · deterministic rebalancing" trailing={<ProvenanceBadge kind="simulated" variant="compact" />} />
        <div className={SUPPORT}>
          <div className="grid grid-cols-1 gap-px bg-[var(--ct-border-soft)] lg:grid-cols-[minmax(220px,0.7fr)_1.3fr]">
            <div className="flex flex-col gap-3 bg-surface-card p-5">
              <div className="flex items-baseline justify-between">
                <span className="ct-bento-label">Take-profit → +24%</span>
                <span className="ct-metric-value text-[length:var(--ct-text-lg)] tabular-nums">{VAULT.takeProfitProgressPct}%</span>
              </div>
              <HcMeter value={VAULT.takeProfitProgressPct} max={100} ticks={TAKEPROFIT_TICKS} tone="accent" aria-label="Take-profit progress" />
              <span className="ct-metric-caption mt-auto text-[length:var(--ct-text-nano)] leading-snug">
                Vault expires when deployed ≥ deposit ×1.24 → capital returned +24%. A maximum duration, not a fixed term.
              </span>
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
          <div className={`${SUPPORT} flex flex-col`}>
            <CardHeader title="Exit paths" trailing={<ProvenanceBadge kind="manual" variant="compact" />} />
            <ExitPaths paths={EXIT_PATHS} />
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
