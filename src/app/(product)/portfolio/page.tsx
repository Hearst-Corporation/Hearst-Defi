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

import {
  HcBarChart,
  HcChartCard,
  HcCompositionRing,
  HcValueChart,
  type HcSourceStatus,
} from "@/components/dataviz/his";
import { EmptySurface } from "@/components/catalyst/empty-surface";
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import { getSession } from "@/lib/auth/session";
import { loadBitcoinReserveView } from "@/lib/data/bitcoin-reserve-view";
import { loadPortfolioCockpit } from "@/lib/data/portfolio-cockpit";
import { loadVaultRebalancings } from "@/lib/data/vault-rebalancings";
import { isDemoAccount } from "@/lib/demo/allowlist";
import { ZAND_FIXTURE_EMAIL } from "@/lib/demo/zand-fixture";
import { formatBtc, formatHashrate } from "@/lib/format/btc";
import { formatUsdCompact } from "@/lib/format/usd-compact";
import { loadMachineMarket } from "@/lib/telegram/read-machines";
import {
  formatUsdDetailed,
  formatUsdFull,
} from "@/lib/vaults/product-display";

import "./preview/_styles.css";
import { AgentCanvas } from "./preview/_charts/agent-canvas";
import { AssetBadge } from "./preview/_charts/asset-badge";
import { AssetRing } from "./preview/_charts/asset-ring";
import { HcMeter } from "./preview/_charts/meter";
import { PocketCards } from "./preview/_charts/pocket-cards";
import { RebalancingFeed, type RebalancingEvent } from "./preview/_charts/rebalancing-feed";
import { StatBand, type StatCell } from "./preview/_charts/stat-band";
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

