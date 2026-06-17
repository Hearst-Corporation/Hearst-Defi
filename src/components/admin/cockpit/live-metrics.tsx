import Link from "next/link";

import { VaultStatusPill } from "@/components/admin/vault-status-pill";
import { EmptySurface } from "@/components/ui/empty-surface";
import { DashboardPanelHeader } from "@/components/ui/dashboard-panel-header";
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
  if (vaults.length === 0) {
    return (
      <div className="dashboard-command-cell dashboard-command-cell--awaiting">
        <DashboardPanelHeader title="Vault health" tone="quiet" />
        <EmptySurface
          variant="inline"
          message="No vault telemetry yet."
          ariaLabel="Vault health"
        />
      </div>
    );
  }

  return (
    <div aria-label="Vault health" className="dashboard-command-cell dashboard-live-metrics">
      <DashboardPanelHeader title="Vault health" tone="quiet" />
      <div className="dashboard-command-divide-stack">
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
      className="dashboard-action-row"
      aria-label={`Vault ${vault.vaultName} metrics`}
    >
      <div
        className="dashboard-live-metrics__vault-head admin-doc-inline-row admin-doc-inline-row--between admin-doc-inline-row--actions min-w-0 mb-2"
      >
        <Link
          href={vault.href}
          className="body-sm ct-text-strong min-w-0 truncate hover:ct-text-accent hover:underline font-medium"
        >
          {vault.vaultName}
        </Link>
        {vault.hasTimelineData ? (
          <VaultStatusPill status={vault.status} className="shrink-0" />
        ) : (
          <span className="shrink-0 body-xs ct-text-faint font-medium">No telemetry</span>
        )}
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
    <div className="admin-doc-stack admin-doc-stack--micro">
      <span className="stat-label ct-text-faint">
        {label}
      </span>
      <span
        className={cn("body-xs tabular ct-text-strong font-semibold", valueClassName)}
      >
        {value}
      </span>
    </div>
  );
}

