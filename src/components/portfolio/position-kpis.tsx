// PositionKpis — KPI cards for /portfolio/[positionId]
// Server Component.
// Non-negotiable #1: APY always via <ApyRange>, never single point.
// Non-negotiable #2: ProvenanceBadge on every metric.

import { Metric } from "@/components/ui/metric";
import { ApyRange } from "@/components/ui/apy-range";
import { cn } from "@/lib/cn";
import type { PositionDetail } from "@/lib/data/portfolio";
import { formatUsdDetailed } from "@/lib/vaults/product-display";

/** Signed percentage, e.g. +9.3% / -2.1%. */
function fmtSignedPct(pct: number): string {
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

interface PositionKpisProps {
  position: PositionDetail;
}

/**
 * KPI grid: Principal · Accrued yield · Distributed to date · Realised APY range,
 * plus Net P&L when a P&L computation is present.
 * Every metric has a ProvenanceBadge (delegated to the Metric primitive).
 */
export function PositionKpis({ position }: PositionKpisProps) {
  const provenance = position.source === "live" ? "live" : "estimated";
  const pnl = position.pnl;
  const apyRange =
    position.realizedApyLow !== null && position.realizedApyHigh !== null
      ? {
          low: position.realizedApyLow,
          high: position.realizedApyHigh,
        }
      : null;

  // P&L sublabel: realized vs unrealized, plus annualised when a holding period exists.
  const pnlSublabel = pnl
    ? [
        `Realised ${formatUsdDetailed(pnl.realizedUsdc)}`,
        `Unrealised ${formatUsdDetailed(pnl.unrealizedUsdc)}`,
        pnl.annualizedReturnPct !== null
          ? `Annualised ${fmtSignedPct(pnl.annualizedReturnPct)}`
          : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : undefined;

  return (
    <section
      aria-label="Position metrics"
      className="position-detail-kpis"
    >
      {/* 1 — Principal */}
      <Metric
        variant="plain"
        label="Principal"
        value={<span className="mono">{formatUsdDetailed(position.principalUsdc)}</span>}
        provenance={provenance}
        sublabel="Deposited"
      />

      {/* 2 — Accrued yield */}
      <Metric
        variant="plain"
        label="Accrued yield"
        value={<span className="mono">{formatUsdDetailed(position.accruedYieldUsdc)}</span>}
        provenance={provenance}
        sublabel="Pending distribution"
        trend={
          position.accruedYieldUsdc > 0
            ? { direction: "up", text: "Accruing" }
            : undefined
        }
      />

      {/* 3 — Distributed to date */}
      <Metric
        variant="plain"
        label="Distributed to date"
        value={<span className="mono">{formatUsdDetailed(position.distributedUsdc)}</span>}
        provenance={provenance}
        sublabel="USDC paid out"
      />

      {/* 4 — Realised APY range — non-negotiable #1 */}
      <Metric
        variant="plain"
        label="APY range"
        value={
          apyRange ? (
            <ApyRange
              low={apyRange.low}
              high={apyRange.high}
              precision={1}
              className="mono"
            />
          ) : (
            "Unavailable"
          )
        }
        provenance={apyRange ? "estimated" : "stale"}
        sublabel={
          apyRange
            ? "Indicative range"
            : "Not configured"
        }
      />

      {/* 5 — Net P&L — only when computed; ProvenanceBadge estimated (non-negotiable #2) */}
      {pnl ? (
        <Metric
          variant="plain"
          label="Net P&L"
          value={
            <span
              className={cn(
                "mono",
                pnl.netReturnPct >= 0
                  ? "ct-status-success"
                  : "ct-status-danger",
              )}
            >
              {fmtSignedPct(pnl.netReturnPct)}
            </span>
          }
          provenance="estimated"
          sublabel={pnlSublabel}
        />
      ) : null}
    </section>
  );
}
