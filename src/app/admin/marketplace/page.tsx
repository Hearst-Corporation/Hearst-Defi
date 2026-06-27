import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminTable } from "@/components/admin/admin-table-layout";
import { ApyRange } from "@/components/ui/apy-range";
import { Metric } from "@/components/ui/metric";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";

import { fetchBinancePrices } from "@/lib/data/binance-price";
import { fetchLendingYields } from "@/lib/data/lending-yields";
import { fetchProtocolTvl } from "@/lib/data/protocol-tvl";
import { fetchStablecoinPrices } from "@/lib/data/stablecoin-prices";

/**
 * /admin/marketplace — read-only live crypto/DeFi market data.
 *
 * Composes the four free, no-key market-data loaders (Binance spot REST,
 * Chainlink/DefiLlama stablecoin prices, DefiLlama lending yields, DefiLlama
 * protocol TVL). Every figure carries an honest provenance badge: oracle for
 * Chainlink, live for the REST/aggregator feeds, stale on fallback. No
 * financial action, no writes — purely informational.
 *
 * `force-dynamic` so the page reflects the latest loader snapshot per request
 * (the loaders own their own short in-memory cache; the page never blocks on a
 * live upstream because every loader returns a fallback instead of throwing).
 */
export const dynamic = "force-dynamic";

function formatUsd(n: number, maximumFractionDigits = 2): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits,
  });
}

/** Compact USD for large figures: $1.2B / $640.0M / $12.3K. */
function formatUsdCompact(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return formatUsd(n, 0);
}

function trendOf(pct: number): { direction: "up" | "down" | "flat"; text: string } {
  const direction = pct > 0 ? "up" : pct < 0 ? "down" : "flat";
  return { direction, text: `${Math.abs(pct).toFixed(2)}%` };
}

