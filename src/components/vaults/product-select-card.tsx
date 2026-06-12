import Link from "next/link";

import { ApyRange } from "@/components/ui/apy-range";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import type { VaultProduct } from "@/lib/data/vaults";

const STRATEGY_LABELS: Record<VaultProduct["strategy"], string> = {
  mining_yield: "Mining Yield",
  btc_tactical: "BTC Tactical",
  stable_reserve: "Stable Reserve",
};

const RISK_LABELS: Record<VaultProduct["riskLevel"], string> = {
  low: "Low risk",
  "low-moderate": "Low–Moderate",
  moderate: "Moderate",
  high: "High",
};

const STATUS_VARIANT: Record<
  VaultProduct["status"],
  "success" | "warning" | "default" | "danger"
> = {
  live: "success",
  review: "warning",
  draft: "default",
  paused: "warning",
  closed: "danger",
};

const USD_COMPACT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

interface ProductSelectCardProps {
  vault: VaultProduct;
}

/**
 * Card shown in the /vaults grid — Step 1 of 4.
 * Provenance grouped at section level, not per metric row.
 */
export function ProductSelectCard({ vault }: ProductSelectCardProps) {
  const isLive = vault.status === "live";
  const href = `/vaults/${vault.ticker.toLowerCase()}`;

  return (
    <Card aria-label={`${vault.name} — ${STRATEGY_LABELS[vault.strategy]}`}>
      <div className="flex flex-col items-stretch gap-5 md:flex-row md:gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex flex-col gap-2 min-w-0">
            <h3 className="h4 ct-text-strong">{vault.name}</h3>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="ct-pill text-xs">{STRATEGY_LABELS[vault.strategy]}</span>
              <span className="ct-pill accent mono text-xs">{vault.ticker}</span>
              <Badge variant={STATUS_VARIANT[vault.status]}>
                {vault.status === "live"
                  ? "Live"
                  : vault.status === "review"
                    ? "In review"
                    : vault.status === "draft"
                      ? "Draft"
                      : vault.status === "paused"
                        ? "Paused"
                        : "Closed"}
              </Badge>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="stat-label">Target APY range</span>
              <ProvenanceBadge kind="estimated" />
            </div>
            <ApyRange
              low={vault.apyLow}
              high={vault.apyHigh}
              precision={1}
              className="h4 tabular mono ct-text-strong"
            />
            <p className="body-xs ct-text-muted">
              Conditional on stated assumptions · not a projection
            </p>
          </div>

          <p className="body-sm ct-text-body line-clamp-2">{vault.description}</p>
        </div>

        <div aria-hidden className="md:hidden border-t border-(--ct-border-soft)" />
        <div aria-hidden className="hidden md:block ct-card-divider-v" />

        <div className="flex w-full md:w-56 shrink-0 flex-col gap-5 md:min-h-full">
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="stat-label">Min. ticket</span>
              <span className="h4 tabular truncate">
                {USD_COMPACT.format(vault.minTicketUsdc)}
              </span>
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="stat-label">Lock-up</span>
              <span className="h4 tabular">{vault.softLockupDays}d</span>
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="stat-label">Risk</span>
              <span className="h4 truncate">{RISK_LABELS[vault.riskLevel]}</span>
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="stat-label">AUM</span>
              {vault.currentAumUsdc > 0 ? (
                <span className="h4 tabular truncate">
                  {USD_COMPACT.format(vault.currentAumUsdc)}
                </span>
              ) : (
                <span className="body-sm ct-text-muted">Pending</span>
              )}
            </div>
          </div>

          <div className="body-xs ct-text-faint flex flex-wrap items-center gap-1">
            <span>Terms</span>
            <ProvenanceBadge kind="manual" />
            {vault.currentAumUsdc > 0 ? (
              <>
                <span className="mx-0.5">·</span>
                <span>AUM</span>
                <ProvenanceBadge kind="live" />
              </>
            ) : null}
          </div>

          {isLive ? (
            <Button variant="primary" size="md" asChild className="mt-auto w-full font-bold">
              <Link href={href} aria-label={`View details for ${vault.name}`}>
                View details
              </Link>
            </Button>
          ) : (
            <Button variant="secondary" size="md" disabled aria-disabled className="mt-auto w-full">
              Coming soon
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
