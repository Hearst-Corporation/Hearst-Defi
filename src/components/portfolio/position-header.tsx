// PositionHeader — top section of /portfolio/[positionId]
// Server Component. Shows vault name, position ID, status pill, total value + delta vs principal.
// Non-negotiable #2: ProvenanceBadge on the total value metric.

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";
import { type PositionDetail, POSITION_STATUS_CONFIG } from "@/lib/data/portfolio";
import { formatUsdDetailed } from "@/lib/vaults/product-display";

interface PositionHeaderProps {
  position: PositionDetail;
}

/**
 * Header block: back link, vault name + position id, status pill,
 * total value with delta vs principal.
 */
export function PositionHeader({ position }: PositionHeaderProps) {
  const totalValue = position.principalUsdc + position.accruedYieldUsdc;
  const delta = totalValue - position.principalUsdc;
  const deltaSign = delta >= 0 ? "+" : "";
  const deltaPct =
    position.principalUsdc > 0
      ? (delta / position.principalUsdc) * 100
      : 0;

  const provenance = position.source === "live" ? "live" : "stale";
  const statusConfig = POSITION_STATUS_CONFIG[position.status];

  return (
    <header className="position-detail-header">
      <div className="position-detail-header__title-row">
        <Link
          href="/portfolio"
          className="body-sm ct-text-muted product-doc-inline-row product-doc-inline-row--tight no-underline transition-colors duration-[var(--ct-dur-base)] ease-[var(--ct-ease)] hover:text-[var(--ct-accent)] mb-2"
        >
          ← Portfolio
        </Link>

        <div className="position-detail-header__identity">
          <div className="pf-inline-row pf-inline-row--tight items-center">
            <h1 className="h1 m-0 wrap-break-word">
              {position.vaultName ?? "Unassigned vault"}
            </h1>
            <Badge variant={statusConfig.variant}>
              {statusConfig.label}
            </Badge>
          </div>
          <span className="eyebrow tabular ct-text-muted mono">
            {position.vaultTicker ? `${position.vaultTicker} · ` : ""}
            <span title={position.id}>{position.id.slice(0, 8)}&hellip;</span>
          </span>
        </div>
      </div>

      <div
        role="region"
        aria-label="Total position value"
        className="position-detail-value-card"
      >
        <div className="position-detail-value-card__body">
          <span className="eyebrow ct-text-muted">Total value</span>
          <span className="stat-value tabular ct-text-strong mono">
            {formatUsdDetailed(totalValue)}
          </span>
          {delta !== 0 && (
            <span
              className={cn(
                "body-xs tabular mono",
                delta >= 0 ? "ct-status-success" : "ct-status-danger"
              )}
            >
              {deltaSign}
              {formatUsdDetailed(delta)} ({deltaSign}{deltaPct.toFixed(1)}%)
            </span>
          )}
        </div>
        <ProvenanceBadge kind={provenance} />
      </div>
    </header>
  );
}
