import Link from "next/link";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import type { VaultLiveMetric } from "@/lib/data/cockpit";

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
 * Cockpit Admin — Live Metrics column.
 *
 * Compact table rows per vault: TVL, mining margin, risk score,
 * oracle delay, BTC posture.
 */
export function LiveMetrics({ vaults }: LiveMetricsProps) {
  return (
    <Card aria-label="Live metrics" className="dashboard-live-metrics">
      <h2 className="h2 mb-4">Live Metrics</h2>

      {vaults.length === 0 ? (
        <div className="py-8 ct-empty-state">
          <p className="body-sm ct-text-muted text-center">No vault data.</p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-[var(--ct-border-soft)]">
          {vaults.map((vault) => (
            <VaultMetricRow key={vault.vaultId} vault={vault} />
          ))}
        </div>
      )}
    </Card>
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
      ? "ct-status-danger"
      : vault.miningMarginScore < 40
        ? "ct-status-warning"
        : "ct-status-success";

  const riskColor =
    vault.riskScore > 70
      ? "ct-status-danger"
      : vault.riskScore > 45
        ? "ct-status-warning"
        : "ct-status-success";

  return (
    <div
      className="py-3 first:pt-0 last:pb-0"
      aria-label={`Vault ${vault.vaultName} metrics`}
    >
      {/* Vault name + status */}
      <div className="dashboard-live-metrics__vault-head mb-2 flex min-w-0 items-center justify-between gap-2">
        <Link
          href={vault.href}
          className="body-sm ct-text-strong min-w-0 truncate font-medium hover:ct-text-accent hover:underline"
        >
          {vault.vaultName}
        </Link>
        <VaultStatusPill status={vault.status} />
      </div>

      <div className="dashboard-live-metrics__grid">
        <MetricCell
          label="TVL"
          value={vault.tvlUsdc > 0 ? usdCompact.format(vault.tvlUsdc) : "—"}
        />
        <MetricCell
          label="Margin"
          value={vault.hasTimelineData ? `${vault.miningMarginScore}` : "—"}
          valueClassName={vault.hasTimelineData ? marginColor : undefined}
        />
        <MetricCell
          label="Risk"
          value={vault.hasTimelineData ? `${vault.riskScore}` : "—"}
          valueClassName={vault.hasTimelineData ? riskColor : undefined}
        />
        <MetricCell
          label="Oracle"
          value={oracleLabel}
          valueClassName={oracleStale ? "ct-status-danger" : undefined}
        />
        <MetricCell
          label="BTC"
          value={
            vault.hasTimelineData
              ? vault.btcPosture.charAt(0).toUpperCase() + vault.btcPosture.slice(1)
              : "—"
          }
        />
      </div>
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
    <div className="flex flex-col gap-0.5">
      <span className="text-micro uppercase tracking-wide ct-text-faint font-medium">
        {label}
      </span>
      <span className={cn("body-xs tabular font-semibold ct-text-strong", valueClassName)}>
        {value}
      </span>
    </div>
  );
}

function VaultStatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    live: "ct-status-success-bg ct-status-success border-[var(--ct-status-success-border)]",
    paused: "ct-status-warning-bg ct-status-warning border-[var(--ct-status-warning-border)]",
    review: "ct-surface-1 ct-text-muted border-[var(--ct-border)]",
    draft: "ct-surface-1 ct-text-faint border-[var(--ct-border-soft)]",
    closed: "ct-surface-0 ct-text-faint border-[var(--ct-border-soft)]",
  };

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-sm border px-1.5 py-0.5 text-micro font-semibold uppercase tracking-wide",
        styles[status] ?? styles["draft"],
      )}
    >
      {status}
    </span>
  );
}
