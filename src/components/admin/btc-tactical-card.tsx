import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import type { DashboardData } from "@/lib/data/dashboard";

interface BtcTacticalCardProps {
  data: DashboardData;
}

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});

const usdPrice = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

// Methodology v1.0 derivation for the only trigger surfaced on the card.
// `R-BTC-1` (drawdown > 20% from current price as a proxy for 90d ATH) — the
// real 90d ATH oracle lands in Phase 3. Until then we tag the row as
// estimated. Profit-take + avg-entry rows are intentionally NOT surfaced at
// MVP: they would require a cost-basis history that only exists once the
// audited ERC-4626 vault stores entry logs on-chain (Phase 3).
//
// MVP limitation: Avg entry / Unrealized P&L pending Phase 3 vault deployment
// (cost basis stored on-chain).
const ACCUMULATE_DRAWDOWN = 0.2; // R-BTC-1: BTC drawdown > 20% from 90d ATH proxy

function severityBadge(label: string, variant: "success" | "warning" | "danger") {
  return <Badge variant={variant}>{label}</Badge>;
}

interface RowProps {
  label: string;
  children: React.ReactNode;
}

function Row({ label, children }: RowProps) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5 first:pt-0 last:pb-0 border-t border-[var(--ct-border-soft)] first:border-t-0">
      <span className="body-sm ct-text-muted">{label}</span>
      <span className="body-sm ct-text-strong tabular text-right">
        {children}
      </span>
    </div>
  );
}

export function BtcTacticalCard({ data }: BtcTacticalCardProps) {
  const btcAlloc = data.allocations.find((a) => a.bucket === "btc_tactical");
  const positionPct = btcAlloc?.pct ?? 0;
  const positionUsdc = btcAlloc?.valueUsdc ?? 0;
  const currentPrice = data.btcPrice.usd;

  // No position at all — true empty state.
  const noPosition = positionPct === 0;
  // Position exists but BTC price feed is unavailable: render rows but blank
  // out everything that needs a live price (BTC held, accumulate trigger,
  // guardrails) and surface a `stale` provenance badge instead of a price.
  const priceUnavailable = !noPosition && currentPrice === 0;

  // BTC held: derive from position value at current price. When the price
  // feed is unavailable we have no cost basis stored at MVP, so display "—".
  const btcHeld =
    currentPrice > 0 && positionUsdc > 0 ? positionUsdc / currentPrice : 0;

  const accumulateAt = currentPrice * (1 - ACCUMULATE_DRAWDOWN);

  // Volatility guardrail (R-BTC-5): the engine reads BTC realised vol 30d.
  // No realised-vol feed at MVP — use the 24h change as a proxy: |change| > 5%
  // = CAUTION, > 10% = HIGH. Only meaningful when the price feed is live.
  const change24h = Math.abs(data.btcPrice.usd_24h_change);
  const volGuardrail: { label: string; variant: "success" | "warning" | "danger" } =
    change24h > 10
      ? { label: "HIGH", variant: "danger" }
      : change24h > 5
        ? { label: "CAUTION", variant: "warning" }
        : { label: "NORMAL", variant: "success" };

  // Mining margin guardrail (R-BTC-6): HEALTHY ≥ 50, else COMPRESSED.
  const marginGuardrail: { label: string; variant: "success" | "warning" } =
    data.vault.miningMarginScore >= 50
      ? { label: "HEALTHY", variant: "success" }
      : { label: "COMPRESSED", variant: "warning" };

  const priceProvenance = data.btcPrice.stale ? "stale" : "live";

  return (
    <Card className="h-full flex flex-col">
      <div className="dash-label relative z-10">
        <span className="text-micro font-bold uppercase tracking-widest ct-text-muted">BTC Tactical</span>
        <ProvenanceBadge kind="estimated" />
      </div>

      <div className="flex-1 flex flex-col mt-6 relative z-10">
        {noPosition ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="body-sm ct-text-muted italic">No BTC position yet.</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-[var(--ct-border-soft)]/50">
            <Row label="Position size">
              <span>
                {positionPct.toFixed(0)}%
                <span className="ct-text-faint"> · </span>
                {usd.format(positionUsdc)}
              </span>
            </Row>
            <Row label="BTC held">
              {priceUnavailable ? (
                <span className="ct-text-muted">—</span>
              ) : (
                <>
                  {btcHeld.toFixed(2)}
                  <span className="ct-text-faint"> BTC</span>
                </>
              )}
            </Row>
            <Row label="Current price">
              {priceUnavailable ? (
                <span className="inline-flex items-baseline gap-2">
                  <span className="ct-text-muted">BTC price feed unavailable.</span>
                  <ProvenanceBadge kind="stale" />
                </span>
              ) : (
                <span className="inline-flex items-baseline gap-2">
                  {usdPrice.format(currentPrice)}
                  <ProvenanceBadge kind={priceProvenance} />
                </span>
              )}
            </Row>
            <Row label="Next accumulate">
              {priceUnavailable ? (
                <span className="ct-text-muted">—</span>
              ) : (
                <span className="inline-flex items-baseline gap-2">
                  <span className="ct-text-body">
                    if BTC &lt; {usdPrice.format(accumulateAt)}
                  </span>
                  <ProvenanceBadge kind="estimated" />
                </span>
              )}
            </Row>
            <Row label="Volatility guardrail">
              {priceUnavailable ? (
                <span className="ct-text-muted">—</span>
              ) : (
                severityBadge(volGuardrail.label, volGuardrail.variant)
              )}
            </Row>
            <Row label="Mining margin guardrail">
              {priceUnavailable ? (
                <span className="ct-text-muted">—</span>
              ) : (
                severityBadge(marginGuardrail.label, marginGuardrail.variant)
              )}
            </Row>
          </div>
        )}

        <p className="mt-auto pt-6 body-xs ct-text-faint italic leading-[var(--ct-leading-relaxed)] opacity-70">
          Triggers are estimated from methodology v1.0 anchors. Avg entry, unrealized P&amp;L and profit-take pending Phase 3 vault deployment (cost basis stored on-chain). Conditional projection — not guaranteed.
        </p>
      </div>
    </Card>
  );
}
