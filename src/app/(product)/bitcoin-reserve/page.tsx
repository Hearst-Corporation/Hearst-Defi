// /bitcoin-reserve — the Bitcoin Strategic Reserve console (P1 vertical slice).
//
// Bloomberg/Aladdin grammar: dense, dark, numbers-first. One assembly point —
// `loadBitcoinReserveView` — feeds every figure on this page, each carrying
// its own honest provenance badge (never "live" on a derived number). Reuses
// the DS StatBand/EmptySurface/ProvenanceBadge primitives already shipped for
// /portfolio, PLUS the HIS chart primitives (`HcChartCard`, `HcCompositionRing`,
// `HcBullet`, `HcBarChart`) so important KPIs render as real visuals instead of
// stacked stat cells — no new component, no new hex, no new CSS layer (RULE #0).
//
// Investor share: called WITHOUT `share` (operation-level, unscaled fleet
// view) for this first pass — wiring an investor's principal/capacity slice
// into fleet production is a follow-up once the (product) session→investor
// lookup is threaded through here the same way /portfolio does it.
//
// Server Component — gated by `requireInvestor` (same pattern as /profile).

import type { ReactNode } from "react";

import { PortfolioLeafHeader } from "@/components/portfolio/portfolio-leaf-header";
import { EmptySurface } from "@/components/catalyst/empty-surface";
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import { HcChartCard } from "@/components/dataviz/his/HcChartCard";
import { HcCompositionRing } from "@/components/dataviz/his/HcCompositionRing";
import { HcBarChart, type HcBar } from "@/components/dataviz/his/HcBarChart";
import { requireInvestor } from "@/lib/auth/require-investor";
import { loadBitcoinReserveView } from "@/lib/data/bitcoin-reserve-view";
import { formatBtc, formatHashrate } from "@/lib/format/btc";
import { formatUsdCompact } from "@/lib/format/usd-compact";
import { formatUsdFull } from "@/lib/vaults/product-display";

import { HcBullet } from "../portfolio/preview/_charts/bullet";
import type { StatCell } from "../portfolio/preview/_charts/stat-band";
import { StatBand } from "../portfolio/preview/_charts/stat-band";

export const dynamic = "force-dynamic";

export const metadata = { title: "Bitcoin Reserve — Hearst Connect" };

/** Bare-hairline support surface (matches /portfolio's SUPPORT recipe). */
const SUPPORT =
  "rounded-2xl border border-[var(--ct-border)] bg-surface-card overflow-hidden";
const HERO_SHADOW = "var(--ct-shadow-depth), var(--ct-glass-bevel-subtle)";

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

/**
 * Weakest-link provenance for a value derived by multiplying two sourced
 * figures together (BTC reserve × BTC price). The combined figure can never
 * read stronger than its weakest input — "attested" reserve × "stale" price
 * must present as "estimated", not silently inherit "attested".
 */
function combinedProvenance(a: Provenance, b: Provenance): Provenance {
  const rank: Record<Provenance, number> = {
    live: 6,
    oracle: 5,
    attested: 4,
    manual: 3,
    partial: 2,
    estimated: 1,
    simulated: 1,
    stale: 0,
  };
  const weaker = rank[a] <= rank[b] ? a : b;
  // A multiplication is always a derivation, even when both inputs are strong
  // (attested reserve × oracle price) — the PRODUCT is not itself attested or
  // oracle-sourced, so cap the combined read at "estimated" unless the
  // weakest input already reads "stale" (which must still win, honestly).
  return weaker === "stale" ? "stale" : "estimated";
}

