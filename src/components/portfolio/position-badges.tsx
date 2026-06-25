import Link from "next/link";
import { ApyRange } from "@/components/ui/apy-range";
import { type PortfolioPosition, POSITION_STATUS_CONFIG } from "@/lib/data/portfolio";
import { formatUsdCompact } from "@/lib/vaults/product-display";
import { cn } from "@/lib/cn";
import {
  PfCockpitPanel,
  PfCockpitPanelHeader,
} from "@/components/portfolio/pf-cockpit-panel";
import { Plus, ChevronRight, TrendingUp, Layers } from "lucide-react";

interface PositionCardsProps {
  positions: PortfolioPosition[];
  leafHref?: string;
  embedded?: boolean;
}

/**
 * PositionCards — Premium position card stack.
 * Structured grid layout: vault name · status · position value · APY · chevron.
 * Green accent only on active badge and APY — not decorative.
 */
export function PositionCards({
  positions,
  leafHref,
  embedded = false,
}: PositionCardsProps) {
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
            <span className="pf-pos-count-badge">
              {positions.length} active
            </span>
          ) : undefined
        }
      />

      <div className="pf-positions-stack">
        {hasPositions ? (
          positions.map((p, idx) => {
            const statusConfig = POSITION_STATUS_CONFIG[p.status];
            const isActive = p.status === "active";
            return (
              <Link
                key={p.id}
                href={`/portfolio/${p.id}`}
                className={cn(
                  "pf-position-card",
                  isActive && "pf-position-card--active",
                )}
                style={{ animationDelay: `${idx * 0.07}s` }}
                aria-label={`${p.vaultName ?? "Vault"} — ${statusConfig.label} — ${formatUsdCompact(p.valueUsdc)}`}
              >
                {/* Active left accent bar */}
                {isActive && (
                  <div className="pf-position-card__accent-bar" aria-hidden />
                )}

                {/* Card content — structured grid */}
                <div className="pf-position-card__content">
                  {/* Main col: vault name + status */}
                  <div className="pf-position-card__main">
                    <span className="pf-position-card__name">
                      {p.vaultName ?? "Vault"}
                    </span>
                    <span className={cn(
                      "pf-position-card__status",
                      isActive && "pf-position-card__status--active",
                    )}>
                      {statusConfig.label}
                    </span>
                  </div>

                  {/* Metrics col: position value */}
                  <div className="pf-position-card__group">
                    <span className="pf-position-card__label">
                      <Layers size={10} strokeWidth={2.5} aria-hidden className="inline mr-1 opacity-60" />
                      Position
                    </span>
                    <span className="pf-position-card__value tabular">
                      {formatUsdCompact(p.valueUsdc)}
                    </span>
                  </div>

                  {/* Metrics col: target APY */}
                  {p.apyLow !== null && p.apyHigh !== null && (
                    <div className="pf-position-card__group">
                      <span className="pf-position-card__label">
                        <TrendingUp size={10} strokeWidth={2.5} aria-hidden className="inline mr-1 opacity-60" />
                        Target APY
                      </span>
                      <ApyRange
                        low={p.apyLow}
                        high={p.apyHigh}
                        className="pf-position-card__apy tabular"
                      />
                    </div>
                  )}

                  {/* Chevron */}
                  <div className="pf-position-card__action" aria-hidden="true">
                    <ChevronRight size={16} strokeWidth={2} />
                  </div>
                </div>
              </Link>
            );
          })
        ) : (
          /* Empty state — premium ghost + CTA */
          <div className="pf-positions-empty-premium">
            <div className="pf-positions-empty-premium__ghost" aria-hidden="true">
              {[85, 65].map((w, i) => (
                <div key={i} className="pf-positions-empty-premium__ghost-card" style={{ opacity: 0.10 - i * 0.03 }}>
                  <div className="pf-positions-empty-premium__ghost-line" style={{ width: `${w}%` }} />
                  <div className="pf-positions-empty-premium__ghost-line pf-positions-empty-premium__ghost-line--sm" />
                </div>
              ))}
            </div>
            <Link
              href="/vaults"
              className="pf-positions-empty-premium__cta group"
            >
              <span className="flex flex-col min-w-0">
                <span className="pf-positions-empty-cta-label">Explore Opportunities</span>
                <span className="pf-positions-empty-cta-sub">Subscribe to your first vault position</span>
              </span>
              <span className="pf-positions-empty-cta-icon">
                <Plus size={15} strokeWidth={2.5} aria-hidden="true" />
              </span>
            </Link>
          </div>
        )}

        {hasPositions && leafHref && (
          <Link href={leafHref} className="pf-positions-view-all group">
            <span className="pf-positions-view-all__label">View all positions</span>
            <ChevronRight size={13} className="pf-positions-view-all__icon" />
          </Link>
        )}
      </div>
    </PfCockpitPanel>
  );
}
