import Link from "next/link";

import { VaultStatusPill } from "@/components/admin/vault-status-pill";
import { EmptySurface } from "@/components/ui/empty-surface";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import type { VaultLiveMetric } from "@/lib/data/cockpit";
import { formatBtcPostureLabel } from "@/lib/admin/cockpit-btc-posture";

interface LiveMetricsProps {
  vaults: VaultLiveMetric[];
}

const usdCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

/**
 * Cockpit Admin — Live Metrics content (no panel wrapper/header — provided by parent cell).
 *
 * Compact bento rows per vault: TVL, mining margin, risk score,
 * oracle delay, BTC posture. Bento Tailwind (Portfolio canon).
 */
export function LiveMetrics({ vaults }: LiveMetricsProps) {
  if (vaults.length === 0) {
    return (
      <EmptySurface
        variant="inline"
        message="No vault telemetry yet."
        ariaLabel="Vault health"
        className="flex-1 flex items-center justify-center py-8"
      />
    );
  }

  return (
    <div aria-label="Vault health" className="@container min-w-0">
      <div className="flex flex-col">
        {vaults.map((vault) => (
          <VaultMetricRow key={vault.vaultId} vault={vault} />
        ))}
      </div>
    </div>
  );
}

function VaultMetricRow({ vault }: { vault: VaultLiveMetric }) {
  const oracleLabel = vault.oracleDelayMs === null
    ? "—"
    : vault.oracleDelayMs > 21_600_000
      ? "Stale"
      : `${Math.round(vault.oracleDelayMs / 60_000)}m`;

  const oracleStale = vault.oracleDelayMs === null || vault.oracleDelayMs > 21_600_000;

  const marginColor =
    vault.miningMarginScore < 15
      ? "text-red-400"
      : vault.miningMarginScore < 40
        ? "text-amber-400"
        : "text-[var(--ct-accent)]";

  const riskColor =
    vault.riskScore > 70
      ? "text-red-400"
      : vault.riskScore > 45
        ? "text-amber-400"
        : "text-[var(--ct-accent)]";

  return (
    <div
      className="cursor-default border-b border-[var(--ct-border-soft)] py-3 last:border-b-0"
      aria-label={`Vault ${vault.vaultName} metrics`}
    >
      <div className="mb-2 flex min-w-0 items-center justify-between gap-3">
        <Link
          href={vault.href}
          className="truncate text-[length:var(--ct-text-xs)] font-medium uppercase text-white transition-colors hover:text-[var(--ct-accent)]"
        >
          {vault.vaultName}
        </Link>
        {vault.hasTimelineData ? (
          <VaultStatusPill status={vault.status} className="shrink-0 scale-75 origin-right" />
        ) : (
          <span className="shrink-0 text-[length:var(--ct-text-nano)] uppercase tracking-[0.15em] font-bold text-zinc-500">
            No telemetry
          </span>
        )}
      </div>

      {vault.hasTimelineData ? (
        <div className="grid grid-cols-2 gap-2 border-t border-[var(--ct-border-soft)] pt-2 @[14rem]:grid-cols-3 @[22rem]:grid-cols-5">
          <MetricCell
            label="TVL"
            value={vault.tvlUsdc > 0 ? usdCompact.format(vault.tvlUsdc) : "—"}
          />
          <MetricCellWithTooltip
            label="Margin"
            value={`${vault.miningMarginScore}`}
            valueClassName={marginColor}
            tooltipTitle="Mining Margin Score"
            tooltipDesc="Health indicator of mining operations profitability. <15% critical, 15-40% caution, >40% healthy."
          />
          <MetricCellWithTooltip
            label="Risk"
            value={`${vault.riskScore}`}
            valueClassName={riskColor}
            tooltipTitle="Risk Score"
            tooltipDesc="Composite risk across contract, mining, counterparties, market, and liquidity dimensions."
          />
          <MetricCellWithTooltip
            label="Oracle"
            value={oracleLabel}
            valueClassName={oracleStale ? "text-red-400" : undefined}
            tooltipTitle="Oracle Delay"
            tooltipDesc="Time since last price feed update. >6h considered stale. Updated every block."
          />
          <MetricCellWithTooltip
            label="BTC"
            value={formatBtcPostureLabel(vault.btcPosture)}
            valueClassName={vault.btcPosture === null ? "text-zinc-500" : undefined}
            tooltipTitle="BTC Posture"
            tooltipDesc="Current Bitcoin exposure strategy: Long, Hedge, Neutral, or Accumulation."
          />
        </div>
      ) : (
        <p className="m-0 text-[length:var(--ct-text-nano)] uppercase tracking-[0.15em] font-bold text-zinc-500 opacity-60">
          Awaiting first telemetry close
        </p>
      )}
    </div>
  );
}

function MetricCell({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="truncate text-[length:var(--ct-text-nano)] uppercase tracking-[0.15em] font-bold text-zinc-500">
        {label}
      </span>
      <span
        className={cn(
          "truncate text-[length:var(--ct-text-xs)] font-medium text-white tabular-nums",
          valueClassName,
        )}
      >
        {value}
      </span>
    </div>
  );
}

/** Metric cell wrapped with tooltip to reduce duplication */
function MetricCellWithTooltip({
  label,
  value,
  valueClassName,
  tooltipTitle,
  tooltipDesc,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  tooltipTitle: string;
  tooltipDesc: string;
}) {
  return (
    <Tooltip
      content={(
        <div className="dashboard-metric-tooltip">
          <div className="dashboard-metric-tooltip__title">{tooltipTitle}</div>
          <div className="dashboard-metric-tooltip__desc">{tooltipDesc}</div>
        </div>
      )}
      side="top"
    >
      <div className="dashboard-metric-tooltip-trigger">
        <MetricCell label={label} value={value} valueClassName={valueClassName} />
      </div>
    </Tooltip>
  );
}
