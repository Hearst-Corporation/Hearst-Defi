import Link from "next/link";

import { VaultStatusPill } from "@/components/admin/vault-status-pill";
import { Card } from "@/components/ui/card";
import { EmptySurface } from "@/components/ui/empty-surface";
import { DashboardPanelHeader } from "@/components/ui/system-panel";
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
      <EmptySurface
        variant="widget"
        message="No vault telemetry yet."
        ariaLabel="Live metrics"
      />
    );
  }

  return (
    <Card aria-label="Live metrics" className="dashboard-live-metrics">
      <DashboardPanelHeader title="Live metrics" tone="quiet" />
      <div className="dashboard-command-divide-stack">
        {vaults.map((vault) => (
          <VaultMetricRow key={vault.vaultId} vault={vault} />
        ))}
      </div>
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
      <div className="dashboard-live-metrics__vault-head mb-2 admin-doc-inline-row admin-doc-inline-row--between min-w-0">
        <Link
          href={vault.href}
          className="body-sm ct-text-strong min-w-0 truncate font-medium hover:ct-text-accent hover:underline"
        >
          {vault.vaultName}
        </Link>
        <VaultStatusPill status={vault.status} className="shrink-0" />
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
    <div className="admin-doc-stack--micro">
      <span className="stat-label ct-text-faint">
        {label}
      </span>
      <span className={cn("body-xs tabular font-semibold ct-text-strong", valueClassName)}>
        {value}
      </span>
    </div>
  );
}

