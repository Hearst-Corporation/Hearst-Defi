// PositionKpis — KPI cards for /portfolio/[positionId]
// Server Component.
// Non-negotiable #1: APY always via <ApyRange>, never single point.
// Non-negotiable #2: ProvenanceBadge on every metric.

import { Metric } from "@/components/ui/metric";
import { ApyRange } from "@/components/ui/apy-range";
import { cn } from "@/lib/cn";
import type { PositionDetail } from "@/lib/data/portfolio";

const usdFull = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

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

  // P&L sublabel: realized vs unrealized, plus annualised when a holding period exists.
  const pnlSublabel = pnl
    ? [
        `Realised ${usdFull.format(pnl.realizedUsdc)}`,
        `Unrealised ${usdFull.format(pnl.unrealizedUsdc)}`,
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
      className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 items-start"
    >
      {/* 1 — Principal */}
      <Metric
        variant="plain"
        label="Principal"
        value={usdFull.format(position.principalUsdc)}
        provenance={provenance}
        sublabel="Deposited"
      />

      {/* 2 — Accrued yield */}
      <Metric
        variant="plain"
        label="Accrued yield"
        value={usdFull.format(position.accruedYieldUsdc)}
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
        value={usdFull.format(position.distributedUsdc)}
        provenance={provenance}
        sublabel="USDC paid out"
      />

      {/* 4 — Realised APY range — non-negotiable #1 */}
      <Metric
        variant="plain"
        label="Target APY"
        value={
          <ApyRange
            low={position.realizedApyLow}
            high={position.realizedApyHigh}
            precision={1}
          />
        }
        provenance="estimated"
        sublabel="Not guaranteed — indicative range"
      />

      {/* 5 — Net P&L — only when computed; ProvenanceBadge estimated (non-negotiable #2) */}
      {pnl ? (
        <Metric
          variant="plain"
          label="Net P&L"
          value={
            <span
              className={cn(
                pnl.netReturnPct >= 0
                  ? "text-[var(--ct-status-success)]"
                  : "text-[var(--ct-status-danger)]",
              )}
            >
              {fmtSignedPct(pnl.netReturnPct)}
            </span>
          }
          provenance="estimated"
          sublabel={pnlSublabel}
          trend={{
            direction: pnl.netReturnPct >= 0 ? "up" : "down",
            text: usdFull.format(pnl.totalReturnUsdc),
          }}
        />
      ) : null}
    </section>
  );
}
