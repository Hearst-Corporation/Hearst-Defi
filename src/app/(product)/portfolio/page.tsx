/**
 * /portfolio — the investor's REAL vault-health console.
 *
 * One shadowed hero (NAV chart + stat band) → acts opened by titled hairline
 * dividers (Vault health · Mining engine · Yield & distributions) → one footer
 * disclaimer. Wired end-to-end on the signed-in investor's own persisted data
 * via `loadPortfolioCockpit` — NOT the sandbox mock (this page imports NONE of
 * ./preview/_data). It starts at ZERO (no position) and fills in after the
 * first subscription.
 *
 * HONESTY TIERS, each carried on its own badge:
 *   • REAL      — deposit, deployed value, accrued, yield paid, NAV history,
 *                 distributions (bars + ledger, attested when tx-hashed, manual
 *                 when book-entry), lock-up, status, APY range. Rebalancings
 *                 come from the real RebalanceEvent table (vault-level ops,
 *                 badged Manual — never presented as per-investor).
 *   • ESTIMATED — DERIVED from the real deposit, labelled "target allocation":
 *                 the 3 pockets, collateral. Mining rates (uptime, efficiency)
 *                 are fleet-level readings, Estimated.
 *   • SIMULATED — zero-state preview only: the pilot orchestration topology +
 *                 sample rebalancing feed, so a not-yet-funded investor can see
 *                 the shape of the operational layer. Always badged Simulated;
 *                 never rendered on a funded position. Distributions never fall
 *                 back to a sample: no data → an honest empty state.
 *
 * Token-only (--ct-*). The charts under ./preview/_charts/* are data-agnostic
 * and reused directly.
 */
import Link from "next/link";
import type { ReactNode } from "react";

import { HcBarChart, HcValueChart } from "@/components/dataviz/his";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { getSession } from "@/lib/auth/session";
import { loadPortfolioCockpit } from "@/lib/data/portfolio-cockpit";
import { loadVaultRebalancings } from "@/lib/data/vault-rebalancings";
import { isDemoAccount } from "@/lib/demo/allowlist";
import { ZAND_FIXTURE_EMAIL } from "@/lib/demo/zand-fixture";
import {
  formatUsdDetailed,
  formatUsdFull,
} from "@/lib/vaults/product-display";

import "./preview/_styles.css";
import { AgentCanvas } from "./preview/_charts/agent-canvas";
import { AssetBadge } from "./preview/_charts/asset-badge";
import { AssetRing } from "./preview/_charts/asset-ring";
import { HcBullet } from "./preview/_charts/bullet";
import { HcMeter } from "./preview/_charts/meter";
import { PocketCards } from "./preview/_charts/pocket-cards";
import { RebalancingFeed, type RebalancingEvent } from "./preview/_charts/rebalancing-feed";
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

/** "Aug 1, 2025" — full distribution date, one clean line. */
const DISTRIB_DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
/**
 * PILOT sample — rebalancing notifications for the Agent orchestration footer.
 * Deterministic, newest first. There are deliberately few (rebalancings are
 * rare, deterministic events); the footer shows the latest and a scrollable
 * "History" of the rest. ALWAYS badged Simulated — advisory, held for multisig,
 * never auto-executed.
 */
const PILOT_REBALANCINGS: readonly RebalancingEvent[] = [
  { id: "rb-6", at: "Dec 2025", summary: "wBTC pocket trimmed 2% → USDC buffer topped up ahead of the electricity draw.", tone: "done" },
  { id: "rb-5", at: "Oct 2025", summary: "Safety margin above the 55% recharge line — no de-risk armed. Rule R2 held.", tone: "info" },
  { id: "rb-4", at: "Aug 2025", summary: "Market-risk 52 (amber) → review of the safety margin suggested; de-risk arms only at the 45% band.", tone: "review" },
  { id: "rb-3", at: "Jun 2025", summary: "Mining pocket rebought after hashrate NFT settlement cleared. Rule R4.", tone: "done" },
  { id: "rb-2", at: "Apr 2025", summary: "Electricity reserve refilled from realized yield — buffer restored to target.", tone: "done" },
  { id: "rb-1", at: "Feb 2025", summary: "Opening allocation set to 40 / 37 / 23 (mining / wBTC / USDC).", tone: "info" },
];