// Estimated institutional machine assumptions used to translate the B1 mining
// allocation into an indicative "machines + total hashrate" view for LPs.
const FALLBACK_MACHINE_PRICE_USDC = 3_500;
const FALLBACK_MACHINE_HASHRATE_TH = 234;

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
  const [d, session, machineMarket, btcReserveView] = await Promise.all([
    loadPortfolioCockpit(),
    getSession(),
    loadMachineMarket(),
    // Operation-level view (no investor `share`): the Bitcoin Reserve hero is
    // the platform's own custody balance, not a per-investor allocation — the
    // existing "Mining engine" act below already covers the investor's OWN
    // allocated slice via `share`-scaled mining-metrics.
    loadBitcoinReserveView(),
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

  // ── Bitcoin Strategic Reserve hero (Dashboard re-hero — Bitcoin becomes the
  // primary KPI, yield/APY steps down to a supporting role). Built from
  // `loadBitcoinReserveView()` (operation-level custody + live market data),
  // not the per-investor position above — this is the platform's own
  // reserve, distinct from "your deposit"/"your yield" further down the page.
  const {
    btcPrice,
    networkHashrateThs,
    halving,
    btcReserve,
    economics,
    fleetProduction,
  } = btcReserveView;

  // Combined USD value of the reserve is a DERIVED figure (reserve × price) —
  // its provenance is the weaker of the two sources, never a copy of
  // btcReserve's "attested": a stale price makes the combined figure
  // "estimated" even though the BTC balance itself stays attested.
  const btcReserveUsdProvenance: Provenance =
    btcPrice.provenance === "stale" ? "estimated" : "attested";
  const btcReserveUsd = btcReserve.value * btcPrice.value;

  const bitcoinMarketStats: readonly StatCell[] = [
    {
      label: "BTC Price",
      value: formatUsdFull(btcPrice.value),
      provenance: btcPrice.provenance,
      live: btcPrice.provenance === "live" || btcPrice.provenance === "oracle",
      valueTone: "btc",
    },
    {
      label: "Network Hashrate",
      value: formatHashrate(networkHashrateThs.value),
      provenance: networkHashrateThs.provenance,
    },
    {
      label: "Mining Difficulty",
      value: btcReserveView.difficulty.value.toLocaleString("en-US", {
        maximumFractionDigits: 0,
      }),
      provenance: btcReserveView.difficulty.provenance,
    },
    {
      label: "Next Halving",
      value: `~${Math.max(0, Math.round(halving.value.estimatedDaysRemaining)).toLocaleString("en-US")}`,
      affix: "days",
      valueTone: "btc",
      provenance: halving.provenance,
    },
  ];

  const miningEconomicsStats: readonly StatCell[] | null = economics
    ? [
        {
          label: "Cost to Produce 1 BTC",
          value: formatUsdFull(economics.value.costToProduce1BtcUsd),
          provenance: economics.provenance,
        },
        {
          label: "Bitcoin Market Price",
          value: formatUsdFull(btcPrice.value),
          provenance: btcPrice.provenance,
          live: btcPrice.provenance === "live" || btcPrice.provenance === "oracle",
          valueTone: "btc",
        },
        {
          label: "Production Margin",
          value: `${economics.value.productionMarginPerBtcUsd >= 0 ? "+" : ""}${formatUsdFull(economics.value.productionMarginPerBtcUsd)}`,
          provenance: economics.provenance,
        },
        {
          label: "Break-even BTC Price",
          value: formatUsdFull(economics.value.breakEvenBtcPriceUsd),
          provenance: economics.provenance,
        },
      ]
    : null;

  const fleetProductionStats: readonly StatCell[] | null = fleetProduction
    ? [
        {
          label: "Est. Daily Production",
          value: formatBtc(fleetProduction.value.btcPerDay, { unit: true }),
          provenance: fleetProduction.provenance,
        },
        {
          label: "Est. Monthly Production",
          value: formatBtc(fleetProduction.value.btcPerMonth, { unit: true }),
          provenance: fleetProduction.provenance,
        },
      ]
    : null;

  // ── Chart-driven presentation of the two figures above (same numbers, richer
  // read) — a composition ring for cost-vs-price and a period-comparison bar
  // chart for the fleet estimate. Both are pure re-derivations for display: no
  // new numbers, no new provenance.
  const economicsMarginPositive =
    !!economics && economics.value.productionMarginPerBtcUsd >= 0;
  const economicsRingSegments = economics
    ? [
        { label: "Cost to produce 1 BTC", value: Math.max(0, economics.value.costToProduce1BtcUsd) },
        { label: "Production margin", value: Math.max(0, economics.value.productionMarginPerBtcUsd) },
      ]
    : [];
  // Weaker of the two feeding sources (mirrors the `btcReserveUsdProvenance`
  // pattern above) — the ring/metric never reads stronger than its inputs.
  const economicsSource: HcSourceStatus | undefined = economics
    ? btcPrice.provenance === "stale"
      ? "estimated"
      : (economics.provenance as HcSourceStatus)
    : undefined;

  const productionBars = fleetProduction
    ? [
        { label: "Day", value: fleetProduction.value.btcPerDay },
        { label: "Month", value: fleetProduction.value.btcPerMonth },
        { label: "Year", value: fleetProduction.value.btcPerYear },
      ]
    : [];

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

        {/* S0 — BITCOIN STRATEGIC RESERVE HERO. Bitcoin is the primary KPI —
            this is now the single dominant band on the page; the former
            "Vault Health" hero (NAV chart + stat band) follows below as its
            own act, repositioned rather than removed. The big Reserve number
            renders neutral/white per the DS rule (a solid-amber figure reads
            as a warning, not an asset) — amber lives on the "BTC" affix and
            the identity dot only. */}
        <section
          className="relative overflow-hidden rounded-2xl border border-[var(--ct-border)] bg-surface-card"
          style={{ boxShadow: HERO_SHADOW }}
          aria-label="Bitcoin Strategic Reserve"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 left-1/4 h-64 w-[min(680px,80%)] opacity-[0.07]"
            style={{
              background:
                "radial-gradient(ellipse at center, var(--ct-cat-btc) 0%, transparent 70%)",
            }}
          />
          <div className="relative z-10 flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-3 p-5 lg:px-6 lg:pt-6 lg:pb-2">
              <h1 className="h1 shrink-0">
                Bitcoin <span className="h1-accent">Strategic Reserve</span>
              </h1>
              <span className="ct-metric-caption text-[length:var(--ct-text-nano)] leading-snug">
                Build, monitor and grow your Bitcoin reserve through institutional mining infrastructure.
              </span>
            </div>
            <div className="px-5 pb-2 lg:px-6">
              <StatBand
                items={[
                  {
                    label: "Bitcoin Reserve",
                    value: formatBtc(btcReserve.value),
                    affix: "BTC",
                    valueTone: "btc",
                    hero: true,
                    provenance: btcReserve.provenance,
                  },
                  {
                    label: "Reserve Value",
                    value: formatUsdFull(btcReserveUsd),
                    provenance: btcReserveUsdProvenance,
                  },
                ]}
              />
            </div>
            <div className="mt-2 border-t border-[var(--ct-border-soft)]">
              <StatBand items={bitcoinMarketStats} />
            </div>
          </div>
        </section>

        {/* ── Act: Mining Economics — the spec calls this one of the most
            important sections: it demonstrates mining's economic value vs
            buying BTC outright (cost to produce vs market price). Rendered as
            a chart-first panel (composition ring + headline margin) instead
            of four flat text cells — the same figures, a richer read. Honest
            null-guard: no reference machine-cost basis available → an
            explicit empty state, never a fabricated figure. */}
        <TitledDivider
          title="Mining Economics"
          trailing={<ProvenanceBadge kind="estimated" variant="compact" />}
        />
        {miningEconomicsStats && economics && economicsSource ? (
          <section className="grid grid-cols-1 @[54rem]:grid-cols-[1fr_1.1fr] gap-5">
            <HcChartCard
              title="Cost to produce vs. production margin"
              subtitle="Fully-loaded cost to mine 1 BTC (energy + amortized CAPEX) set against today's production margin per BTC."
              metric={`${economicsMarginPositive ? "+" : ""}${formatUsdFull(economics.value.productionMarginPerBtcUsd)}`}
              metricCompact
              delta={{
                label: "Production margin / BTC",
                tone: economicsMarginPositive ? "positive" : "negative",
              }}
              source={economicsSource}
              height={200}
              disclaimer="Estimated — a pure derivation from live BTC price and network hashrate over a reference machine cost basis, never a measurement of your own position."
              aria-label="Cost to produce 1 BTC vs. production margin"
            >
              <div className="flex h-full items-center justify-center">
                <HcCompositionRing
                  segments={economicsRingSegments}
                  size={176}
                  centerLabel="Per BTC"
                  centerValue={formatUsdCompact(btcPrice.value)}
                  bars
                  aria-label="Cost to produce vs. production margin, share of BTC price"
                />
              </div>
            </HcChartCard>
            <div className={SUPPORT}>
              <StatBand
                items={[
                  miningEconomicsStats[1] as StatCell,
                  miningEconomicsStats[0] as StatCell,
                  miningEconomicsStats[3] as StatCell,
                ]}
              />
            </div>
          </section>
        ) : (
          <div className={SUPPORT}>
            <div className="p-5">
              <EmptySurface
                message="Mining Economics is not available yet."
                detail="Cost to produce, production margin and break-even BTC price activate once a reference machine cost basis is available."
              />
            </div>
          </div>
        )}

        {/* ── Act: Mining Production — fleet-level BTC production estimate,
            read as a period-comparison bar chart (day/month/year, same
            underlying rate) rather than two flat stat cells — makes the
            compounding read visually instead of only in the numbers. Honest
            null-guard: no MiningMetric telemetry yet → empty state. */}
        {fleetProductionStats && fleetProduction ? (
          <HcChartCard
            title="Mining Production"
            subtitle="Estimated fleet BTC production at current uptime and network hashrate, by period."
            source={fleetProduction.provenance as HcSourceStatus}
            height={220}
            disclaimer="Estimated — fleet-level telemetry, never a per-investor measurement."
            aria-label="Fleet BTC production by period"
          >
            <HcBarChart
              bars={productionBars}
              height={220}
              valueFormat={(v) => formatBtc(v, { unit: true })}
              highlightLast={false}
              emptyMessage="No production data yet"
              aria-label="Estimated BTC production — day, month, year"
            />
          </HcChartCard>
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
              <h2 className="ct-section-title shrink-0">Vault position</h2>
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
