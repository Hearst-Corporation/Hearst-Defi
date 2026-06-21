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
import { investProductPath } from "@/lib/vaults/invest-routes";

interface ProductSelectCardProps {
  vault: VaultProduct;
  /** Demo sandbox path — forces provenance to "simulated" and flags live cards. */
  demo?: boolean;
}

export function ProductSelectCard({ vault, demo = false }: ProductSelectCardProps) {
  const isLive = vault.status === "live";
  const href = investProductPath(vault.ticker);
  const strategyLabel = STRATEGY_LABELS[vault.strategy] ?? vault.strategy;

  const aumDisplay =
    vault.currentAumUsdc > 0 ? formatUsdCompact(vault.currentAumUsdc) : "Pending";

  return (
    <Card density="compact" aria-label={`${vault.name} — ${strategyLabel}`} hoverOverlay={false}>
      <div className="vault-select-card">
        <div className="vault-select-card__main">
          <div className="min-w-0 product-doc-stack product-doc-stack--tight">
            <div className="product-doc-inline-row product-doc-inline-row--between">
              <h3 className="h3 ct-text-strong min-w-0">
                {vault.name}{" "}
                <span className="mono ct-text-faint font-normal">{vault.ticker}</span>
              </h3>
              <div className="flex shrink-0 items-center gap-[var(--ct-space-1_5)]">
                {demo && isLive ? <ProvenanceBadge kind="simulated" compact /> : null}
                <Badge variant={VAULT_STATUS_VARIANT[vault.status]}>
                  {vaultStatusLabel(vault.status)}
                </Badge>
              </div>
            </div>
            <span className="stat-label">{strategyLabel}</span>
          </div>

          <div className="product-doc-stack product-doc-stack--compact">
            <div className="product-doc-inline-row product-doc-inline-row--between product-doc-inline-row--start">
              <span className="stat-label">APY range</span>
              <ProvenanceBadge kind="estimated" compact />
            </div>
            <ApyRange
              low={vault.apyLow}
              high={vault.apyHigh}
              precision={1}
              className="stat-value tabular mono ct-text-strong"
            />
          </div>

          <p className="body-sm ct-text-body line-clamp-2">{vault.description}</p>
        </div>

        <div aria-hidden className="vault-select-card__divider-h" />
        <div
          aria-hidden
          className="vault-select-card__divider-v border-l ct-bc-soft"
        />

        <div className="vault-select-card__meta">
          <dl className="vault-select-card__terms">
            <VaultTermRow label="Min. ticket" value={formatUsdCompact(vault.minTicketUsdc)} />
            <VaultTermRow label="Lock-up" value={`${vault.softLockupDays}d`} />
            <VaultTermRow label="Risk" value={RISK_LABELS[vault.riskLevel]} />
            <VaultTermRow label="AUM" value={aumDisplay} muted={vault.currentAumUsdc === 0} />
          </dl>

          {isLive ? (
            <Button variant="primary" size="md" asChild className="mt-auto w-full">
              <Link href={href} aria-label={`View details for ${vault.name}`}>
                View details
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

/** Flat label↔value term row — no nested KPI surface (DS list hierarchy). */
function VaultTermRow({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="vault-select-card__term-row">
      <dt className="stat-label">{label}</dt>
      <dd
        className={`tabular mono ${muted ? "body-sm ct-text-muted font-normal" : "body-sm ct-text-strong font-semibold"}`}
      >
        {value}
      </dd>
    </div>
  );
}