/** Short month-year label for a distribution bar, UTC, deterministic. */
const DISTRIB_BAR_LABEL = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});

/**
 * Aggregate real distributions into monthly bars (label + summed amount),
 * oldest → newest. Pure/deterministic: groups by the UTC year-month of each
 * distribution's `paidAt`, no clock, no PRNG. Returns [] when there are none,
 * so the caller renders an empty state rather than a fabricated pilot year.
 */
function buildMonthlyDistributionBars(
  distributions: readonly { amountUsdc: number; paidAt: Date }[],
): { label: string; value: number }[] {
  const byMonth = new Map<string, { at: Date; total: number }>();
  for (const dist of distributions) {
    const at = dist.paidAt;
    const key = `${at.getUTCFullYear()}-${String(at.getUTCMonth()).padStart(2, "0")}`;
    const bucket = byMonth.get(key);
    if (bucket) {
      bucket.total += dist.amountUsdc;
    } else {
      // Anchor each bucket to the 1st of its month (UTC) for a stable label.
      byMonth.set(key, {
        at: new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1)),
        total: dist.amountUsdc,
      });
    }
  }
  return [...byMonth.values()]
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .map((b) => ({ label: DISTRIB_BAR_LABEL.format(b.at), value: b.total }));
}

export default async function PortfolioPage() {
  const [d, session] = await Promise.all([
    loadPortfolioCockpit(),
    getSession(),
  ]);
  // Real vault-level rebalancing feed (RebalanceEvent table), scoped to events
  // since this investor's own first active subscription. Vault-wide operations
  // can pre-date a new LP entry; those historical rows are still real but are
  // not "your recent activity".
  const {
    events: vaultRebalancings,
    hasPriorRebalancings,
  } = await loadVaultRebalancings("yield", 12, { since: d.subscribedAt });
  const isDemo = isDemoAccount(session?.email);

  // Real monthly distribution bars, aggregated from the investor's OWN paid
  // distributions (d.distributions, attested). Grouped by calendar month of
  // paidAt, oldest → newest, summed. Empty when the account has no real
  // distributions yet — the chart then shows its own "No distributions yet"
  // empty state instead of a fabricated pilot year.
  const realDistributionBars = buildMonthlyDistributionBars(d.distributions);
  const hasRealDistributions = realDistributionBars.length > 0;
  // Distribution provenance is EARNED, not asserted: rows carrying an on-chain
  // txHash are attested; book-entry rows (e.g. the seeded fixture ledger) are
  // Manual — "entered by administrators" is the truth for them.
  const distributionsProvenance: "attested" | "manual" =
    hasRealDistributions && d.distributions.every((t) => t.txHash)
      ? "attested"
      : "manual";

  // ── FULL COCKPIT — ONE render path for EVERY state (zero → funded → matured) ─
  // At zero the loader (emptyCockpit) returns the same full view-model with REAL
  // figures at $0, empty real history, and the same Simulated-badged PILOT tiers
  // the funded view shows. No stripped empty card: an investor without a deposit
  // sees the complete console filled with zero / pending values, so they can read
  // exactly what they'll get after subscribing. `hasPosition` only toggles honesty
  // details (Subscribe CTA + "not funded yet" note vs the Active pulse / NAV curve).
  const zero = !d.hasPosition;

  // On a REAL funded position, drop the pilot "Safety margin · …" stat (a 62%
  // placeholder with no attested collateral / LLTV feed) from the health band —
  // it is only meaningful in the zero-state preview. Every other health stat
  // (collateral target, debt) is kept.
  const healthStats = zero
    ? d.healthStats
    : d.healthStats.filter((s) => !s.label.startsWith("Safety margin"));

  // Per-asset ring segments (green / orange / blue) — matches the pocket identity.
  const pocketRing = d.pockets.map((p, i) => ({
    label: p.label,
    value: p.valueUsdc,
    color: ASSET_COLOR[POCKET_ASSET[i] ?? "hearst"],
  }));
  // NAV widget — ALWAYS render a real chart area, never a text placeholder. The
  // HcValueChart empty state (<2 points) draws a dashed "no history" box, so when
  // the real series is too short (fresh / zero position) we synthesize a flat
  // 2-point baseline at the current deployed value (= $0 at zero) spanning the
  // last 24h → now. A true flat line to read, not an empty cadre.
  const DAY_MS = 24 * 60 * 60 * 1000;
  const lastAt = d.navPoints.at(-1)?.at;
  // Anchor the synthetic baseline on the last real point, else on NOW — never
  // on the Unix epoch (which rendered "Jan 1 / Jan 2" 1970 axis labels).
  const anchorMs = typeof lastAt === "number" ? lastAt : Date.now();
  const navChartPoints =
    d.navPoints.length >= 2
      ? d.navPoints
      : [
          { at: anchorMs - DAY_MS, value: d.deployedValueUsdc },
          { at: anchorMs, value: d.deployedValueUsdc },
        ];

  const onlinePct =
    d.uptimeSegments.find((s) => s.cause === "online")?.pct ?? 0;
  const uptimeCauses = orderedUptime(d.uptimeSegments).filter(
    (s) => s.cause !== "online",
  );

  // Operational pilot readings are only meaningful once the vault runs. At zero
  // (or an empty feed) there is nothing to report yet — show "—" and drop the
  // accent tone so a $0 vault never reads as "0 J/TH" / "0.0% online" (a false
  // "in trouble" signal) nor lights the efficiency bullet green.
  const availabilityPending = zero || d.uptimeSegments.length === 0 || onlinePct <= 0;
  const efficiencyPending = zero || d.efficiency.value <= 0;
  const efficiencyTone: "accent" | "warning" | "neutral" = efficiencyPending
    ? "neutral"
    : d.efficiency.value <= d.efficiency.target
      ? "accent"
      : "warning";

  return (
    <div className="dark flex flex-col rounded-2xl bg-surface-page [--gutter:theme(spacing.8)] mb-8">
      <div className="flex flex-col gap-y-8 p-5 lg:p-6">
        {/* Margin strip — a single discreet line above the console: held-vault
            links + Subscribe (left) · demo timeline control (right). Plain text
            links, no pills/badges/filled buttons in the body. Only rendered when
            there's something to show (2+ vaults, zero-state Subscribe, or demo). */}
        {isDemo || d.positionsCount >= 2 || zero ? (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 -mt-1 mb-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
              {d.positionsCount >= 2 ? (
                <nav aria-label="Switch vault" className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
                  <span className="ct-bento-label shrink-0">Vaults</span>
                  {d.positionsSummary.map((p) => (
                    <Link
                      key={p.id}
                      href={`/portfolio/${p.id}`}
                      className="inline-flex items-baseline gap-1.5 text-[length:var(--ct-text-nano)] ct-text-muted transition-colors hover:text-[var(--ct-text-strong)]"
                    >
                      <span>{p.vaultName}</span>
                      <span className="tabular-nums">{formatUsdFull(p.valueUsdc)}</span>
                    </Link>
                  ))}
                </nav>
              ) : null}
              {zero ? (
                <Link
                  href="/vaults"
                  className="text-[length:var(--ct-text-nano)] ct-link-accent"
                >
                  Subscribe to a vault →
                </Link>
              ) : null}
            </div>
            {isDemo ? (
              <DemoTimelineControl
                showFixtureSeed={
                  (session?.email ?? "").trim().toLowerCase() === ZAND_FIXTURE_EMAIL
                }
              />
            ) : null}
          </div>
        ) : null}

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
            {/* Header: just the title. No chips, no badges, no CTA button — the
                chart is the hero; the Subscribe link lives in the top margin. */}
            <div className="flex flex-wrap items-center gap-3 p-5 lg:px-6 lg:pt-6 lg:pb-2">
              <h1 className="h1 shrink-0">
                Vault <span className="h1-accent">Health</span>
              </h1>
            </div>
            <div className="px-5 lg:px-6">
              <HcValueChart
                points={navChartPoints}
                height={340}
                aria-label="Vault value over time"
              />
            </div>
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
          <StatBand items={healthStats} />
          {/* No distance-to-liquidation gauge is drawn ANYWHERE yet: the 62%
              margin was a pilot placeholder with no attested collateral / LLTV
              feed behind it, so rendering it on a live position would present a
              made-up number as a live reading. One honest note per state
              instead; the gauge ships with the attested feed. */}
          <div className="border-t border-[var(--ct-border-soft)] p-5">
            <span className="ct-metric-caption text-[length:var(--ct-text-nano)] leading-snug">
              {zero
                ? "Not funded yet — there is no live collateral position to margin. Collateral, debt and the distance-to-liquidation gauge activate on your first subscription."
                : !d.safetyIsLive
                  ? `No live safety margin on a ${d.lifecycle} vault — there is no active collateral position to margin. The figures above are historical.`
                  : "Distance-to-liquidation activates with the attested collateral & LLTV feed — no placeholder margin is shown on a live position."}
            </span>
          </div>

          {/* Capital + pockets — no separate card: same surface, split from the
              safety block above by a single internal hairline (donut + legend on
              the left, per-pocket breakdown on the right). One card, full height. */}
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
          <div className="grid grid-cols-1 items-center gap-6 p-5 @[48rem]:grid-cols-[auto_1fr]">
            {/* Donut + labelled legend — the at-a-glance allocation view.
                Stacks on mobile so the fixed-width ring never forces a body scroll. */}
            <div className="flex flex-col items-center gap-5 sm:flex-row">
              <div className="shrink-0">
                <AssetRing
                  segments={pocketRing}
                  centerLabel="Deposit"
                  centerValue={formatUsdFull(d.pocketTotalUsdc)}
                  size={156}
                  thickness={20}
                  aria-label="Pocket allocation ring"
                />
              </div>
              <ul className="flex flex-col gap-2.5">
                {d.pockets.map((p) => (
                  <li key={p.label} className="flex items-center gap-2">
                    <AssetBadge asset={p.asset} size={16} />
                    <span className="min-w-0 flex-1 truncate text-[length:var(--ct-text-xs)] ct-text-body">
                      {p.label}
                    </span>
                    <span className="ct-metric-value text-[length:var(--ct-text-sm)]">
                      {p.pct}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            {/* Per-pocket breakdown (% · $ · bar · role) — the detailed read. */}
            <PocketCards pockets={d.pockets} format={formatUsdFull} />
          </div>

          {/* Lock-up — same card, split from Capital above by one internal
              hairline. Its own header row carries the (attested) badge. */}
          <div className="flex items-center justify-between gap-3 border-t border-[var(--ct-border-soft)] px-5 py-4">
            <span className="ct-bento-label">Lock-up</span>
            <ProvenanceBadge kind="attested" variant="compact" />
          </div>
          <div className="flex flex-col gap-3 px-5 pb-5">
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

        {/* ── Act: Mining engine — fleet-level operational readings. Rates are
            Estimated (fleet telemetry / placeholders, never per-investor); the
            zero state is an explicitly Simulated preview. The investor's real
            distributions live in the Yield & distributions act below. */}
        <TitledDivider
          title={
            zero
              ? "Mining engine · allocated power · pilot"
              : "Mining engine · operations"
          }
          trailing={
            <ProvenanceBadge
              kind={zero ? "simulated" : "estimated"}
              variant="compact"
            />
          }
        />
        <section className="grid grid-cols-1 @[54rem]:grid-cols-[1.3fr_1fr] gap-5">
          <div className={SUPPORT}>
            <CardHeader
              title="Operational health"
              trailing={<ProvenanceBadge kind="estimated" variant="compact" />}
            />
            <div className="flex flex-col gap-3 p-5">
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
                      {availabilityPending ? (
                        <span className="text-[length:var(--ct-text-sm)] font-medium ct-text-muted">
                          — <span className="text-[length:var(--ct-text-nano)]">pending</span>
                        </span>
                      ) : (
                        <>
                          <span className="text-[length:var(--ct-text-sm)] font-medium ct-text-strong tabular-nums">
                            {onlinePct.toFixed(1)}%
                          </span>
                          <span className="ml-1 text-[length:var(--ct-text-nano)] ct-text-muted">online</span>
                        </>
                      )}
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
                      value={efficiencyPending ? 0 : d.efficiency.value}
                      min={18}
                      max={d.efficiency.max}
                      target={d.efficiency.target}
                      ranges={[d.efficiency.ranges[0], d.efficiency.ranges[1]]}
                      tone={efficiencyTone}
                      aria-label={
                        efficiencyPending
                          ? "Efficiency pending — awaiting attested feed (pilot)"
                          : `Efficiency ${d.efficiency.value} J/TH, target ${d.efficiency.target} (pilot)`
                      }
                    />
                    <span className="justify-self-end whitespace-nowrap text-right">
                      {efficiencyPending ? (
                        <span className="text-[length:var(--ct-text-sm)] font-medium ct-text-muted">
                          — <span className="text-[length:var(--ct-text-nano)]">pending</span>
                        </span>
                      ) : (
                        <>
                          <span className="text-[length:var(--ct-text-sm)] font-medium ct-text-strong tabular-nums">
                            {d.efficiency.value}
                          </span>
                          <span className="ml-1 text-[length:var(--ct-text-nano)] ct-text-muted">J/TH</span>
                        </>
                      )}
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
          {zero ? (
            /* Zero-state preview: the pilot orchestration topology + sample
               rebalancing feed, so a not-yet-funded investor sees what the
               operational layer will look like. Clearly Simulated. */
            <div className={`${SUPPORT} flex flex-col`}>
              <CardHeader
                title="Agent orchestration · pilot"
                trailing={<ProvenanceBadge kind="simulated" variant="compact" />}
              />
              <AgentCanvas
                nodes={d.orchestration.nodes}
                edges={d.orchestration.edges}
                latest={d.orchestration.latest}
                footer={<RebalancingFeed events={PILOT_REBALANCINGS} />}
              />
            </div>
          ) : (
            /* Funded: drop the fictional orchestration graph (no per-investor
               data to compute) and show the REAL vault-level rebalancing feed
               from the RebalanceEvent table — badged vault-level, not personal.
               Provenance is MANUAL (operational records written by the admin
               console — no third-party attestation to claim). Empty [] → an
               honest empty state with no badge, never the pilot sample. */
            <div className={`${SUPPORT} flex flex-col`}>
              <CardHeader
                title="Rebalancing · vault-level"
                trailing={
                  vaultRebalancings.length > 0 ? (
                    <ProvenanceBadge kind="manual" variant="compact" />
                  ) : undefined
                }
              />
              <div className="p-5">
                {vaultRebalancings.length > 0 ? (
                  <RebalancingFeed events={vaultRebalancings} provenance="manual" />
                ) : (
                  <span className="ct-metric-caption text-[length:var(--ct-text-nano)] leading-snug">
                    {d.subscribedAt && hasPriorRebalancings
                      ? "No rebalancing has been recorded since your entry. This vault does have older operational rebalancing history from before your subscription."
                      : "No rebalancing recorded on this vault yet. Rebalancings are rare, deterministic, vault-wide operational events — they apply to the whole vault, not to your individual position."}
                  </span>
                )}
              </div>
            </div>
          )}
        </section>

        {/* ── Act: Yield & distributions (real) ─────────────────────────────── */}
        <TitledDivider
          title="Yield & distributions"
          trailing={
            hasRealDistributions ? (
              <ProvenanceBadge kind={distributionsProvenance} variant="compact" />
            ) : undefined
          }
        />
        <section className="grid grid-cols-1 gap-5">
          {/* Monthly bars — the investor's OWN paid distributions, aggregated
              by calendar month. Real data or an honest empty chart; there is
              deliberately NO fabricated sample year in any state. */}
          <div className={SUPPORT}>
            <CardHeader
              title="Distributions paid · by month"
              trailing={
                hasRealDistributions ? (
                  <ProvenanceBadge kind={distributionsProvenance} variant="compact" />
                ) : undefined
              }
            />
            <div className="p-5">
              <HcBarChart
                bars={realDistributionBars}
                height={190}
                highlightLast
                emptyMessage="No distributions yet"
                aria-label={
                  hasRealDistributions
                    ? "Monthly distributions paid"
                    : "No distributions yet"
                }
              />
            </div>
          </div>
          <div className={`${SUPPORT} flex flex-col`}>
            <CardHeader title="Distribution history" />
            {/* Real distributions only. At zero / no history: a genuine empty
                state, NOT a fabricated Simulated sample ledger. */}
            {d.distributions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--ct-border-soft)]">
                      <th className="ct-bento-label px-5 py-3 text-center font-medium">Date</th>
                      <th className="ct-bento-label px-5 py-3 text-center font-medium">Amount</th>
                      <th className="ct-bento-label px-5 py-3 text-center font-medium">Currency</th>
                      <th className="ct-bento-label px-5 py-3 text-center font-medium">Vault</th>
                      <th className="ct-bento-label px-5 py-3 text-center font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.distributions.map((dist) => (
                      <tr
                        key={dist.id}
                        className="border-b border-[var(--ct-border-soft)] last:border-b-0 transition-colors hover:bg-[var(--ct-surface-inset)]"
                      >
                        {/* Date — clean full date, centered */}
                        <td className="px-5 py-4 text-center">
                          <span className="text-[length:var(--ct-text-sm)] font-medium ct-text-strong tabular-nums">
                            {DISTRIB_DATE.format(dist.paidAt)}
                          </span>
                        </td>
                        {/* Amount */}
                        <td className="px-5 py-4 text-center">
                          <span className="text-[length:var(--ct-text-base)] font-semibold ct-text-strong tabular-nums">
                            {formatUsdDetailed(dist.amountUsdc)}
                          </span>
                        </td>
                        {/* Currency — USDC logo + label, centered */}
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <AssetBadge asset="usdc" size={18} />
                            <span className="text-[length:var(--ct-text-xs)] font-medium ct-text-body">
                              USDC
                            </span>
                          </div>
                        </td>
                        {/* Vault — the product the payout came from (never
                            mislabelled as a chain/network) */}
                        <td className="px-5 py-4 text-center">
                          <span className="text-[length:var(--ct-text-xs)] ct-text-muted">
                            {dist.vaultName ?? "—"}
                          </span>
                        </td>
                        {/* Status — provenance is per-row and EARNED: tx-hashed
                            payouts are Attested, book-entry rows are Manual */}
                        <td className="px-5 py-4">
                          <div className="flex justify-center">
                            <ProvenanceBadge
                              kind={dist.txHash ? "attested" : "manual"}
                              variant="compact"
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-5">
                <span className="ct-metric-caption text-[length:var(--ct-text-nano)] leading-snug">
                  No distributions yet. Monthly USDC distributions appear here
                  once your position starts paying out.
                </span>
              </div>
            )}
          </div>
        </section>

        {/* single global disclaimer */}
        <p className="ct-metric-caption text-[length:var(--ct-text-nano)] leading-snug">
          Financial figures (deposit, value, accrued, yield paid, NAV, distributions)
          reflect your own account only; each carries its own provenance badge.
          Pockets and collateral are Estimated target allocations derived from your
          deposit. Mining rates are fleet-level operational readings (Estimated),
          never per-investor measurements. Rebalancing entries are vault-level
          operational records (Manual) — they apply to the whole vault, not to your
          individual position. Panels badged Simulated are illustrative previews,
          not records. Distributions shown are what was actually paid; forward
          figures are projections shown as a range under stated assumptions, not
          guaranteed.
        </p>
      </div>
    </div>
  );
}
