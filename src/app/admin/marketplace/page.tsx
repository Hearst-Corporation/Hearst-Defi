import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminTable } from "@/components/admin/admin-table-layout";
import { ApyRange } from "@/components/ui/apy-range";
import { BentoHeader, BentoKpiTile, BentoPanel } from "@/components/ui/bento";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";

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
    <div className="dark mb-8 flex flex-col rounded-2xl border border-white/10 bg-zinc-900">
      <div className="flex flex-col gap-y-5 p-5 lg:p-6">
        <AdminPageHeader
          titleLead="DeFi"
          titleAccent="Marketplace"
          contextLabel="Live market data"
          description="Spot prices, decentralized stablecoin pegs, lending yields and protocol TVL — sourced from free public feeds (Binance, Chainlink, DefiLlama). Read-only; every figure is provenance-tagged."
        />

        {/* ── Spot prices (Binance) ─────────────────────────────────────────── */}
        <BentoPanel>
          <BentoHeader
            title="Spot prices"
            subtitle="BTC / ETH · Binance 24h ticker"
            trailing={
              <ProvenanceBadge kind={binance.source === "live" ? "live" : "stale"} />
            }
          />
          <div className="grid grid-cols-1 gap-px bg-white/5 sm:grid-cols-2">
            {binance.tickers.map((t) => (
              <BentoKpiTile
                key={t.symbol}
                label={t.symbol.replace("USDT", " / USDT")}
                value={formatUsd(t.lastPrice)}
                sub={
                  <span className="flex items-center gap-2">
                    <Trend trend={trendOf(t.priceChangePct)} />
                    <ProvenanceBadge kind={t.provenance} compact />
                  </span>
                }
                className="bg-black"
              />
            ))}
          </div>
        </BentoPanel>

        {/* ── Decentralized stablecoin prices ───────────────────────────────── */}
        <BentoPanel>
          <BentoHeader
            title="Stablecoin pegs"
            subtitle="On-chain decentralized stablecoins"
            trailing={
              <ProvenanceBadge
                kind={
                  stablecoins.source === "oracle"
                    ? "oracle"
                    : stablecoins.source === "live"
                      ? "live"
                      : "stale"
                }
              />
            }
          />
          <AdminTable
            className="rounded-none border-0 shadow-none"
            data={stablecoins.prices}
            headers={["Asset", "Price", "Peg deviation", "Source"]}
            colWidths={["w-[28%]", "w-[24%]", "w-[26%]", "w-[22%]"]}
            renderRow={(coin) => (
              <>
                <td className="px-5 py-3 align-middle text-[13px] font-medium text-white">
                  {coin.symbol}
                </td>
                <td className="px-5 py-3 text-right align-middle font-medium tabular-nums text-white">
                  ${coin.priceUsd.toFixed(4)}
                </td>
                <td className="px-5 py-3 text-right align-middle tabular-nums text-zinc-400">
                  {(coin.pegDeviationBps / 100).toFixed(2)} bps
                </td>
                <td className="px-5 py-3 align-middle">
                  <ProvenanceBadge kind={coin.provenance} compact />
                </td>
              </>
            )}
          />
          <p className="border-t border-white/5 p-5 text-[12px] leading-relaxed text-zinc-400">
            USDC / USDT / DAI read from Chainlink USD aggregators (provenance{" "}
            <span className="font-medium text-zinc-200">oracle</span>) when a
            mainnet RPC is configured; crvUSD / GHO / USDe and any fallback from
            the DefiLlama coins aggregator (provenance{" "}
            <span className="font-medium text-zinc-200">live</span>).
          </p>
        </BentoPanel>

        {/* ── Lending yields (Morpho / Compound / Aave) ─────────────────────── */}
        <BentoPanel>
          <BentoHeader
            title="Lending yields"
            subtitle="USDC supply APY · median → best pool"
            trailing={
              <ProvenanceBadge kind={lending.source === "live" ? "live" : "stale"} />
            }
          />
          {/* Per-protocol best APY summary */}
          <div className="grid grid-cols-1 gap-px bg-white/5 md:grid-cols-3">
            {lending.protocols.map((p) => (
              <BentoKpiTile
                key={p.protocol}
                label={p.label}
                accent
                value={
                  <ApyRange
                    className="font-medium tabular-nums text-[#A7FB90]"
                    low={Math.min(p.apyMedianPct, p.topPool.apyPct)}
                    high={p.topPool.apyPct}
                    precision={2}
                  />
                }
                sub={`${p.poolCount} pool${p.poolCount > 1 ? "s" : ""} · ${formatUsdCompact(p.tvlUsd)} TVL`}
                className="bg-black"
              />
            ))}
          </div>
          {/* Top pools detail */}
          <AdminTable
            className="rounded-none border-0 border-t border-white/5 shadow-none"
            data={lending.pools.slice(0, 10)}
            headers={["Protocol", "Chain", "APY (base → total)", "Reward", "TVL"]}
            colWidths={["w-[22%]", "w-[16%]", "w-[28%]", "w-[16%]", "w-[18%]"]}
            renderRow={(pool) => (
              <>
                <td className="px-5 py-3 align-middle text-[13px] font-medium capitalize text-white">
                  {pool.protocol}
                </td>
                <td className="px-5 py-3 align-middle text-zinc-400">{pool.chain}</td>
                <td className="px-5 py-3 text-right align-middle">
                  <ApyRange
                    className="font-medium tabular-nums text-white"
                    low={pool.apyBasePct}
                    high={pool.apyPct}
                    precision={2}
                  />
                </td>
                <td className="px-5 py-3 text-right align-middle tabular-nums text-[12px] text-zinc-400">
                  {pool.apyRewardPct > 0 ? `+${pool.apyRewardPct.toFixed(2)}%` : "—"}
                </td>
                <td className="px-5 py-3 text-right align-middle tabular-nums text-zinc-400">
                  {formatUsdCompact(pool.tvlUsd)}
                </td>
              </>
            )}
          />
        </BentoPanel>

        {/* ── Protocol TVL ──────────────────────────────────────────────────── */}
        <BentoPanel>
          <BentoHeader
            title="Protocol TVL"
            subtitle="Total value locked · DefiLlama"
            trailing={
              <ProvenanceBadge kind={tvl.source === "live" ? "live" : "stale"} />
            }
          />
          <div className="grid grid-cols-1 gap-px bg-white/5 md:grid-cols-3">
            {tvl.protocols.map((p) => (
              <BentoKpiTile
                key={p.protocol}
                label={p.label}
                value={formatUsdCompact(p.tvlUsd)}
                sub={
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-zinc-500">{p.slug}</span>
                    <ProvenanceBadge kind={p.provenance} compact />
                  </span>
                }
                className="bg-black"
              />
            ))}
          </div>
          <p className="border-t border-white/5 p-5 text-[12px] tabular-nums text-zinc-400">
            Combined tracked TVL:{" "}
            <span className="font-medium text-white">
              {formatUsdCompact(tvl.totalTvlUsd)}
            </span>
          </p>
        </BentoPanel>
      </div>
    </div>
  );
}

/** Inline +/- change pill matching the Portfolio yield-line accent treatment. */
function Trend({
  trend,
}: {
  trend: { direction: "up" | "down" | "flat"; text: string };
}) {
  const tone =
    trend.direction === "up"
      ? "text-[#A7FB90]"
      : trend.direction === "down"
        ? "text-rose-300"
        : "text-zinc-500";
  const glyph =
    trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→";
  return (
    <span className={cn("font-mono text-[11px] font-medium tabular-nums", tone)}>
      {glyph} {trend.text}
    </span>
  );
}
