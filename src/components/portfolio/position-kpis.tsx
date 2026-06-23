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

function fmtSignedPct(pct: number): string {
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

interface PositionKpisProps {
  position: PositionDetail;
}

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
      className="position-detail-kpis"
    >
      <Metric
        variant="plain"
        label="Principal"
        value={usdFull.format(position.principalUsdc)}
        provenance={provenance}
        sublabel="Deposited"
      />

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

      <Metric
        variant="plain"
        label="Distributed to date"
        value={usdFull.format(position.distributedUsdc)}
        provenance={provenance}
        sublabel="USDC paid out"
      />

      <Metric
        variant="plain"
        label="APY range"
        value={
          apyRange ? (
            <ApyRange
              low={apyRange.low}
              high={apyRange.high}
              precision={1}
            />
          ) : (
            "Unavailable"
          )
        }
        provenance={apyRange ? "estimated" : "stale"}
        sublabel={
          apyRange
            ? "Not guaranteed — indicative range"
            : "Vault deployment APY not configured"
        }
      />

      {pnl ? (
        <Metric
          variant="plain"
          label="Net P&L"
          value={
            <span
              className={cn(
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
          trend={{
            direction: pnl.netReturnPct >= 0 ? "up" : "down",
            text: usdFull.format(pnl.totalReturnUsdc),
          }}
        />
      ) : null}
    </section>
  );
}
