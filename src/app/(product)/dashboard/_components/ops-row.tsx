// OpsRow — Zone 3 as ONE uniform stat band. Four OpsStatCard instances with
// identical skeletons (header / dominant value / detail / media / footer) so
// the row reads level: Available capacity · Reserve health · Mining pulse ·
// Fleet status. Replaces the four heterogeneous panels whose different
// densities broke the row's balance (design pass 2026-07-16).
//
// Honesty: every figure maps 1:1 to a view-model field; provenance per card
// via toProvenance; no fabricated fallback — an unresolved block renders "—"
// with its honest detail line.

import { OpsStatCard } from "./ops-stat-card";
import { AssetIcon } from "@/features/investor-ui/components/asset-icon";
import {
  toProvenance,
  formatUsdCompactAmount,
  formatBtcAmount,
  satsToBtcString,
  formatIsoDate,
} from "@/features/investor-ui/format-btc";
import { investDepositPath } from "@/lib/vaults/invest-routes";
import type {
  ResolvedViewModel,
  VaultCapacityViewModel,
  SubscriptionViewModel,
  MiningViewModel,
  BtcViewModel,
} from "@/features/investor-ui/types";

const VAULT_ID = "hearst-yield-vault";
/** Coverage floor below which the reserve is flagged for monitoring. */
const HEALTHY_MONTHS_THRESHOLD = 6;

