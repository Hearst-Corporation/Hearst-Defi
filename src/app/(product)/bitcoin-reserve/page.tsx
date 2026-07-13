// /bitcoin-reserve — the Bitcoin Strategic Reserve console (P1 vertical slice).
//
// Bloomberg/Aladdin grammar: dense, dark, numbers-first. One assembly point —
// `loadBitcoinReserveView` — feeds every figure on this page, each carrying
// its own honest provenance badge (never "live" on a derived number). Reuses
// the DS StatBand/EmptySurface/ProvenanceBadge primitives already shipped for
// /portfolio; no new component, no new hex, no new CSS layer (RULE #0).
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
import { requireInvestor } from "@/lib/auth/require-investor";
import { loadBitcoinReserveView } from "@/lib/data/bitcoin-reserve-view";
import { formatBtc, formatHashrate } from "@/lib/format/btc";
import { formatUsdFull } from "@/lib/vaults/product-display";

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

  return (
    <div className="dark flex flex-col rounded-2xl bg-surface-page [--gutter:theme(spacing.8)] mb-8">
      <div className="flex flex-col gap-y-8 p-5 lg:p-6">
        <PortfolioLeafHeader
          titleLead="Bitcoin"
          titleAccent="Reserve"
          kicker="RESERVE MANAGEMENT"
        />

        {/* S1 — HERO: Bitcoin Reserve, the biggest number on the page. */}
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
            <div className="border-t border-[var(--ct-border-soft)]">
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
        <div className={SUPPORT}>
          {economicsStats ? (
            <StatBand items={economicsStats} />
          ) : (
            <EmptySurface
              message="Mining Economics activates once a reference machine cost basis is available."
              detail="Cost-to-produce, margin and break-even price derive from the current machine-market snapshot — no landed-cost row exists yet, so no figure is fabricated."
            />
          )}
        </div>

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
        <div className={SUPPORT}>
          {fleetStats ? (
            <StatBand items={fleetStats} />
          ) : (
            <EmptySurface
              message="Fleet Production activates once fleet telemetry is recorded."
              detail="BTC/day, /month and /year derive from deployed-hashrate readings — no MiningMetric rows exist yet, so no figure is fabricated."
            />
          )}
        </div>

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
                    <span className="ct-metric-caption">Portfolio value</span>
                    <span className="ct-bento-metric tabular-nums text-(length:--ct-text-sm)">
                      {formatUsdFull(scenario.futurePortfolioValueUsd)}
                    </span>
                  </div>
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
          <div className="border-t border-[var(--ct-border-soft)] p-5">
            <span className="ct-metric-caption text-[length:var(--ct-text-nano)] leading-snug">
              Not guaranteed — a deterministic what-if over the current reserve at
              stated target prices, not a forecast. BTC price is volatile and can
              fall as well as rise; these scenarios assume no change to the
              underlying BTC reserve itself.
            </span>
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