export default async function BitcoinReservePage() {
  await requireInvestor("/bitcoin-reserve");
  const view = await loadBitcoinReserveView();

  const {
    btcPrice,
    networkHashrateThs,
    difficulty,
    halving,
    btcReserve,
    economics,
    fleetProduction,
    futureValue,
  } = view;

  const reserveUsd = btcReserve.value * btcPrice.value;
  const reserveUsdProvenance = combinedProvenance(btcReserve.provenance, btcPrice.provenance);

  const overviewStats: StatCell[] = [
    {
      label: "BTC Price",
      value: formatUsdFull(btcPrice.value),
      provenance: btcPrice.provenance,
      live: btcPrice.provenance === "live" || btcPrice.provenance === "oracle",
    },
    {
      label: "Network Hashrate",
      value: formatHashrate(networkHashrateThs.value),
      provenance: networkHashrateThs.provenance,
      live: networkHashrateThs.provenance === "live",
    },
    {
      label: "Difficulty",
      value: difficulty.value > 0 ? difficulty.value.toLocaleString("en-US") : "—",
      provenance: difficulty.provenance,
      live: difficulty.provenance === "live",
    },
    {
      label: "Next Halving",
      value:
        halving.value.estimatedDaysRemaining > 0
          ? `~${Math.round(halving.value.estimatedDaysRemaining)} days`
          : "—",
      provenance: halving.provenance,
    },
  ];

  const economicsStats: StatCell[] | null = economics
    ? [
        {
          label: "Cost to Produce 1 BTC",
          value: formatUsdFull(economics.value.costToProduce1BtcUsd),
          provenance: economics.provenance,
        },
        {
          label: "Market Price",
          value: formatUsdFull(btcPrice.value),
          provenance: btcPrice.provenance,
          live: btcPrice.provenance === "live" || btcPrice.provenance === "oracle",
        },
        {
          label: "Production Margin",
          value: `${economics.value.productionMarginPerBtcUsd >= 0 ? "+" : ""}${formatUsdFull(
            economics.value.productionMarginPerBtcUsd,
          )}`,
          provenance: economics.provenance,
        },
        {
          label: "Break-even BTC Price",
          value: formatUsdFull(economics.value.breakEvenBtcPriceUsd),
          provenance: economics.provenance,
        },
        {
          label: "Estimated Profit / BTC",
          value: `${economics.value.estimatedProfitPerBtcUsd >= 0 ? "+" : ""}${formatUsdFull(
            economics.value.estimatedProfitPerBtcUsd,
          )}`,
          provenance: economics.provenance,
        },
      ]
    : null;

  const fleetStats: StatCell[] | null = fleetProduction
    ? [
        {
          label: "BTC / Day",
          value: formatBtc(fleetProduction.value.btcPerDay),
          affix: "BTC",
          provenance: fleetProduction.provenance,
        },
        {
          label: "BTC / Month",
          value: formatBtc(fleetProduction.value.btcPerMonth),
          affix: "BTC",
          provenance: fleetProduction.provenance,
        },
        {
          label: "BTC / Year",
          value: formatBtc(fleetProduction.value.btcPerYear),
          affix: "BTC",
          provenance: fleetProduction.provenance,
        },
      ]
    : null;

  // Mining economics as a bullet graph: cost-to-produce is the featured bar,
  // market price is the comparative target tick — the gap between them IS the
  // production margin, made visually obvious instead of four rows to read.
  // Scale spans [0, max(cost, price) * 1.15] so both bars/tick have headroom.
  const economicsBullet = economics
    ? (() => {
        const cost = economics.value.costToProduce1BtcUsd;
        const price = btcPrice.value;
        const max = Math.max(cost, price, 1) * 1.15;
        const beatsBuying = cost < price;
        return { cost, price, max, beatsBuying };
      })()
    : null;

  // Fleet production as 3 comparable bars (day / month / year) — the year bar
  // dwarfs day/month at true scale, so each series renders on ITS OWN honest
  // axis via 3 separate small bars would misrepresent scale; instead we keep
  // day+month (same order of magnitude framing) as the primary 2-bar visual
  // and let the StatBand-style year figure stay in the supporting text row
  // via the chart's own y-axis (bars share one axis, scaled to the max of the
  // three — the year bar reads tall on purpose, which is the honest story:
  // production compounds).
  const fleetBars: readonly HcBar[] | null = fleetProduction
    ? [
        { label: "Day", value: fleetProduction.value.btcPerDay, tooltip: `${formatBtc(fleetProduction.value.btcPerDay)} BTC` },
        { label: "Month", value: fleetProduction.value.btcPerMonth, tooltip: `${formatBtc(fleetProduction.value.btcPerMonth)} BTC` },
        { label: "Year", value: fleetProduction.value.btcPerYear, tooltip: `${formatBtc(fleetProduction.value.btcPerYear)} BTC` },
      ]
    : null;

  return (
    <div className="dark flex flex-col rounded-2xl bg-surface-page [--gutter:theme(spacing.8)] mb-8">
      <div className="flex flex-col gap-y-8 p-5 lg:p-6">
        <PortfolioLeafHeader
          titleLead="Bitcoin"
          titleAccent="Reserve"
          kicker="RESERVE MANAGEMENT"
        />

        {/* S1 — HERO: Bitcoin Reserve, the biggest number on the page. The
            reserve renders as a filled visual object (composition ring, BTC
            share vs. a USD-equivalent reference) rather than a plain text
            row — the two figures are the SAME reserve viewed two ways, not a
            portfolio breakdown, so the ring exists to give the hero panel
            visual weight, not to imply an allocation. */}
        <section
          className="relative overflow-hidden rounded-2xl border border-[var(--ct-border)] bg-surface-card"
          style={{ boxShadow: HERO_SHADOW }}
          aria-label="Bitcoin reserve"
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
            <div className="flex flex-wrap items-center gap-3 p-5 lg:px-6 lg:pt-6 lg:pb-2">
              <h1 className="h1 shrink-0">
                Bitcoin <span className="h1-accent">Reserve</span>
              </h1>
            </div>
            <div className="border-t border-[var(--ct-border-soft)] flex flex-col gap-6 p-5 lg:flex-row lg:items-center lg:gap-8 lg:px-6 lg:py-6">
              <div className="shrink-0">
                {/*
                  Categorical ramp is [mining, usdc, btc, hedge, neutral] —
                  two zero-value placeholder segments push the real reserve
                  onto index 2 (--ct-cat-btc, amber). A 0-value segment draws
                  a 0-length arc (no phantom colour), so this stays a single
                  honest amber ring, never green/red on a BTC figure.
                */}
                <HcCompositionRing
                  size={168}
                  palette="categorical"
                  centerLabel="Reserve"
                  centerValue={formatBtc(btcReserve.value, { unit: false })}
                  showLegend={false}
                  segments={[
                    { label: "—", value: 0 },
                    { label: "—", value: 0 },
                    { label: "BTC reserve", value: Math.max(btcReserve.value, 0) || 1 },
                  ]}
                  aria-label="Bitcoin reserve, filled ring"
                />
              </div>
              <div className="min-w-0 flex-1 border-t border-[var(--ct-border-soft)] pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
                <StatBand
                  items={[
                    {
                      label: "Bitcoin Reserve",
                      value: formatBtc(btcReserve.value, { unit: false }),
                      affix: "BTC",
                      provenance: btcReserve.provenance,
                      valueTone: "btc",
                      hero: true,
                    },
                    {
                      label: "USD Equivalent",
                      value: formatUsdFull(reserveUsd),
                      provenance: reserveUsdProvenance,
                      hero: true,
                    },
                  ]}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── Act: Market & network ─────────────────────────────────────── */}
        <TitledDivider title="Market & network" />
        <div className={SUPPORT}>
          <StatBand items={overviewStats} />
        </div>

        {/* ── Act: Mining economics ──────────────────────────────────────── */}
        <TitledDivider
          title="Mining economics"
          trailing={
            economicsStats ? (
              <ProvenanceBadge
                kind="estimated"
                variant="compact"
                description="Estimated — pure derivation over live price/hashrate and a reference machine cost basis, never a measurement."
              />
            ) : undefined
          }
        />
        {economicsBullet && economicsStats ? (
          <HcChartCard
            title="Cost to produce vs. market price"
            subtitle="Featured bar = cost to produce 1 BTC · tick = market price. The gap is the production margin."
            source="estimated"
            state="ready"
            height={132}
            aria-label="Mining economics — cost to produce vs market price"
          >
            <div className="flex h-full flex-col justify-center gap-4">
              <HcBullet
                value={economicsBullet.cost}
                max={economicsBullet.max}
                target={economicsBullet.price}
                tone={economicsBullet.beatsBuying ? "accent" : "warning"}
                minLabel="$0"
                maxLabel={formatUsdCompact(economicsBullet.max)}
                valueLabel={`Cost to produce ${formatUsdCompact(economicsBullet.cost)} · market ${formatUsdCompact(economicsBullet.price)}`}
                aria-label={`Cost to produce ${formatUsdFull(economicsBullet.cost)} per BTC vs market price ${formatUsdFull(economicsBullet.price)}`}
              />
              <div className="grid grid-cols-1 gap-x-6 gap-y-3 @[28rem]:grid-cols-3">
                <div className="flex flex-col gap-0.5">
                  <span className="ct-metric-caption">Production margin</span>
                  <span className="ct-text-strong tabular-nums text-(length:--ct-text-base)">
                    {economics!.value.productionMarginPerBtcUsd >= 0 ? "+" : ""}
                    {formatUsdFull(economics!.value.productionMarginPerBtcUsd)}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="ct-metric-caption">Break-even BTC price</span>
                  <span className="ct-text-strong tabular-nums text-(length:--ct-text-base)">
                    {formatUsdFull(economics!.value.breakEvenBtcPriceUsd)}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="ct-metric-caption">Estimated profit / BTC</span>
                  <span className="ct-text-strong tabular-nums text-(length:--ct-text-base)">
                    {economics!.value.estimatedProfitPerBtcUsd >= 0 ? "+" : ""}
                    {formatUsdFull(economics!.value.estimatedProfitPerBtcUsd)}
                  </span>
                </div>
              </div>
            </div>
          </HcChartCard>
        ) : (
          <div className={SUPPORT}>
            <EmptySurface
              message="Mining Economics activates once a reference machine cost basis is available."
              detail="Cost-to-produce, margin and break-even price derive from the current machine-market snapshot — no landed-cost row exists yet, so no figure is fabricated."
            />
          </div>
        )}

        {/* ── Act: Fleet production ──────────────────────────────────────── */}
        <TitledDivider
          title="Fleet production"
          trailing={
            fleetStats ? (
              <ProvenanceBadge
                kind="estimated"
                variant="compact"
                description="Estimated — fleet-level operational reading, not a per-investor measurement."
              />
            ) : undefined
          }
        />
        {fleetBars ? (
          <HcChartCard
            title="BTC produced"
            subtitle="Day · month · year, at the current fleet hashrate and network difficulty."
            metric={`${formatBtc(fleetProduction!.value.btcPerDay)} BTC / day`}
            metricCompact
            source="estimated"
            state="ready"
            height={220}
            aria-label="Fleet production — BTC per day, month, year"
          >
            <HcBarChart
              bars={fleetBars}
              height={200}
              valueFormat={(v) => formatBtc(v, { unit: false })}
              highlightLast
              aria-label="BTC produced by day, month, year"
            />
          </HcChartCard>
        ) : (
          <div className={SUPPORT}>
            <EmptySurface
              message="Fleet Production activates once fleet telemetry is recorded."
              detail="BTC/day, /month and /year derive from deployed-hashrate readings — no MiningMetric rows exist yet, so no figure is fabricated."
            />
          </div>
        )}

        {/* ── Act: Reserve growth ──────────────────────────────────────────
            No real BTC-reserve time series exists — the loader only returns
            a current snapshot. An honest empty state, never a synthesized
            history line (RULE #0 — no fabricated data). */}
        <TitledDivider title="Reserve growth" />
        <div className={SUPPORT}>
          <EmptySurface
            variant="chart"
            message="Reserve growth chart arrives once historical BTC-reserve snapshots are tracked."
            detail="This view shows the current attested reserve balance only; a trend line requires a time series of custody snapshots, which is not yet recorded."
          />
        </div>

        {/* ── Act: Future Value Simulator ───────────────────────────────── */}
        <TitledDivider
          title="Future Value Simulator"
          trailing={
            <ProvenanceBadge
              kind="estimated"
              variant="compact"
              description="Estimated — deterministic what-if over the current reserve, not a forecast."
            />
          }
        />
        <HcChartCard
          title="Portfolio value by BTC price scenario"
          subtitle="Deterministic what-if at 4 target BTC prices, current reserve held constant — not a forecast."
          metric={formatUsdFull(futureValue.value.currentValueUsd)}
          metricCompact
          source="estimated"
          state="ready"
          height={240}
          disclaimer="Not guaranteed — a deterministic what-if over the current reserve at stated target prices, not a forecast. BTC price is volatile and can fall as well as rise; these scenarios assume no change to the underlying BTC reserve itself."
          aria-label="Future value simulator — portfolio value by BTC price scenario"
        >
          <HcBarChart
            bars={futureValue.value.scenarios.map((scenario) => ({
              label: formatUsdCompact(scenario.targetPriceUsd),
              value: scenario.futurePortfolioValueUsd,
              tooltip: `${formatUsdFull(scenario.futurePortfolioValueUsd)} (${scenario.roiPct >= 0 ? "+" : ""}${scenario.roiPct.toFixed(1)}% · ${scenario.multiple.toFixed(2)}x)`,
            }))}
            height={220}
            valueFormat={formatUsdCompact}
            aria-label="Future portfolio value at each BTC price scenario"
          />
        </HcChartCard>
        <div className={SUPPORT}>
          <div className="grid grid-cols-1 gap-px bg-(--ct-border-soft) @[40rem]:grid-cols-2 @[64rem]:grid-cols-4">
            {futureValue.value.scenarios.map((scenario) => (
              <div
                key={scenario.targetPriceUsd}
                className="flex flex-col gap-3 bg-surface-card px-5 py-6"
              >
                <div className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: "var(--ct-cat-btc)" }}
                  />
                  <span className="ct-bento-label truncate">
                    BTC @ {formatUsdFull(scenario.targetPriceUsd)}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="ct-metric-caption">Gain</span>
                    <span className="ct-text-strong tabular-nums text-(length:--ct-text-sm)">
                      {scenario.gainUsd >= 0 ? "+" : ""}
                      {formatUsdFull(scenario.gainUsd)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="ct-metric-caption">ROI</span>
                    <span className="ct-text-strong tabular-nums text-(length:--ct-text-sm)">
                      {scenario.roiPct >= 0 ? "+" : ""}
                      {scenario.roiPct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="ct-metric-caption">Multiple</span>
                    <span className="ct-text-strong tabular-nums text-(length:--ct-text-sm)">
                      {scenario.multiple.toFixed(2)}x
                    </span>
                  </div>
                </div>
                <ProvenanceBadge kind="estimated" variant="compact" />
              </div>
            ))}
          </div>
        </div>

        {/* single global disclaimer */}
        <p className="ct-metric-caption text-[length:var(--ct-text-nano)] leading-snug">
          Bitcoin Reserve reflects real custody data where attested (reserve
          balance); every other figure on this page — USD equivalents, mining
          economics, fleet production, and the Future Value Simulator — is a
          derived estimate under stated assumptions, not a measurement and not
          guaranteed. This is an operation-level (fleet-wide) view, not scaled
          to an individual investor's share.
        </p>
      </div>
    </div>
  );
}
