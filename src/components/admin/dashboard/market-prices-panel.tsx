import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { fetchBinancePrices } from "@/lib/data/binance-price";
import { cn } from "@/lib/cn";

import {
  AdminDashboardCard,
  AdminDashboardCardHeader,
  AdminDashboardInset,
} from "./AdminDashboardSection";

function formatUsd(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function Trend({ pct }: { pct: number }) {
  const up = pct > 0;
  const flat = pct === 0;
  return (
    <span
      className={cn(
        "ct-metric-caption mono tabular-nums",
        flat ? "ct-text-muted" : up ? "ct-status-success" : "ct-status-danger",
      )}
    >
      {flat ? "→" : up ? "↑" : "↓"} {Math.abs(pct).toFixed(2)}%
    </span>
  );
}

function symbolLabel(symbol: string): string {
  if (symbol === "BTCUSDT") return "Bitcoin";
  if (symbol === "ETHUSDT") return "Ethereum";
  return symbol.replace("USDT", "");
}

export async function MarketPricesPanel() {
  const snapshot = await fetchBinancePrices(["BTCUSDT", "ETHUSDT"]);
  const provenance = snapshot.source === "live" ? "live" : "stale";

  return (
    <AdminDashboardCard variant="quiet" ariaLabel="Market prices panel">
      <AdminDashboardCardHeader
        title="Market prices"
        trailing={<ProvenanceBadge kind={provenance} variant="strip" />}
      />

      <AdminDashboardInset className="grid grid-cols-1 sm:grid-cols-2">
        {snapshot.tickers.map((t, i, arr) => (
          <div
            key={t.symbol}
            className={cn(
              "flex min-w-0 flex-col gap-2 p-5",
              i < arr.length - 1 &&
                "border-b border-[var(--ct-border-soft)] sm:border-b-0 sm:border-r",
            )}
          >
            <div className="ct-bento-label">
              {symbolLabel(t.symbol)}
              <span className="ml-1.5 opacity-[var(--ct-opacity-50)]">/ USDT</span>
            </div>
            <div className="ct-bento-metric ct-bento-metric--accent">
              {formatUsd(t.lastPrice)}
            </div>
            <div className="flex items-center gap-2">
              <Trend pct={t.priceChangePct} />
              <ProvenanceBadge kind={t.provenance} compact />
            </div>
          </div>
        ))}
      </AdminDashboardInset>
    </AdminDashboardCard>
  );
}
