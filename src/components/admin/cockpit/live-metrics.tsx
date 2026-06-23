import Link from "next/link";

import { VaultStatusPill } from "@/components/admin/vault-status-pill";
import { EmptySurface } from "@/components/ui/empty-surface";
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
 * Compact table rows per vault: TVL, mining margin, risk score,
 * oracle delay, BTC posture.
 */
export function LiveMetrics({ vaults }: LiveMetricsProps) {
  if (vaults.length === 0) {
    return (
      <EmptySurface
        variant="inline"
        message="No vault telemetry yet."
        ariaLabel="Vault health"
        className="flex-1 flex items-center justify-center py-(--ct-space-8)"
      />
    );
  }

  return (
    <div aria-label="Vault health" className="dashboard-live-metrics">
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
      className="dashboard-action-row cockpit-hover-row cockpit-hover-row--inset cursor-default py-(--ct-space-1_5)"
      aria-label={`Vault ${vault.vaultName} metrics`}
    >
      <div
        className="dashboard-live-metrics__vault-head admin-doc-inline-row admin-doc-inline-row--between admin-doc-inline-row--actions min-w-0 cockpit-metric-head mb-(--ct-space-1)"
      >
        <Link
          href={vault.href}
          className="text-[13px] ct-text-strong min-w-0 truncate cockpit-metric-link font-semibold"
        >
          {vault.vaultName}
        </Link>
        {vault.hasTimelineData ? (
          <VaultStatusPill status={vault.status} className="shrink-0 scale-90 origin-right" />
        ) : (
          <span className="shrink-0 text-[10px] ct-text-faint font-medium uppercase tracking-wider">No telemetry</span>
        )}
      </div>

      {vault.hasTimelineData ? (
        <div className="dashboard-live-metrics__grid mt-(--ct-space-1) py-(--ct-space-1) gap-(--ct-space-2)">
          <MetricCell
            label="TVL"
            value={vault.tvlUsdc > 0 ? usdCompact.format(vault.tvlUsdc) : "—"}
          />
          <MetricCell
            label="Margin"
            value={`${vault.miningMarginScore}`}
            valueClassName={marginColor}
          />
          <MetricCell
            label="Risk"
            value={`${vault.riskScore}`}
            valueClassName={riskColor}
          />
          <MetricCell
            label="Oracle"
            value={oracleLabel}
            valueClassName={oracleStale ? "ct-status-danger" : undefined}
          />
          <MetricCell
            label="BTC"
            value={formatBtcPostureLabel(vault.btcPosture)}
            valueClassName={vault.btcPosture === null ? "ct-text-muted" : undefined}
          />
        </div>
      ) : (
        <p className="text-[11px] ct-text-muted m-0">Awaiting first telemetry close</p>
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
    <div className="admin-doc-stack admin-doc-stack--micro min-w-0 gap-0">
      <span className="text-[9px] font-bold ct-text-faint uppercase tracking-widest leading-none truncate">
        {label}
      </span>
      <span
        className={cn(
          "text-[11px] tabular ct-text-strong font-bold leading-tight truncate",
          valueClassName,
        )}
      >
        {value}
      </span>
    </div>
  );
}