export default async function MarketplacePage() {
  const [binance, stablecoins, lending, tvl] = await Promise.all([
    fetchBinancePrices(["BTCUSDT", "ETHUSDT"]),
    fetchStablecoinPrices(),
    fetchLendingYields(),
    fetchProtocolTvl(),
  ]);

  return (
    <>
      <AdminPageHeader
        titleLead="DeFi"
        titleAccent="Marketplace"
        contextLabel="Live market data"
        description="Spot prices, decentralized stablecoin pegs, lending yields and protocol TVL — sourced from free public feeds (Binance, Chainlink, DefiLlama). Read-only; every figure is provenance-tagged."
      />

      {/* ── Spot prices (Binance) ─────────────────────────────────────────── */}
      <section className="admin-doc-stack admin-doc-stack--relaxed">
        <div className="admin-doc-row-spread">
          <h2 className="h2">Spot prices</h2>
          <ProvenanceBadge kind={binance.source === "live" ? "live" : "stale"} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-(--ct-space-4)">
          {binance.tickers.map((t) => (
            <Metric
              key={t.symbol}
              label={t.symbol.replace("USDT", " / USDT")}
              value={formatUsd(t.lastPrice)}
              trend={trendOf(t.priceChangePct)}
              provenance={t.provenance}
              tooltip="Spot price via Binance REST /api/v3/ticker/24hr (24h change)."
            />
          ))}
        </div>
      </section>

      {/* ── Decentralized stablecoin prices ───────────────────────────────── */}
      <section className="admin-doc-stack admin-doc-stack--relaxed">
        <div className="admin-doc-row-spread">
          <h2 className="h2">Stablecoin pegs</h2>
          <ProvenanceBadge kind={stablecoins.source === "oracle" ? "oracle" : stablecoins.source === "live" ? "live" : "stale"} />
        </div>
        <AdminTable
          data={stablecoins.prices}
          headers={["Asset", "Price", "Peg deviation", "Source"]}
          colWidths={["w-[28%]", "w-[24%]", "w-[26%]", "w-[22%]"]}
          renderRow={(coin) => (
            <>
              <td className="ct-table-cell ct-text-strong">{coin.symbol}</td>
              <td className="ct-table-cell text-right tabular-nums ct-text-strong">
                ${coin.priceUsd.toFixed(4)}
              </td>
              <td className="ct-table-cell text-right tabular-nums ct-text-muted">
                {(coin.pegDeviationBps / 100).toFixed(2)} bps
              </td>
              <td className="ct-table-cell">
                <ProvenanceBadge kind={coin.provenance} compact />
              </td>
            </>
          )}
        />
        <p className="body-xs ct-text-muted">
          USDC / USDT / DAI read from Chainlink USD aggregators (provenance{" "}
          <span className="ct-text-body">oracle</span>) when a mainnet RPC is
          configured; crvUSD / GHO / USDe and any fallback from the DefiLlama
          coins aggregator (provenance <span className="ct-text-body">live</span>).
        </p>
      </section>

      {/* ── Lending yields (Morpho / Compound / Aave) ─────────────────────── */}
      <section className="admin-doc-stack admin-doc-stack--relaxed">
        <div className="admin-doc-row-spread">
          <h2 className="h2">Lending yields</h2>
          <ProvenanceBadge kind={lending.source === "live" ? "live" : "stale"} />
        </div>
        {/* Per-protocol best APY summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-(--ct-space-4)">
          {lending.protocols.map((p) => (
            <Metric
              key={p.protocol}
              label={p.label}
              value={
                <ApyRange
                  low={Math.min(p.apyMedianPct, p.topPool.apyPct)}
                  high={p.topPool.apyPct}
                  precision={2}
                />
              }
              sublabel={`${p.poolCount} pool${p.poolCount > 1 ? "s" : ""} · ${formatUsdCompact(p.tvlUsd)} TVL`}
              provenance={lending.source === "live" ? "live" : "stale"}
              tooltip="USDC supply APY (median → best) across qualifying pools on Ethereum/Base/Arbitrum/Optimism, via DefiLlama."
            />
          ))}
        </div>
        {/* Top pools detail */}
        <AdminTable
          data={lending.pools.slice(0, 10)}
          headers={["Protocol", "Chain", "APY (base → total)", "Reward", "TVL"]}
          colWidths={["w-[22%]", "w-[16%]", "w-[28%]", "w-[16%]", "w-[18%]"]}
          renderRow={(pool) => (
            <>
              <td className="ct-table-cell ct-text-strong capitalize">{pool.protocol}</td>
              <td className="ct-table-cell ct-text-muted">{pool.chain}</td>
              <td className="ct-table-cell text-right">
                <ApyRange low={pool.apyBasePct} high={pool.apyPct} precision={2} />
              </td>
              <td className="ct-table-cell text-right tabular-nums body-xs ct-text-muted">
                {pool.apyRewardPct > 0 ? `+${pool.apyRewardPct.toFixed(2)}%` : "—"}
              </td>
              <td className="ct-table-cell text-right tabular-nums ct-text-muted">
                {formatUsdCompact(pool.tvlUsd)}
              </td>
            </>
          )}
        />
      </section>

      {/* ── Protocol TVL ──────────────────────────────────────────────────── */}
      <section className="admin-doc-stack admin-doc-stack--relaxed">
        <div className="admin-doc-row-spread">
          <h2 className="h2">Protocol TVL</h2>
          <ProvenanceBadge kind={tvl.source === "live" ? "live" : "stale"} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-(--ct-space-4)">
          {tvl.protocols.map((p) => (
            <Metric
              key={p.protocol}
              label={p.label}
              value={formatUsdCompact(p.tvlUsd)}
              sublabel={p.slug}
              provenance={p.provenance}
              tooltip={`Total value locked, DefiLlama /tvl/${p.slug}.`}
            />
          ))}
        </div>
        <p className="body-xs ct-text-muted tabular-nums">
          Combined tracked TVL:{" "}
          <span className="ct-text-strong">{formatUsdCompact(tvl.totalTvlUsd)}</span>
        </p>
      </section>
    </>
  );
}
