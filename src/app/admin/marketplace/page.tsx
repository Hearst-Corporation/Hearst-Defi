import {
  AdminPageShell,
  AdminSectionCard,
  TABLE_HEAD,
  TABLE_WRAP,
  ROW,
} from "@/components/admin/admin-page-shell";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/catalyst/table";
import { ApyRange } from "@/components/ui/apy-range";
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
 * Mounted on the canonical admin shell (AdminPageShell + AdminSectionCard) so
 * the surface, header grammar, and welded section cards match /customers. Each
 * detail table uses the shared Catalyst chrome (TABLE_HEAD / TABLE_WRAP / ROW);
 * KPI tile rows separate with token hairlines, never hardcoded white washes.
 *
 * `force-dynamic` so the page reflects the latest loader snapshot per request
 * (the loaders own their own short in-memory cache; the page never blocks on a
 * live upstream because every loader returns a fallback instead of throwing).
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "DeFi Marketplace — Hearst Connect",
};

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

/** Read-only KPI tile — token surfaces only, separated by hairlines in its grid. */
function MarketKpiTile({
  label,
  value,
  sub,
  accent = false,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2 p-5">
      <div className="ct-bento-label">{label}</div>
      <div
        className={cn(
          "text-[22px] font-medium leading-none tracking-tight tabular-nums",
          accent ? "text-[var(--ct-accent)]" : "ct-text-strong",
        )}
      >
        {value}
      </div>
      {sub ? <div className="ct-metric-caption">{sub}</div> : null}
    </div>
  );
}

