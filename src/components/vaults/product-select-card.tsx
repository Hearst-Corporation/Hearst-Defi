import Link from "next/link";

import { ApyRange } from "@/components/ui/apy-range";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import type { VaultProduct } from "@/lib/data/vaults";
import {
  RISK_LABELS,
  STRATEGY_LABELS,
  VAULT_STATUS_VARIANT,
  vaultStatusLabel,
} from "@/lib/constants/vault";
import { formatUsdCompact } from "@/lib/vaults/product-display";

interface ProductSelectCardProps {
  vault: VaultProduct;
}

export function ProductSelectCard({ vault }: ProductSelectCardProps) {
  const isLive = vault.status === "live";
  const href = `/vaults/${vault.ticker.toLowerCase()}`;
  const strategyLabel = STRATEGY_LABELS[vault.strategy] ?? vault.strategy;

  return (
    <Card aria-label={`${vault.name} — ${strategyLabel}`}>
      <div className="flex flex-col items-stretch gap-5 md:flex-row md:gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <p className="h4 ct-text-strong">{vault.name}</p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="ct-pill">{strategyLabel}</span>
              <span className="ct-pill accent mono">{vault.ticker}</span>
              <Badge variant={VAULT_STATUS_VARIANT[vault.status]}>
                {vaultStatusLabel(vault.status)}
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

        <div aria-hidden className="border-t ct-bc-soft md:hidden" />
        <div aria-hidden className="hidden md:block ct-card-divider-v" />

        <div className="flex w-full shrink-0 flex-col gap-5 md:min-h-full md:w-56">
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="stat-label">Min. ticket</span>
              <span className="h4 tabular truncate">
                {formatUsdCompact(vault.minTicketUsdc)}
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
                  {formatUsdCompact(vault.currentAumUsdc)}
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
