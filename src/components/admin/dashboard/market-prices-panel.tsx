import { BentoPanel } from "@/components/catalyst/bento";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { AdminLeafLink } from "./cockpit-panel-header";
import { fetchBinancePrices } from "@/lib/data/binance-price";
import { cn } from "@/lib/cn";

/**
 * Synchronous skeleton shown while the async {@link MarketPricesPanel} resolves
 * the live Binance snapshot. Mirrors the panel's shell (header + two price cells)
 * so the Suspense fallback holds layout without shift. DS-token only, no hardcode.
 * This is what a synchronous SSR pass (e.g. renderToStaticMarkup in tests) renders.
 */
export function MarketPricesPanelFallback() {
  return (
    <BentoPanel aria-label="Market prices panel">
      <div className="ct-bento-panel-header flex items-center justify-between">
        <h3 className="ct-bento-card-title">Market prices</h3>
        <AdminLeafLink href="/admin/marketplace" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 bg-surface-inset">
        {["Bitcoin", "Ethereum"].map((label, i, arr) => (
          <div
            key={label}
            className={cn(
              "flex flex-col gap-2 p-5",
              i < arr.length - 1 &&
                "border-b border-[var(--ct-border-soft)] sm:border-b-0 sm:border-r",
            )}
          >
            <div className="ct-bento-label">
              {label}
              <span className="ml-1.5 opacity-[var(--ct-opacity-50)]">/ USDT</span>
            </div>
            <div className="ct-bento-metric ct-text-muted">—</div>
            <div className="ct-metric-caption ct-text-muted">awaiting live snapshot</div>
          </div>
        ))}
      </div>
    </BentoPanel>
  );
}

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
        "ct-metric-caption font-mono tabular-nums",
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
    <BentoPanel aria-label="Market prices panel">
      <div className="ct-bento-panel-header flex items-center justify-between">
        <h3 className="ct-bento-card-title">Market prices</h3>
        <div className="flex items-center gap-2">
          <ProvenanceBadge kind={provenance} variant="strip" />
          <AdminLeafLink href="/admin/marketplace" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 bg-surface-inset">
        {snapshot.tickers.map((t, i, arr) => (
          <div
            key={t.symbol}
            className={cn(
              "flex flex-col gap-2 p-5",
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
      </div>
    </BentoPanel>
  );
}
