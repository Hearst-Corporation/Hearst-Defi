import Link from "next/link";
import { type PortfolioPosition, POSITION_STATUS_CONFIG } from "@/lib/data/portfolio";
import { formatUsdCompact } from "@/lib/vaults/product-display";
import { cn } from "@/lib/cn";
import {
  PfCockpitPanel,
  PfCockpitPanelHeader,
} from "@/components/portfolio/pf-cockpit-panel";
import { Plus, ChevronRight } from "lucide-react";

interface PositionCardsProps {
  positions: PortfolioPosition[];
  leafHref?: string;
  embedded?: boolean;
}

/**
 * PositionCards — Strong Ledger style full-width position cards.
 * Replaces the old pill grid with a stack of imposing cards.
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
            <span className="body-xs ct-text-tertiary tabular">
              {positions.length} active
            </span>
          ) : undefined
        }
      />

      <div className="pf-positions-stack">
        {hasPositions ? (
          positions.map((p) => {
            const statusConfig = POSITION_STATUS_CONFIG[p.status];
            return (
              <Link
                key={p.id}
                href={`/portfolio/${p.id}`}
                className={cn(
                  "pf-position-card",
                  p.status === "active" && "pf-position-card--active"
                )}
              >
                <span className="pf-position-card__content">
                  <span className="pf-position-card__main">
                    <span className="pf-position-card__name tracking-tight">
                      {p.vaultName ?? "Vault"}
                    </span>
                    <span className="pf-position-card__status">
                      {statusConfig.label}
                    </span>
                  </span>

                  <span className="pf-position-card__metrics">
                    <span className="pf-position-card__group">
                      <span className="pf-position-card__label text-nano opacity-60">Position</span>
                      <span className="pf-position-card__value font-extrabold">
                        {formatUsdCompact(p.valueUsdc)}
                      </span>
                    </span>

                    {p.apyLow !== null && p.apyHigh !== null && (
                      <span className="pf-position-card__group">
                        <span className="pf-position-card__label text-nano opacity-60">Target APY</span>
                        <span className="pf-position-card__apy font-bold">
                          {p.apyLow}-{p.apyHigh}%
                        </span>
                      </span>
                    )}
                  </span>

                  <span className="pf-position-card__action">
                    <ChevronRight size={20} />
                  </span>
                </span>
              </Link>
            );
          })
        ) : (
          <Link
            href="/vaults"
            className="pf-position-card pf-position-card--cta"
          >
            <span className="pf-position-card__content">
              <span className="pf-position-card__main">
                <span className="pf-position-card__name tracking-tight">Explore Opportunities</span>
                <span className="pf-position-card__status">No active positions</span>
              </span>
              <span className="pf-position-card__action">
                <Plus size={20} />
              </span>
            </span>
          </Link>
        )}

        {hasPositions && leafHref && (
          <Link href={leafHref} className="pf-position-card pf-position-card--more">
            <span className="pf-position-card__content">
              <span className="pf-position-card__name tracking-tight">View all positions</span>
              <span className="pf-position-card__action">
                <ChevronRight size={20} />
              </span>
            </span>
          </Link>
        )}
      </div>
    </PfCockpitPanel>
  );
}
