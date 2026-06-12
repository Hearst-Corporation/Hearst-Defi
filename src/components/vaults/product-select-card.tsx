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
 * Server Component. Uses locked DS primitives only.
 * APY always via <ApyRange> (non-negotiable #1).
 * Provenance badge on the APY metric (non-negotiable #2).
 */
export function ProductSelectCard({ vault }: ProductSelectCardProps) {
  const isLive = vault.status === "live";
  const href = `/vaults/${vault.ticker.toLowerCase()}`;

  return (
    <Card aria-label={`${vault.name} — ${STRATEGY_LABELS[vault.strategy]}`}>
      {/*
        Card wraps its children in an inner `<div class="relative z-…">`, so the
        flex container MUST live here (one level in), not on <Card> itself —
        otherwise `flex md:flex-row` would apply to [hover-overlay, wrapper]
        instead of the two columns, and the layout silently collapses.
      */}
      <div className="flex flex-col items-stretch gap-6 md:flex-row md:gap-8">
      {/* Left column — identity, APY, description */}
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col gap-2 min-w-0">
          <h3 className="h3">{vault.name}</h3>
          <span className="ct-pill text-xs w-fit">{STRATEGY_LABELS[vault.strategy]}</span>
          <div className="flex items-center gap-2 flex-wrap">
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

        {/* APY range — mandatory primitive, provenance badge mandatory (#2) */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="stat-label">Target APY range</span>
            <ProvenanceBadge kind="estimated" />
          </div>
          <div className="flex items-baseline gap-1">
            <ApyRange
              low={vault.apyLow}
              high={vault.apyHigh}
              precision={1}
              className="stat-value"
            />
          </div>
          <p className="body-xs ct-text-muted">
            Conditional on stated assumptions · not a projection of future
            results
          </p>
        </div>

        {/* Strategy description */}
        <p className="body-sm ct-text-body line-clamp-3">{vault.description}</p>
      </div>

      {/*
        Separator filet. Two robust, scan-proof, cascade-proof elements (inline
        border survives the Card's unlayered `.glass-panel` border shorthand):
        - mobile: a 1px horizontal rule above the right column (hidden at md)
        - desktop: a 1px vertical rule between the columns (shown only at md)
        `hidden` / `block` toggle `display`, which the Card primitive never sets,
        so the responsive switch is safe.
      */}
      <div aria-hidden className="md:hidden border-t border-(--ct-border-soft)" />
      <div aria-hidden className="hidden md:block ct-card-divider-v" />

      {/*
        Right column — metrics grid + CTA.
        - Mobile (default, flex-col parent): full width, stacked under the left
          column.
        - Desktop (md, flex-row parent): a fixed 320px track via the standard
          `w-80` utility. `width` is a layered utility, but the Card primitive
          (`.glass-panel`/`.ct-card`) only declares `border` — never `width` —
          so nothing unlayered overrides it. `shrink-0` keeps it from
          collapsing under the flexible left column.
      */}
      <div className="flex w-full md:w-56 shrink-0 flex-col justify-between gap-6">
        <div className="grid grid-cols-2 items-start gap-x-8 gap-y-6">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="stat-label">Min. ticket</span>
              <ProvenanceBadge kind="manual" />
            </div>
            <span className="tabular text-base font-semibold ct-text-strong whitespace-nowrap">
              {USD_COMPACT.format(vault.minTicketUsdc)}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="stat-label">Soft lock-up</span>
              <ProvenanceBadge kind="manual" />
            </div>
            <span className="tabular text-base font-semibold ct-text-strong whitespace-nowrap">
              {vault.softLockupDays}d
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="stat-label">Risk level</span>
              <ProvenanceBadge kind="estimated" />
            </div>
            <span className="text-base font-semibold ct-text-strong whitespace-nowrap">
              {RISK_LABELS[vault.riskLevel]}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="stat-label">AUM</span>
              <ProvenanceBadge kind={vault.currentAumUsdc > 0 ? "live" : "estimated"} />
            </div>
            {vault.currentAumUsdc > 0 ? (
              <span className="tabular text-base font-semibold ct-text-strong whitespace-nowrap">
                {USD_COMPACT.format(vault.currentAumUsdc)}
              </span>
            ) : (
              <>
                {/* ADR-006 #9: do NOT show the Yield Vault AUM under a
                    different vault. Until per-vault snapshots land (Phase 3)
                    we surface "—" + an explicit pending label. */}
                <span
                  className="tabular text-base font-semibold ct-text-muted whitespace-nowrap"
                  aria-label="AUM pending — per-vault snapshot not yet available"
                >
                  —
                </span>
                <span className="body-xs ct-text-faint">AUM pending</span>
              </>
            )}
          </div>
        </div>

        {/* CTA — full width of the KPI block (spans both metric columns) */}
        {isLive ? (
          <Button variant="primary" size="md" asChild className="w-full font-bold">
            <Link href={href} aria-label={`View details for ${vault.name}`}>
              Select →
            </Link>
          </Button>
        ) : (
          <Button variant="secondary" size="md" disabled aria-disabled className="w-full">
            Coming soon
          </Button>
        )}
      </div>
      </div>
    </Card>
  );
}