function parseUsd(s: string | null | undefined): number | null {
  if (s == null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

interface OpsRowProps {
  capacity: ResolvedViewModel<VaultCapacityViewModel>;
  subscription: ResolvedViewModel<SubscriptionViewModel>;
  mining: MiningViewModel;
  btc: BtcViewModel;
}

export function OpsRow({ capacity, subscription, mining, btc }: OpsRowProps) {
  // ── Available capacity ────────────────────────────────────────────────
  const cap = capacity.value;
  const capTotal = parseUsd(cap?.tvlCap);
  const utilizationPct = cap?.utilizationBps != null ? cap.utilizationBps / 100 : null;
  const availableUsd = formatUsdCompactAmount(cap?.availableCapacity);
  const subscriptionOpen = subscription.value?.subscriptionOpen === true;

  // ── Reserve health ────────────────────────────────────────────────────
  const r = btc.reserve.value;
  const monthsCovered = r?.electricityCoveredMonths ?? null;
  const isHealthy = monthsCovered != null && monthsCovered >= HEALTHY_MONTHS_THRESHOLD;
  const reserveUsd = formatUsdCompactAmount(r?.reserveUsdc);

  // ── Mining pulse ──────────────────────────────────────────────────────
  const m = mining.mining.value;
  const hashrate = m?.reportedHashrateTh != null ? `${m.reportedHashrateTh} TH/s` : null;
  const producedBtc =
    m?.totalBtcEarnedSats != null ? formatBtcAmount(satsToBtcString(m.totalBtcEarnedSats, 8), 4) : null;

  // ── Fleet status ──────────────────────────────────────────────────────
  const fleetActive = m?.fleetActive === true;
  const curtailed = m?.curtailed === true;
  const fleetState = fleetActive && !curtailed ? "Active" : curtailed ? "Curtailed" : "Idle";
  const fleetDetail =
    fleetActive && !curtailed
      ? "All systems operational"
      : curtailed
        ? "Production paused (curtailment)"
        : "No active production";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-[var(--ct-space-5)] items-stretch">
      <OpsStatCard
        label="Available capacity"
        icon={<AssetIcon variant="usdc" size="sm" />}
        provenance={toProvenance(capacity.status)}
        value={
          <span className="ct-text-strong text-[length:var(--ct-text-2xl)] font-medium tabular">
            {availableUsd ?? "—"}
          </span>
        }
        detail={
          utilizationPct != null
            ? `${utilizationPct.toFixed(1)}% vault utilization`
            : "Vault utilization unavailable"
        }
        media={
          utilizationPct != null ? (
            // Decorative bar — the detail line ("x.x% vault utilization")
            // already carries the same figure for screen readers.
            <div
              aria-hidden="true"
              className="h-1 w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,#ffffff_8%,transparent)]"
            >
              <div
                className="h-full rounded-full bg-[var(--ct-accent)]"
                style={{ width: `${Math.min(100, utilizationPct)}%` }}
              />
            </div>
          ) : undefined
        }
        footerHref={investDepositPath(VAULT_ID)}
        footerLabel={subscriptionOpen ? "Allocate more capital →" : "View subscription →"}
        footerMeta={capTotal != null ? `Cap ${formatUsdCompactAmount(cap?.tvlCap) ?? "—"}` : undefined}
      />

      <OpsStatCard
        label="Reserve health"
        icon={<AssetIcon variant="reserve" size="sm" />}
        provenance={toProvenance(btc.reserve.status)}
        value={
          <span
            className={`text-[length:var(--ct-text-2xl)] font-medium ${isHealthy ? "ct-text-accent" : "ct-text-strong"}`}
          >
            {monthsCovered != null ? (isHealthy ? "Healthy" : "Monitor") : "—"}
          </span>
        }
        detail={
          monthsCovered != null
            ? `${monthsCovered} months of electricity covered`
            : "Coverage unavailable"
        }
        media={
          reserveUsd != null ? (
            <div className="flex items-center justify-between body-xs">
              <span className="ct-text-muted">Operating reserve</span>
              <span className="ct-text-strong font-medium tabular">{reserveUsd}</span>
            </div>
          ) : undefined
        }
        footerHref="/proof-center"
        footerLabel="View reserve details →"
      />

      <OpsStatCard
        label="Mining pulse"
        icon={<AssetIcon variant="mining" size="sm" />}
        provenance={toProvenance(mining.mining.status)}
        value={
          <span className="ct-text-strong text-[length:var(--ct-text-2xl)] font-medium tabular">
            {hashrate ?? "—"}
          </span>
        }
        detail="Reported network hashrate"
        media={
          producedBtc != null ? (
            <div className="flex items-center justify-between body-xs">
              <span className="ct-text-muted flex items-center gap-1">
                <AssetIcon variant="btc" size="sm" label="" />
                BTC produced
              </span>
              <span className="text-[var(--ct-asset-btc)] font-medium tabular">{producedBtc}</span>
            </div>
          ) : undefined
        }
        footerHref="/mining"
        footerLabel="Explore mining →"
        footerMeta={m?.lastReportTime ? formatIsoDate(m.lastReportTime) : undefined}
      />

      <OpsStatCard
        label="Fleet status"
        provenance={toProvenance(mining.mining.status)}
        value={
          <span className="flex items-center gap-[var(--ct-space-2)]">
            <span
              aria-hidden
              className="h-2 w-2 rounded-full shrink-0"
              style={{
                backgroundColor: fleetActive && !curtailed ? "var(--ct-accent)" : "var(--ct-chart-neutral)",
              }}
            />
            <span
              className={`text-[length:var(--ct-text-2xl)] font-medium ${fleetActive && !curtailed ? "ct-text-accent" : "ct-text-muted"}`}
            >
              {m != null ? fleetState : "—"}
            </span>
          </span>
        }
        detail={m != null ? fleetDetail : "Fleet telemetry unavailable"}
        media={
          hashrate != null ? (
            <div className="flex items-center justify-between body-xs">
              <span className="ct-text-muted">Reported</span>
              <span className="ct-text-strong font-medium tabular">{hashrate}</span>
            </div>
          ) : undefined
        }
        footerHref="/mining"
        footerLabel="View fleet details →"
        footerMeta={m?.lastReportTime ? formatIsoDate(m.lastReportTime) : undefined}
      />
    </div>
  );
}
