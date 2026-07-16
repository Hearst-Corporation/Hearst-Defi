import Image from "next/image";

import { fetchBinancePrices } from "@/lib/data/binance-price";
import { fetchLendingYields } from "@/lib/data/lending-yields";
import { fetchProtocolTvl } from "@/lib/data/protocol-tvl";
import { fetchStablecoinPrices } from "@/lib/data/stablecoin-prices";
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
import { ApyRange } from "@/components/catalyst/apy-range";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "DeFi Marketplace — Hearst Connect",
};

// ── Asset icon registry ────────────────────────────────────────────────────────

const CRYPTO_ICON: Record<string, string> = {
  BTC:      "/crypto-icons/btc.svg",
  ETH:      "/crypto-icons/eth.svg",
  USDC:     "/crypto-icons/usdc.svg",
  USDT:     "/crypto-icons/usdt.svg",
  DAI:      "/crypto-icons/dai.svg",
  CRVUSD:   "/crypto-icons/crv.svg",
  GHO:      "/crypto-icons/gho.svg",
  USDE:     "/crypto-icons/usde.svg",
  aave:     "/crypto-icons/aave.svg",
  compound: "/crypto-icons/compound.svg",
  morpho:   "/crypto-icons/morpho.svg",
};

const PROTOCOL_WORDMARK: Record<string, { src: string; w: number; h: number; cls: string }> = {
  aave:     { src: "/crypto-icons/aave-wordmark.svg",     w: 94,  h: 16, cls: "h-3 w-auto" },
  compound: { src: "/crypto-icons/compound-wordmark.svg", w: 121, h: 27, cls: "h-4 w-auto" },
  morpho:   { src: "/crypto-icons/morpho-wordmark.svg",   w: 104, h: 21, cls: "h-4 w-auto" },
};

// ── Shared micro-components ────────────────────────────────────────────────────

function CryptoIcon({ id, size = 16 }: { id: string; size?: number }) {
  const src = CRYPTO_ICON[id];
  if (!src) return null;
  return (
    <Image
      src={src}
      alt={id}
      width={size}
      height={size}
      className="shrink-0 rounded-full"
    />
  );
}

function ProtocolWordmark({ id }: { id: string }) {
  const wm = PROTOCOL_WORDMARK[id];
  if (!wm) return <span className="ct-bento-label capitalize">{id}</span>;
  return <Image src={wm.src} alt={id} width={wm.w} height={wm.h} className={wm.cls} />;
}

function SpotLabel({ symbol }: { symbol: string }) {
  const base = symbol.replace("USDT", "");
  return (
    <span className="flex items-center justify-center gap-1.5">
      <CryptoIcon id={base} size={16} />
      {base} / USDT
    </span>
  );
}

function Trend({ direction, text }: { direction: "up" | "down" | "flat"; text: string }) {
  const tone =
    direction === "up"
      ? "text-[var(--ct-accent)]"
      : direction === "down"
        ? "ct-status-danger"
        : "ct-text-muted";
  const glyph = direction === "up" ? "↑" : direction === "down" ? "↓" : "→";
  return (
    <span
      className={cn(
        "mono text-[length:var(--ct-text-micro)] font-medium tabular-nums",
        tone,
      )}
    >
      {glyph} {text}
    </span>
  );
}

function MarketKpiTile({
  label,
  value,
  sub,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-2 p-5 text-center">
      <div className="ct-bento-label">{label}</div>
      <div className="text-[length:var(--ct-text-2xl)] font-medium leading-none tracking-tight tabular-nums ct-text-strong">
        {value}
      </div>
      {sub ? <div className="ct-metric-caption">{sub}</div> : null}
    </div>
  );
}

// ── Formatters ─────────────────────────────────────────────────────────────────

function formatUsd(n: number, maximumFractionDigits = 2): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits });
}

function formatUsdCompact(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)         return `$${(n / 1_000).toFixed(1)}K`;
  return formatUsd(n, 0);
}

function trendProps(pct: number): { direction: "up" | "down" | "flat"; text: string } {
  return {
    direction: pct > 0 ? "up" : pct < 0 ? "down" : "flat",
    text: `${Math.abs(pct).toFixed(2)}%`,
  };
}

// ── Shared grid wrapper (KPI tile row) ─────────────────────────────────────────

function KpiGrid({
  cols = 3,
  children,
}: {
  cols?: 2 | 3;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid min-w-0 grid-cols-1 border-b border-[var(--ct-border-soft)] bg-[var(--ct-surface-inset)]",
        cols === 2 ? "sm:grid-cols-2" : "md:grid-cols-3",
      )}
    >
      {children}
    </div>
  );
}

