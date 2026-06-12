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
import { VaultKpiCell } from "@/components/vaults/vault-flow-primitives";
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
      <div className="vault-select-card">
        <div className="vault-select-card__main">
          <div className="min-w-0 product-doc-stack--tight">
            <p className="h4 ct-text-strong">{vault.name}</p>
            <div className="product-doc-inline-row">
              <span className="ct-pill">{strategyLabel}</span>
              <span className="ct-pill accent mono">{vault.ticker}</span>
              <Badge variant={VAULT_STATUS_VARIANT[vault.status]}>
                {vaultStatusLabel(vault.status)}
              </Badge>
            </div>
          </div>

          <div className="product-doc-stack--compact">
            <div className="product-doc-inline-row">
              <span className="stat-label">Target APY range</span>
              <ProvenanceBadge kind="estimated" />
            </div>
            <ApyRange
              low={vault.apyLow}
              high={vault.apyHigh}
              precision={1}
              className="stat-value tabular mono ct-text-strong"
            />
            <p className="body-xs ct-text-muted">
              Conditional on stated assumptions · not a projection
            </p>
          </div>

          <p className="body-sm ct-text-body line-clamp-2">{vault.description}</p>
        </div>

        <div aria-hidden className="vault-select-card__divider-h" />
        <div
          aria-hidden
          className="vault-select-card__divider-v border-l border-(--ct-border-soft)"
        />

        <div className="vault-select-card__meta">
          <div className="product-doc-kpi-grid-2">
            <VaultKpiCell label="Min. ticket">
              <span className="truncate">{formatUsdCompact(vault.minTicketUsdc)}</span>
            </VaultKpiCell>
            <VaultKpiCell label="Lock-up">{vault.softLockupDays}d</VaultKpiCell>
            <VaultKpiCell label="Risk">
              <span className="truncate">{RISK_LABELS[vault.riskLevel]}</span>
            </VaultKpiCell>
            <VaultKpiCell
              label="AUM"
              valueClassName={
                vault.currentAumUsdc > 0 ? undefined : "body-sm ct-text-muted font-normal"
              }
            >
              {vault.currentAumUsdc > 0 ? (
                <span className="truncate">{formatUsdCompact(vault.currentAumUsdc)}</span>
              ) : (
                "Pending"
              )}
            </VaultKpiCell>
          </div>

          <div className="body-xs ct-text-faint product-doc-inline-row product-doc-inline-row--tight">
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
            <Button variant="primary" size="md" asChild className="mt-auto w-full">
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
