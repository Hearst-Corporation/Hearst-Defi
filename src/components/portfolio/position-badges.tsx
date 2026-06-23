import Link from "next/link";
import type { PortfolioPosition } from "@/lib/data/portfolio";
import { formatUsdCompact } from "@/lib/vaults/product-display";
import { cn } from "@/lib/cn";
import {
  PfCockpitPanel,
  PfCockpitPanelHeader,
} from "@/components/portfolio/pf-cockpit-panel";
import { Plus } from "lucide-react";

interface PositionBadgesProps {
  positions: PortfolioPosition[];
  leafHref?: string;
  embedded?: boolean;
}

const STATUS_CONFIG: Record<
  string,
  { color: string; label: string }
> = {
  active: { color: "var(--ct-accent)", label: "Active" },
  matured: { color: "var(--ct-status-info)", label: "Matured" },
  exited: { color: "var(--ct-text-neutral)", label: "Exited" },
};

/**
 * PositionBadges — Compact position cards as elegant pills/badges.
 * When empty, shows a CTA badge inviting to explore vaults.
 */
export function PositionBadges({
  positions,
  leafHref,
  embedded = false,
}: PositionBadgesProps) {
  const hasPositions = positions.length > 0;

  return (
    <PfCockpitPanel
      variant="wide"
      chrome={embedded ? "embedded" : "panel"}
      aria-label={hasPositions ? "Your positions" : "Explore vaults"}
      className="pf-positions-badges"
    >
      <PfCockpitPanelHeader
        title={hasPositions ? "Positions" : "Vaults"}
        titleVariant="primary"
        trailing={
          hasPositions ? (
            <span className="body-xs ct-text-tertiary tabular">
              {positions.length} active
            </span>
          ) : undefined
        }
      />

      <div className="pf-badges-grid">
        {hasPositions ? (
          positions.map((p) => {
            const statusColor = STATUS_CONFIG[p.status]?.color ?? "var(--ct-accent)";
            return (
              <Link
                key={p.id}
                href={`/portfolio/${p.id}`}
                className={cn(
                  "pf-position-badge",
                  p.status === "active" && "pf-position-badge--active"
                )}
              >
                <span className="pf-position-badge__content">
                  <span className="pf-position-badge__main">
                    <span className="pf-position-badge__name">
                      {p.vaultName ?? "Vault"}
                    </span>
                    <span className="pf-position-badge__status">
                      {STATUS_CONFIG[p.status]?.label ?? "Active"}
                    </span>
                  </span>
                  <span className="pf-position-badge__metrics">
                    <span className="pf-position-badge__value">
                      {formatUsdCompact(p.valueUsdc)}
                    </span>
                    {p.apyLow !== null && p.apyHigh !== null && (
                      <span className="pf-position-badge__apy">
                        {p.apyLow}-{p.apyHigh}%
                      </span>
                    )}
                  </span>
                </span>
                <span
                  className="pf-position-badge__indicator"
                  style={{ backgroundColor: statusColor }}
                />
              </Link>
            );
          })
        ) : (
          <Link
            href="/vaults"
            className="pf-position-badge pf-position-badge--cta"
          >
            <span className="pf-position-badge__content">
              <Plus className="pf-position-badge__icon" size={16} />
              <span className="pf-position-badge__name">New Vault</span>
            </span>
          </Link>
        )}

        {hasPositions && leafHref && (
          <Link href={leafHref} className="pf-position-badge pf-position-badge--more">
            <span className="pf-position-badge__content">
              <span className="pf-position-badge__name">View all →</span>
            </span>
          </Link>
        )}
      </div>
    </PfCockpitPanel>
  );
}
