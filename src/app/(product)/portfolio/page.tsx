/**
 * /portfolio — the investor's REAL vault-health console.
 *
 * One shadowed hero (NAV chart + stat band) → acts opened by titled hairline
 * dividers (Vault health · Mining engine) → one footer disclaimer. Wired
 * end-to-end on the signed-in investor's own persisted data via
 * `loadPortfolioCockpit` — NOT the sandbox mock (this page imports NONE of
 * ./preview/_data). It starts at ZERO (no position) and fills in after the
 * first subscription.
 *
 * PRODUCT (v2 — PermissionedDynaVault, a MINING NOTE): capital is structured in
 * 3 pockets and ACCUMULATES BTC over a 24-month term with rule-based take-profit
 * (deposit ×1.24), delivered at maturity. There is NO periodic cash
 * distribution — so there is no yield-paid stat and no distributions ledger on
 * this console; rendement is BTC accumulated, shown as progress toward the +24%
 * take-profit, never a single-point APY.
 *
 * HONESTY TIERS, each carried on its own badge:
 *   • REAL      — deposit, deployed value, BTC accumulated, NAV history,
 *                 lock-up, status, APY range (estimated · non-distributed).
 *                 Rebalancings come from the real RebalanceEvent table
 *                 (vault-level ops, badged Manual — never per-investor).
 *   • ESTIMATED — DERIVED from the real deposit, labelled "target allocation":
 *                 the 3 pockets. Mining rates (uptime, efficiency) are
 *                 fleet-level readings, Estimated.
 *   • SIMULATED — zero-state preview only: the pilot orchestration topology +
 *                 sample rebalancing feed, so a not-yet-funded investor can see
 *                 the shape of the operational layer. Always badged Simulated;
 *                 never rendered on a funded position.
 *
 * Token-only (--ct-*). The charts under ./preview/_charts/* are data-agnostic
 * and reused directly.
 */
import Link from "next/link";
import type { ReactNode } from "react";

import { HcValueChart } from "@/components/dataviz/his";
import {
  CapitalFlowRail,
  type CapitalFlowPocket,
  type CapitalFlowRailData,
} from "@/features/investor-ui/components/reserve-cockpit";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { getSession } from "@/lib/auth/session";
import { loadPortfolioCockpit } from "@/lib/data/portfolio-cockpit";
import { loadVaultRebalancings } from "@/lib/data/vault-rebalancings";
import { isDemoAccount } from "@/lib/demo/allowlist";
import { ZAND_FIXTURE_EMAIL } from "@/lib/demo/zand-fixture";
import { loadMachineMarket } from "@/lib/telegram/read-machines";
import { formatUsdFull } from "@/lib/vaults/product-display";

import "./preview/_styles.css";
import { AgentCanvas } from "./preview/_charts/agent-canvas";
import { AssetBadge } from "./preview/_charts/asset-badge";
import { AssetRing } from "./preview/_charts/asset-ring";
import { HcMeter } from "./preview/_charts/meter";
import { PocketCards } from "./preview/_charts/pocket-cards";
import { RebalancingFeed, type RebalancingEvent } from "./preview/_charts/rebalancing-feed";
import { StatBand } from "./preview/_charts/stat-band";
import { ASSET_COLOR, POCKET_ASSET } from "./preview/_data/brand";
import { DemoTimelineControl } from "./demo-timeline-control";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Portfolio",
  description:
    "Your Hearst mining-note position — vault health, pockets, BTC accumulation, NAV history and advisory.",
};

/** Bare-hairline support surface (no shadow — the chrome budget reserves elevation for the hero). */
const SUPPORT =
  "rounded-2xl border border-[var(--ct-border)] bg-surface-card overflow-hidden";
const HERO_SHADOW = "var(--ct-shadow-depth), var(--ct-glass-bevel-subtle)";

/**
 * Tooltip for the pockets badges. They carry the "estimated" chrome, but they
 * are a DETERMINISTIC target split of the real deposit — NOT a forward
 * projection. This override keeps the honesty tier honest (the default
 * "estimated" copy would wrongly say "projection").
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

/**
 * PILOT sample — rebalancing notifications for the Agent orchestration footer.
 * Deterministic, newest first. There are deliberately few (rebalancings are
 * rare, deterministic events); the footer shows the latest and a scrollable
 * "History" of the rest. ALWAYS badged Simulated — advisory, held for multisig,
 * never auto-executed. v2 language: BTC accumulation / take-profit / reserve —
 * no Morpho safety-margin mechanics.
 */
const PILOT_REBALANCINGS: readonly RebalancingEvent[] = [
  { id: "rb-6", at: "Dec 2025", summary: "BTC pouch trimmed 2% into the USDC reserve ahead of the electricity draw.", tone: "done" },
  { id: "rb-5", at: "Oct 2025", summary: "Accumulation on track toward the +24% take-profit — no take-profit armed this cycle.", tone: "info" },
  { id: "rb-4", at: "Aug 2025", summary: "BTC drawdown reviewed against the take-profit rules; no action triggered.", tone: "review" },
  { id: "rb-3", at: "Jun 2025", summary: "Mining pocket rebought after hashrate NFT settlement cleared.", tone: "done" },
  { id: "rb-2", at: "Apr 2025", summary: "Electricity reserve refilled from mining cashflow — buffer restored to target.", tone: "done" },
  { id: "rb-1", at: "Feb 2025", summary: "Opening allocation set across the three pockets (mining / BTC / reserve).", tone: "info" },
];

