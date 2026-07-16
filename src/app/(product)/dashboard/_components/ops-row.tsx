// OpsRow — Zone 3 as ONE uniform stat band. Four OpsStatCard instances with
// identical skeletons (header / dominant value / detail / media / footer) so
// the row reads level: Available capacity · Reserve health · Mining pulse ·
// Fleet status. Replaces the four heterogeneous panels whose different
// densities broke the row's balance (design pass 2026-07-16).
//
// Honesty: every figure maps 1:1 to a view-model field; provenance per card
// via toProvenance; no fabricated fallback — an unresolved block renders "—"
// with its honest detail line.

import { Cpu } from "lucide-react";
import { OpsStatCard } from "./ops-stat-card";
import { AssetIcon } from "@/features/investor-ui/components/asset-icon";
import { Figure } from "@/features/investor-ui/components/figure";
import { HairlineProgress } from "@/features/investor-ui/components/hairline-progress";
import { formatUsdCompactAmount } from "@/features/investor-ui/format-btc";
import { cn } from "@/lib/cn";
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

interface OpsRowProps {
  capacity: ResolvedViewModel<VaultCapacityViewModel>;
  subscription: ResolvedViewModel<SubscriptionViewModel>;
  mining: MiningViewModel;
  btc: BtcViewModel;
}

export function OpsRow({ capacity, subscription, mining, btc }: OpsRowProps) {
  // ── Available capacity ────────────────────────────────────────────────
  const cap = capacity.value;
  const utilizationPct = cap?.utilizationBps != null ? cap.utilizationBps / 100 : null;
  const availableUsd = formatUsdCompactAmount(cap?.availableCapacity);
  const subscriptionOpen = subscription.value?.subscriptionOpen === true;

  // ── Reserve health ────────────────────────────────────────────────────
  const r = btc.reserve.value;
  const monthsCovered = r?.electricityCoveredMonths ?? null;
  const isHealthy = monthsCovered != null && monthsCovered >= HEALTHY_MONTHS_THRESHOLD;

  // ── Mining pulse ──────────────────────────────────────────────────────
  // Digits only — the "TH/s" unit is typeset by <Figure> (P0.6).
  const m = mining.mining.value;
  const hashrateTh = m?.reportedHashrateTh ?? null;

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
        icon={<AssetIcon variant="usdc" size="md" />}
        value={<Figure value={availableUsd ?? "—"} size="base" className="ct-text-strong" />}
        detail={
          utilizationPct != null
            ? `${utilizationPct.toFixed(1)}% vault utilization`
            : "Vault utilization unavailable"
        }
        media={
          utilizationPct != null ? (
            // Decorative bar — the detail line ("x.x% vault utilization")
            // already carries the same figure for screen readers.
            <HairlineProgress pct={utilizationPct} tone="accent" />
          ) : undefined
        }
        footerHref={investDepositPath(VAULT_ID)}
        footerLabel={subscriptionOpen ? "Allocate more capital →" : "View subscription →"}
      />

      <OpsStatCard
        label="Reserve health"
        icon={<AssetIcon variant="reserve" size="md" />}
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
        footerHref="/proof-center"
        footerLabel="View reserve details →"
      />

      <OpsStatCard
        label="Mining pulse"
        icon={<AssetIcon variant="mining" size="md" />}
        value={
          <Figure
            value={hashrateTh ?? "—"}
            unit={hashrateTh != null ? "TH/s" : undefined}
            size="base"
            className="ct-text-strong"
          />
        }
        detail="Reported fleet hashrate"
        footerHref="/mining"
        footerLabel="Explore mining →"
      />

      <OpsStatCard
        label="Fleet status"
        icon={
          // Same gabarit as the 3 neighbouring AssetIcon chips (md = 20px round
          // soft chip, glyph at 55%) — the last pixel of row uniformity (P1.3).
          <span
            role="img"
            aria-label="Fleet status"
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--ct-asset-mining-soft)] text-[var(--ct-asset-mining)]"
          >
            <Cpu size={11} strokeWidth={1.75} aria-hidden />
          </span>
        }
        value={
          <span className="flex items-center gap-[var(--ct-space-2)]">
            {/* Canon LED dots (P1.3): green = fleet actively producing,
                amber = curtailed, off = idle / no telemetry. */}
            <span
              aria-hidden
              className={cn(
                "h-2 w-2 rounded-full shrink-0",
                fleetActive && !curtailed ? "ct-led-green" : curtailed ? "ct-led-amber" : "ct-led-off",
              )}
            />
            <span
              className={cn(
                "text-[length:var(--ct-text-2xl)] font-medium",
                fleetActive && !curtailed ? "ct-text-accent" : "ct-text-muted",
              )}
            >
              {m != null ? fleetState : "—"}
            </span>
          </span>
        }
        detail={m != null ? fleetDetail : "Fleet telemetry unavailable"}
        footerHref="/mining"
        footerLabel="View fleet details →"
      />
    </div>
  );
}