export default async function MarketplacePage() {
  const [binance, stablecoins, lending, tvl] = await Promise.all([
    fetchBinancePrices(["BTCUSDT", "ETHUSDT"]),
    fetchStablecoinPrices(),
    fetchLendingYields(),
    fetchProtocolTvl(),
  ]);

  return (
    <AdminPageShell
      titleLead="DeFi"
      titleAccent="Marketplace"
      contextLabel="Live market data"
    >
      {/* ── Spot prices (Binance) ─────────────────────────────────────────── */}
      <AdminSectionCard
        title="Spot prices"
        subtitle="BTC / ETH · Binance 24h ticker"
        headerTrailing={
          <ProvenanceBadge kind={binance.source === "live" ? "live" : "stale"} />
        }
        ariaLabel="Spot prices"
      >
        <div className="grid min-w-0 grid-cols-1 sm:grid-cols-2">
          {binance.tickers.map((t, i, arr) => (
            <div
              key={t.symbol}
              className={cn(
                "min-w-0",
                i < arr.length - 1 &&
                  "border-b border-[var(--ct-border-soft)] sm:border-b-0 sm:border-r",
              )}
            >
              <MarketKpiTile
                label={t.symbol.replace("USDT", " / USDT")}
                value={formatUsd(t.lastPrice)}
                sub={
                  <span className="flex items-center gap-2">
                    <Trend trend={trendOf(t.priceChangePct)} />
                    <ProvenanceBadge kind={t.provenance} compact />
                  </span>
                }
              />
            </div>
          ))}
        </div>
      </AdminSectionCard>

      {/* ── Decentralized stablecoin prices ───────────────────────────────── */}
      <AdminSectionCard
        title="Stablecoin pegs"
        subtitle="On-chain decentralized stablecoins"
        headerTrailing={
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
        ariaLabel="Stablecoin pegs"
      >
        <Table dense className={TABLE_WRAP}>
          <TableHead>
            <TableRow>
              <TableHeader className={`${TABLE_HEAD} pl-5`}>Asset</TableHeader>
              <TableHeader className={`${TABLE_HEAD} text-right`}>
                Price
              </TableHeader>
              <TableHeader className={`${TABLE_HEAD} text-right`}>
                Peg deviation
              </TableHeader>
              <TableHeader className={`${TABLE_HEAD} pr-5 text-right`}>
                Source
              </TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {stablecoins.prices.map((coin) => (
              <TableRow key={coin.symbol} className={ROW}>
                <TableCell className="ct-metric-value pl-5">
                  {coin.symbol}
                </TableCell>
                <TableCell className="ct-metric-value text-right tabular-nums">
                  ${coin.priceUsd.toFixed(4)}
                </TableCell>
                <TableCell className="ct-metric-caption text-right tabular-nums">
                  {(coin.pegDeviationBps / 100).toFixed(2)} bps
                </TableCell>
                <TableCell className="pr-5 text-right">
                  <span className="inline-flex justify-end">
                    <ProvenanceBadge kind={coin.provenance} compact />
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="ct-metric-caption border-t border-[var(--ct-border-soft)] p-5 leading-relaxed">
          USDC / USDT / DAI read from Chainlink USD aggregators (provenance{" "}
          <span className="font-medium text-[var(--ct-text-body)]">oracle</span>)
          when a mainnet RPC is configured; crvUSD / GHO / USDe and any fallback
          from the DefiLlama coins aggregator (provenance{" "}
          <span className="font-medium text-[var(--ct-text-body)]">live</span>).
        </p>
      </AdminSectionCard>

      {/* ── Lending yields (Morpho / Compound / Aave) ─────────────────────── */}
      <AdminSectionCard
        title="Lending yields"
        subtitle="USDC supply APY · median → best pool"
        headerTrailing={
          <ProvenanceBadge kind={lending.source === "live" ? "live" : "stale"} />
        }
        ariaLabel="Lending yields"
      >
        {/* Per-protocol best APY summary — token-hairline tiles, no white washes. */}
        <div className="grid min-w-0 grid-cols-1 border-b border-[var(--ct-border-soft)] md:grid-cols-3">
          {lending.protocols.map((p, i, arr) => (
            <div
              key={p.protocol}
              className={cn(
                "min-w-0",
                i < arr.length - 1 &&
                  "border-b border-[var(--ct-border-soft)] md:border-b-0 md:border-r",
              )}
            >
              <MarketKpiTile
                label={p.label}
                accent
                value={
                  <ApyRange
                    className="font-medium tabular-nums text-[var(--ct-accent)]"
                    low={Math.min(p.apyMedianPct, p.topPool.apyPct)}
                    high={p.topPool.apyPct}
                    precision={2}
                  />
                }
                sub={`${p.poolCount} pool${p.poolCount > 1 ? "s" : ""} · ${formatUsdCompact(p.tvlUsd)} TVL`}
              />
            </div>
          ))}
        </div>
        {/* Top pools detail */}
        <Table dense className={TABLE_WRAP}>
          <TableHead>
            <TableRow>
              <TableHeader className={`${TABLE_HEAD} pl-5`}>
                Protocol
              </TableHeader>
              <TableHeader className={TABLE_HEAD}>Chain</TableHeader>
              <TableHeader className={`${TABLE_HEAD} text-right`}>
                APY (base → total)
              </TableHeader>
              <TableHeader className={`${TABLE_HEAD} text-right`}>
                Reward
              </TableHeader>
              <TableHeader className={`${TABLE_HEAD} pr-5 text-right`}>
                TVL
              </TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {lending.pools.slice(0, 10).map((pool, i) => (
              <TableRow key={`${pool.protocol}-${pool.chain}-${i}`} className={ROW}>
                <TableCell className="ct-metric-value pl-5 capitalize">
                  {pool.protocol}
                </TableCell>
                <TableCell className="ct-metric-caption">{pool.chain}</TableCell>
                <TableCell className="text-right">
                  <ApyRange
                    className="font-medium tabular-nums ct-text-strong"
                    low={pool.apyBasePct}
                    high={pool.apyPct}
                    precision={2}
                  />
                </TableCell>
                <TableCell className="ct-metric-caption text-right tabular-nums">
                  {pool.apyRewardPct > 0
                    ? `+${pool.apyRewardPct.toFixed(2)}%`
                    : "—"}
                </TableCell>
                <TableCell className="ct-metric-caption pr-5 text-right tabular-nums">
                  {formatUsdCompact(pool.tvlUsd)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AdminSectionCard>

      {/* ── Protocol TVL ──────────────────────────────────────────────────── */}
      <AdminSectionCard
        title="Protocol TVL"
        subtitle="Total value locked · DefiLlama"
        headerTrailing={
          <ProvenanceBadge kind={tvl.source === "live" ? "live" : "stale"} />
        }
        ariaLabel="Protocol TVL"
      >
        <div className="grid min-w-0 grid-cols-1 border-b border-[var(--ct-border-soft)] md:grid-cols-3">
          {tvl.protocols.map((p, i, arr) => (
            <div
              key={p.protocol}
              className={cn(
                "min-w-0",
                i < arr.length - 1 &&
                  "border-b border-[var(--ct-border-soft)] md:border-b-0 md:border-r",
              )}
            >
              <MarketKpiTile
                label={p.label}
                value={formatUsdCompact(p.tvlUsd)}
                sub={
                  <span className="flex items-center gap-2">
                    <span className="font-mono ct-text-muted">{p.slug}</span>
                    <ProvenanceBadge kind={p.provenance} compact />
                  </span>
                }
              />
            </div>
          ))}
        </div>
        <p className="ct-metric-caption p-5 tabular-nums">
          Combined tracked TVL:{" "}
          <span className="font-medium ct-text-strong">
            {formatUsdCompact(tvl.totalTvlUsd)}
          </span>
        </p>
      </AdminSectionCard>
    </AdminPageShell>
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
      ? "text-[var(--ct-accent)]"
      : trend.direction === "down"
        ? "text-[var(--ct-status-danger)]"
        : "ct-text-muted";
  const glyph =
    trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→";
  return (
    <span className={cn("font-mono text-[11px] font-medium tabular-nums", tone)}>
      {glyph} {trend.text}
    </span>
  );
}