function KpiCell({
  last,
  cols,
  children,
}: {
  last: boolean;
  cols: 2 | 3;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "min-w-0",
        !last &&
          (cols === 2
            ? "border-b border-[var(--ct-border-soft)] sm:border-b-0 sm:border-r"
            : "border-b border-[var(--ct-border-soft)] md:border-b-0 md:border-r"),
      )}
    >
      {children}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

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
      {/* Spot prices */}
      <AdminSectionCard
        title="Spot prices"
        subtitle="BTC / ETH · Binance 24h ticker"
        headerTrailing={
          <ProvenanceBadge kind={binance.source === "live" ? "live" : "stale"} />
        }
        ariaLabel="Spot prices"
      >
        <KpiGrid cols={2}>
          {binance.tickers.map((t, i, arr) => {
            const noReading = t.provenance === "stale" && t.lastPrice <= 0;
            return (
              <KpiCell key={t.symbol} last={i === arr.length - 1} cols={2}>
                <MarketKpiTile
                  label={<SpotLabel symbol={t.symbol} />}
                  value={noReading ? "—" : formatUsd(t.lastPrice)}
                  sub={
                    <span className="flex items-center gap-2">
                      {noReading ? (
                        <span className="ct-metric-caption">No reading</span>
                      ) : (
                        <Trend {...trendProps(t.priceChangePct)} />
                      )}
                      <ProvenanceBadge kind={t.provenance} compact />
                    </span>
                  }
                />
              </KpiCell>
            );
          })}
        </KpiGrid>
      </AdminSectionCard>

      {/* Stablecoin pegs */}
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
              <TableHeader className={`${TABLE_HEAD} text-right`}>Price</TableHeader>
              <TableHeader className={`${TABLE_HEAD} text-right`}>Peg deviation</TableHeader>
              <TableHeader className={`${TABLE_HEAD} pr-5 text-right`}>Source</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {stablecoins.prices.map((coin) => (
              <TableRow key={coin.symbol} className={ROW}>
                <TableCell className="pl-5">
                  <span className="flex items-center gap-2">
                    <CryptoIcon id={coin.symbol.toUpperCase()} size={16} />
                    <span className="ct-metric-value">{coin.symbol}</span>
                  </span>
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
          <span className="font-medium ct-text-body">oracle</span>) when a mainnet RPC is
          configured; crvUSD / GHO / USDe and any fallback from the DefiLlama coins aggregator
          (provenance <span className="font-medium ct-text-body">live</span>).
        </p>
      </AdminSectionCard>

      {/* Lending yields */}
      <AdminSectionCard
        title="Lending yields"
        subtitle="USDC supply APY · median → best pool"
        headerTrailing={
          <ProvenanceBadge kind={lending.source === "live" ? "live" : "stale"} />
        }
        ariaLabel="Lending yields"
      >
        <KpiGrid cols={3}>
          {lending.protocols.map((p, i, arr) => (
            <KpiCell key={p.protocol} last={i === arr.length - 1} cols={3}>
              <MarketKpiTile
                label={<ProtocolWordmark id={p.protocol} />}
                value={
                  <ApyRange
                    className="font-medium tabular-nums ct-text-strong"
                    low={Math.min(p.apyMedianPct, p.topPool.apyPct)}
                    high={p.topPool.apyPct}
                    precision={2}
                  />
                }
                sub={`${p.poolCount} pool${p.poolCount > 1 ? "s" : ""} · ${formatUsdCompact(p.tvlUsd)} TVL`}
              />
            </KpiCell>
          ))}
        </KpiGrid>
        <Table dense className={TABLE_WRAP}>
          <TableHead>
            <TableRow>
              <TableHeader className={`${TABLE_HEAD} pl-5`}>Protocol</TableHeader>
              <TableHeader className={TABLE_HEAD}>Chain</TableHeader>
              <TableHeader className={`${TABLE_HEAD} text-right`}>APY (base → total)</TableHeader>
              <TableHeader className={`${TABLE_HEAD} text-right`}>Reward</TableHeader>
              <TableHeader className={`${TABLE_HEAD} pr-5 text-right`}>TVL</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {lending.pools.slice(0, 10).map((pool, i) => (
              <TableRow key={`${pool.protocol}-${pool.chain}-${i}`} className={ROW}>
                <TableCell className="pl-5">
                  <span className="flex items-center gap-2">
                    <CryptoIcon id={pool.protocol} size={16} />
                    <span className="ct-metric-value capitalize">{pool.protocol}</span>
                  </span>
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
                  {pool.apyRewardPct > 0 ? `+${pool.apyRewardPct.toFixed(2)}%` : "—"}
                </TableCell>
                <TableCell className="ct-metric-caption pr-5 text-right tabular-nums">
                  {formatUsdCompact(pool.tvlUsd)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AdminSectionCard>

      {/* Protocol TVL */}
      <AdminSectionCard
        title="Protocol TVL"
        subtitle="Total value locked · DefiLlama"
        headerTrailing={
          <ProvenanceBadge kind={tvl.source === "live" ? "live" : "stale"} />
        }
        ariaLabel="Protocol TVL"
      >
        <KpiGrid cols={3}>
          {tvl.protocols.map((p, i, arr) => (
            <KpiCell key={p.protocol} last={i === arr.length - 1} cols={3}>
              <MarketKpiTile
                label={<ProtocolWordmark id={p.protocol} />}
                value={p.provenance === "stale" ? "—" : formatUsdCompact(p.tvlUsd)}
                sub={
                  <span className="flex items-center justify-center gap-2">
                    <span className="mono ct-text-muted">{p.slug}</span>
                    <ProvenanceBadge kind={p.provenance} compact />
                  </span>
                }
              />
            </KpiCell>
          ))}
        </KpiGrid>
        <p className="ct-metric-caption p-5 tabular-nums">
          Combined tracked TVL:{" "}
          <span className="font-medium ct-text-strong">{formatUsdCompact(tvl.totalTvlUsd)}</span>
        </p>
      </AdminSectionCard>
    </AdminPageShell>
  );
}