// Estimated institutional machine assumptions used to translate the B1 mining
// allocation into an indicative "machines + total hashrate" view for LPs.
const FALLBACK_MACHINE_PRICE_USDC = 3_500;
const FALLBACK_MACHINE_HASHRATE_TH = 234;

export default async function PortfolioPage() {
  const [d, session, machineMarket] = await Promise.all([
    loadPortfolioCockpit(),
    getSession(),
    loadMachineMarket(),
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

  // ── FULL COCKPIT — ONE render path for EVERY state (zero → funded → matured) ─
  // At zero the loader (emptyCockpit) returns the same full view-model with REAL
  // figures at $0, empty real history, and the same Simulated-badged PILOT tiers
  // the funded view shows. No stripped empty card: an investor without a deposit
  // sees the complete console filled with zero / pending values, so they can read
  // exactly what they'll get after subscribing. `hasPosition` only toggles honesty
  // details (Subscribe CTA + "not funded yet" note vs the Active pulse / NAV curve).
  const zero = !d.hasPosition;

  const healthStats = d.healthStats;

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
  // Anchor the synthetic baseline on the last real point; otherwise use the
  // subscription timestamp when available, and finally a fixed modern epoch to
  // avoid 1970 labels while keeping render-time logic pure (no Date.now()).
  const anchorMs =
    typeof lastAt === "number"
      ? lastAt
      : d.subscribedAt?.getTime() ?? Date.parse("2026-01-01T00:00:00Z");
  const navChartPoints =
    d.navPoints.length >= 2
      ? d.navPoints
      : [
          { at: anchorMs - DAY_MS, value: d.deployedValueUsdc },
          { at: anchorMs, value: d.deployedValueUsdc },
        ];

  // ── Capital-flow rail data — the Series 1 narrative (deposit → 3 pockets →
  //    BTC Reserve Ledger → delivery) that exists nowhere else on this console.
  //    Pockets carry their deterministic target-allocation weight (POCKET_SPLIT),
  //    honest even at zero — the block itself labels this a target policy split.
  //    The deposit amount is only surfaced once funded (never a fabricated $0
  //    figure presented as a real deposit). Provenance follows the pockets:
  //    DERIVED / Estimated target allocation.
  const CAPITAL_FLOW_ID: readonly CapitalFlowPocket["id"][] = ["B1", "B2", "B3"];
  const capitalFlowPockets: readonly CapitalFlowPocket[] = d.pockets.map((p, i) => ({
    id: CAPITAL_FLOW_ID[i] ?? "B1",
    // Strip the "B1 · " prefix — the rail renders the id chip itself.
    label: p.label.replace(/^B[123]\s*·\s*/, ""),
    weightPct: p.pct,
  }));
  const capitalFlowData: CapitalFlowRailData | null =
    capitalFlowPockets.length > 0
      ? {
          depositLabel: "USDC",
          depositAmount: zero ? undefined : formatUsdFull(d.pocketTotalUsdc),
          pockets: capitalFlowPockets,
          ledgerLabel: "BTC Reserve Ledger",
          deliveryLabel: "Delivery at maturity",
        }
      : null;

  const b1Pocket = d.pockets.find((p) => p.label.startsWith("B1")) ?? d.pockets[0];
  const miningAllocationUsdc = b1Pocket?.valueUsdc ?? 0;
  const machineBasis =
    machineMarket.rows
      .filter((r) => r.manufacturer === "bitmain")
      .sort((a, b) => a.landedUsd - b.landedUsd)[0] ??
    machineMarket.rows.sort((a, b) => a.landedUsd - b.landedUsd)[0] ??
    null;
  const machineUnitPriceUsdc = machineBasis?.landedUsd ?? FALLBACK_MACHINE_PRICE_USDC;
  const machineUnitHashrateTh = machineBasis?.thPerUnit ?? FALLBACK_MACHINE_HASHRATE_TH;
  const machineManufacturerLabel =
    machineBasis?.manufacturer === "bitmain"
      ? "Bitmain"
      : machineBasis?.manufacturer
        ? machineBasis.manufacturer.charAt(0).toUpperCase() +
          machineBasis.manufacturer.slice(1)
        : "Bitmain";
  const allocatedMachineCount = Math.floor(
    miningAllocationUsdc / machineUnitPriceUsdc,
  );
  const allocatedHashrateTh = allocatedMachineCount * machineUnitHashrateTh;
  const allocatedHashratePh = allocatedHashrateTh / 1_000;
  const machineRemainderUsdc =
    miningAllocationUsdc - allocatedMachineCount * machineUnitPriceUsdc;
  const allocationPending = zero || allocatedMachineCount <= 0;

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
          {/* v2 is a BTC-accumulation mining note: no periodic cash
              distribution, no Morpho collateral / debt / liquidation. One honest
              note per state describing the accumulation term + take-profit. */}
          <div className="border-t border-[var(--ct-border-soft)] p-5">
            <span className="ct-metric-caption text-[length:var(--ct-text-nano)] leading-snug">
              {zero
                ? "Not funded yet — after your first subscription this vault accumulates BTC over a 24-month term, with rule-based take-profit toward +24%. There is no periodic cash distribution; the accumulated BTC is delivered at maturity."
                : "This vault accumulates BTC over a 24-month term, with rule-based take-profit toward +24%. There is no periodic cash distribution; the accumulated BTC is delivered at maturity."}
            </span>
          </div>

          {/* Capital + pockets — no separate card: same surface, split from the
              note above by a single internal hairline (donut + legend on the
              left, per-pocket breakdown on the right). One card, full height. */}
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
            <div className="flex flex-col items-center gap-5 @[26rem]:flex-row">
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

        {/* ── Act: Capital flow — the Series 1 narrative rail (deposit → B1/B2/B3
            → BTC Reserve Ledger → delivery at maturity). Not duplicated anywhere
            else: the donut above reads the split at a glance, this reads the FLOW
            end-to-end. Provenance is Estimated (target-allocation policy split
            derived from the deposit, honest even at $0). */}
        <TitledDivider
          title="Capital flow"
          trailing={
            <ProvenanceBadge
              kind="estimated"
              variant="compact"
              description={DERIVED_ALLOCATION_TIP}
            />
          }
        />
        <CapitalFlowRail data={capitalFlowData} source="estimated" />

        {/* ── Act: Mining engine — fleet-level operational readings. Rates are
            Estimated (fleet telemetry / placeholders, never per-investor); the
            zero state is an explicitly Simulated preview. */}
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
              title="Allocated mining power"
              trailing={<ProvenanceBadge kind="estimated" variant="compact" />}
            />
            <div className="flex flex-col gap-4 p-5">
              {allocationPending ? (
                <span className="ct-metric-caption text-[length:var(--ct-text-nano)] leading-snug">
                  No mining allocation yet. Once capital is allocated to B1, this
                  panel estimates your allocated fleet power from machine cost.
                </span>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-3 @[40rem]:grid-cols-2">
                    <div className="rounded-xl border border-[var(--ct-border-soft)] bg-[var(--ct-surface-inset)] px-4 py-3">
                      <span className="ct-bento-label">Estimated units</span>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span className="ct-metric-value text-[length:var(--ct-text-2xl)] tabular-nums">
                          {allocatedMachineCount.toLocaleString("en-US")}
                        </span>
                        <span className="text-[length:var(--ct-text-nano)] ct-text-muted">
                          machines
                        </span>
                      </div>
                    </div>
                    <div className="rounded-xl border border-[var(--ct-border-soft)] bg-[var(--ct-surface-inset)] px-4 py-3">
                      <span className="ct-bento-label">Total allocated power</span>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span className="ct-metric-value text-[length:var(--ct-text-2xl)] tabular-nums">
                          {allocatedHashratePh.toFixed(1)}
                        </span>
                        <span className="text-[length:var(--ct-text-nano)] ct-text-muted">
                          PH/s
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-[var(--ct-border-soft)] bg-[var(--ct-surface-inset)] px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="ct-bento-label">Mining allocation model</span>
                      <span className="text-[length:var(--ct-text-nano)] ct-text-muted">
                        Manufacturer: {machineManufacturerLabel}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-[length:var(--ct-text-nano)] ct-text-muted @[40rem]:grid-cols-3">
                      <span>B1 allocation: {formatUsdFull(miningAllocationUsdc)}</span>
                      <span>Unit cost: {formatUsdFull(machineUnitPriceUsdc)}</span>
                      <span>
                        Unallocated remainder: {formatUsdFull(Math.max(0, machineRemainderUsdc))}
                      </span>
                    </div>
                  </div>
                </>
              )}
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

        {/* single global disclaimer */}
        <p className="ct-metric-caption text-[length:var(--ct-text-nano)] leading-snug">
          Financial figures (deposit, value, BTC accumulated, NAV) reflect your
          own account only; each carries its own provenance badge. Pockets are
          Estimated target allocations derived from your deposit. This is a
          mining note: it accumulates BTC over a 24-month term with rule-based
          take-profit and has no periodic cash distribution — the accumulated BTC
          is delivered at maturity. Mining rates are fleet-level operational
          readings (Estimated), never per-investor measurements. Rebalancing
          entries are vault-level operational records (Manual) — they apply to
          the whole vault, not to your individual position. Panels badged
          Simulated are illustrative previews, not records. Forward figures are
          projections shown as a range under stated assumptions, not guaranteed.
        </p>
      </div>
    </div>
  );
}
